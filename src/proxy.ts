import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isStaffRole } from "@/lib/permissions";
import {
  PANEL_PREFIXES,
  PANEL_VIEW_HEADER,
  panelViewForPath,
  panelViewFromReferer,
  publicPrefixForRole,
  toInternalPath,
  toPublicPath,
  type PanelView,
} from "@/lib/panel-url";

/**
 * src/proxy.ts
 *
 * This runs on the edge runtime, so only the edge-compatible part of
 * auth.config.ts is used here — no database query (login attempt)
 * happens in this file.
 *
 * Previously this used the default `NextAuth(authConfig).auth` wrapper
 * (driven by the authConfig.callbacks.authorized callback). But NextAuth's
 * default behavior is: whenever authorized() returns false — whether
 * because there's no session or because the role is wrong — it always
 * redirects to /login. This meant a logged-in but non-admin (CUSTOMER)
 * user would incorrectly see the login page, which is confusing (they're
 * already logged in, yet see a login form again).
 *
 * Now an explicit proxy function separates the two cases:
 *   - no session               → /login (with callbackUrl)
 *   - session exists, wrong role → / (home)
 *
 * The matcher controls which routes this runs on — static files, images,
 * and api routes are excluded for performance.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const { pathname } = req.nextUrl;

  const isOnPanelUrl = PANEL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isOnAdmin = pathname.startsWith("/admin") || isOnPanelUrl;
  const isOnAccount = pathname.startsWith("/account");

  /**
   * Request headers handed on to the page. PANEL_VIEW_HEADER is always
   * removed first, so a client can never set it; it is added back only
   * when an OWNER is browsing as the Kitchen or Manager panel.
   */
  const forwardedHeaders = (view: PanelView | null = null) => {
    const headers = new Headers(req.headers);
    headers.delete(PANEL_VIEW_HEADER);
    if (view) headers.set(PANEL_VIEW_HEADER, view);
    return headers;
  };

  if (isOnAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
    if (!isStaffRole(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // The staff panel lives under /admin for every role, but a Manager sees
    // /manager, a Rider sees /rider and Kitchen staff see /kitchen (see
    // lib/panel-url.ts):
    //   /manager|/rider|/kitchen URL → rewritten internally to /admin/... for the
    //                          matching role, redirected to /admin for others
    //   /admin URL as Manager/Rider → redirected to their own prefix (GET only)
    //   OWNER may open /kitchen and /manager too (rewritten, and the page is
    //   told which panel it is — see PANEL_VIEW_HEADER in lib/panel-url.ts)
    const ownPrefix = publicPrefixForRole(role);
    if (isOnPanelUrl) {
      const target = req.nextUrl.clone();
      target.pathname = toInternalPath(pathname);
      const matches = ownPrefix && (pathname === ownPrefix || pathname.startsWith(`${ownPrefix}/`));
      if (matches) {
        return NextResponse.rewrite(target, { request: { headers: forwardedHeaders() } });
      }
      // The owner holds every panel's access, so /kitchen and /manager open
      // for them instead of bouncing to /admin.
      const ownerView = role === "OWNER" ? panelViewForPath(pathname) : null;
      if (ownerView) {
        return NextResponse.rewrite(target, { request: { headers: forwardedHeaders(ownerView) } });
      }
      return NextResponse.redirect(target);
    }
    if (ownPrefix && (req.method === "GET" || req.method === "HEAD")) {
      const publicPath = toPublicPath(role, pathname);
      if (publicPath !== pathname) {
        const target = req.nextUrl.clone();
        target.pathname = publicPath;
        return NextResponse.redirect(target);
      }
    }

    // OWNER inside the Kitchen/Manager panel clicking a plain /admin/... link
    // (sidebar, dashboard card, filter): stay in that panel, the same way a
    // real Manager/Kitchen user is moved to their prefix above. The panel is
    // read from the page they came from. Links that leave on purpose (the
    // "Admin Panel" item in the user menu) send no Referer, so they pass.
    if (role === "OWNER" && (req.method === "GET" || req.method === "HEAD")) {
      const fromView = panelViewFromReferer(
        req.headers.get("referer"),
        req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
      );
      if (fromView) {
        const publicPath = toPublicPath(fromView, pathname);
        if (publicPath !== pathname) {
          const target = req.nextUrl.clone();
          target.pathname = publicPath;
          return NextResponse.redirect(target);
        }
      }
    }
    return NextResponse.next({ request: { headers: forwardedHeaders() } });
  }

  if (isOnAccount && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: forwardedHeaders() } });
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};