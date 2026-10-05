/**
 * Address-bar paths per role. The staff panel is built under /admin for
 * every role, but a Manager sees /manager and a Rider sees /rider. The proxy
 * (src/proxy.ts) redirects /admin/... to the role's public path and rewrites
 * it back internally, so no page or link has to change.
 *
 *   MANAGER   /manager/...          ↔ /admin/...
 *   DELIVERY  /rider                ↔ /admin/my-deliveries
 *             /rider/profile        ↔ /admin/profile
 *             /rider/<page>         ↔ /admin/my-deliveries/<page>
 *
 * Pure string helpers — safe for the edge proxy and for client components.
 */
export const PANEL_PREFIXES = ["/manager", "/rider"] as const;

const hasPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** The panel prefix a role browses under, or null for plain /admin. */
export function publicPrefixForRole(role: string | undefined): "/manager" | "/rider" | null {
  if (role === "MANAGER") return "/manager";
  if (role === "DELIVERY") return "/rider";
  return null;
}

/** /manager/x or /rider/x → the real /admin/... path. Other paths unchanged. */
export function toInternalPath(path: string): string {
  if (hasPrefix(path, "/manager")) return `/admin${path.slice("/manager".length)}`;
  if (hasPrefix(path, "/rider")) {
    const rest = path.slice("/rider".length);
    if (hasPrefix(rest || "/", "/profile") && rest) return `/admin${rest}`;
    return `/admin/my-deliveries${rest}`;
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
  return path;
}