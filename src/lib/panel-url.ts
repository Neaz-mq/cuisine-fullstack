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
 *             /kitchen/profile      ↔ /admin/profile
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
const KITCHEN_SUBPAGES = ["/prep", "/inventory", "/suppliers", "/staff", "/notifications"] as const;

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