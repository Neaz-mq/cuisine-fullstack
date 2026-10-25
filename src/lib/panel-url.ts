/**
 * Address-bar paths per role. The staff panel is built under /admin for
 * every role, but a Manager sees /manager, a Rider /rider and a Kitchen
 * staffer /kitchen. The proxy
 * (src/proxy.ts) redirects /admin/... to the role's public path and rewrites
 * it back internally, so no page or link has to change.
 *
 *   MANAGER   /manager/...          ↔ /admin/...
 *   DELIVERY  /rider                ↔ /admin/my-deliveries
 *             /rider/profile        ↔ /admin/profile
 *             /rider/<page>         ↔ /admin/my-deliveries/<page>
 *   KITCHEN   /kitchen              ↔ /admin            (Dashboard)
 *             /kitchen/live-orders  ↔ /admin/kitchen    (Live Orders board)
 *             /kitchen/prep         ↔ /admin/kitchen/prep
 *             /kitchen/inventory    ↔ /admin/kitchen/inventory
 *             /kitchen/suppliers    ↔ /admin/kitchen/suppliers
 *             /kitchen/staff        ↔ /admin/kitchen/staff
 *             /kitchen/notifications ↔ /admin/kitchen/notifications
 *             /kitchen/settings     ↔ /admin/kitchen/settings
 *             /kitchen/profile      ↔ /admin/profile
 *
 * OWNER (the restaurant's owner) may open the Kitchen and Manager panels
 * too, exactly as those staff see them:
 *
 *   OWNER     /kitchen/...          ↔ /admin/...   (as the Kitchen panel)
 *             /manager/...          ↔ /admin/...   (as the Manager panel)
 *
 * Same URL mapping as the real roles; the proxy additionally tells the
 * server which panel the owner is "viewing as" (PANEL_VIEW_HEADER) so the
 * layout and dashboard render that panel. Nothing here widens or narrows
 * anyone's permissions — pages and APIs still check the owner's real role.
 *
 * Pure string helpers — safe for the edge proxy and for client components.
 */
export const PANEL_PREFIXES = ["/manager", "/rider", "/kitchen"] as const;

const hasPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** The panel prefix a role browses under, or null for plain /admin. */
export function publicPrefixForRole(
  role: string | undefined
): "/manager" | "/rider" | "/kitchen" | null {
  if (role === "MANAGER") return "/manager";
  if (role === "DELIVERY") return "/rider";
  if (role === "KITCHEN") return "/kitchen";
  return null;
}

/** Kitchen pages whose public name is the same as the part after /admin/kitchen. */
const KITCHEN_SUBPAGES = ["/prep", "/inventory", "/suppliers", "/staff", "/notifications", "/settings"] as const;

/** /manager/x, /rider/x or /kitchen/x → the real /admin/... path. Other paths unchanged. */
export function toInternalPath(path: string): string {
  if (hasPrefix(path, "/manager")) return `/admin${path.slice("/manager".length)}`;
  if (hasPrefix(path, "/rider")) {
    const rest = path.slice("/rider".length);
    if (hasPrefix(rest || "/", "/profile") && rest) return `/admin${rest}`;
    return `/admin/my-deliveries${rest}`;
  }
  if (hasPrefix(path, "/kitchen")) {
    const rest = path.slice("/kitchen".length);
    // "/kitchen" → the Dashboard; "/kitchen/live-orders" → the board.
    if (rest === "" || rest === "/") return "/admin";
    if (hasPrefix(rest, "/live-orders")) {
      return `/admin/kitchen${rest.slice("/live-orders".length)}`;
    }
    if (KITCHEN_SUBPAGES.some((sub) => hasPrefix(rest, sub))) return `/admin/kitchen${rest}`;
    return `/admin${rest}`;
  }
  return path;
}

/** A real /admin/... path → what the given role should see in the address bar. */
export function toPublicPath(role: string | undefined, path: string): string {
  if (!hasPrefix(path, "/admin")) return path;
  const prefix = publicPrefixForRole(role);
  if (prefix === "/manager") return `/manager${path.slice("/admin".length)}`;
  if (prefix === "/rider") {
    if (hasPrefix(path, "/admin/my-deliveries")) {
      return `/rider${path.slice("/admin/my-deliveries".length)}`;
    }
    if (hasPrefix(path, "/admin/profile")) return `/rider${path.slice("/admin".length)}`;
    if (path === "/admin") return "/rider";
  }
  if (prefix === "/kitchen") {
    if (path === "/admin") return "/kitchen";
    if (path === "/admin/kitchen") return "/kitchen/live-orders";
    if (hasPrefix(path, "/admin/kitchen")) return `/kitchen${path.slice("/admin/kitchen".length)}`;
    if (hasPrefix(path, "/admin/profile")) return `/kitchen${path.slice("/admin".length)}`;
  }
  return path;
}

/**
 * Request header the proxy sets (and always clears first, so a client can't
 * send it themselves) when an OWNER is browsing under /kitchen or /manager.
 * Read it on the server with getPanelView() (lib/panel-view.ts).
 */
export const PANEL_VIEW_HEADER = "x-panel-view";

export type PanelView = "KITCHEN" | "MANAGER";

/** Which panel a /kitchen/... or /manager/... address bar path belongs to. */
export function panelViewForPath(path: string): PanelView | null {
  if (hasPrefix(path, "/kitchen")) return "KITCHEN";
  if (hasPrefix(path, "/manager")) return "MANAGER";
  return null;
}

/**
 * The panel a same-site Referer URL was in, or null.
 *
 * Used for an OWNER only: pages inside the Kitchen/Manager panels contain
 * plain /admin/... links (sidebar, dashboard cards, filters). A real KITCHEN
 * or MANAGER user is bounced to their own prefix by their role; the owner has
 * no such role, so the page they were just on (the Referer) says which panel
 * they are in. `host` is the host the request came in on — a Referer from
 * another site is ignored.
 */
export function panelViewFromReferer(
  referer: string | null | undefined,
  host: string | null | undefined
): PanelView | null {
  if (!referer || !host) return null;
  try {
    const url = new URL(referer);
    if (url.host !== host) return null;
    return panelViewForPath(url.pathname);
  } catch {
    return null;
  }
}