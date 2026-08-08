import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isStaffRole } from "@/lib/permissions";

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

  const isOnAdmin = pathname.startsWith("/admin");
  const isOnAccount = pathname.startsWith("/account");

  if (isOnAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
    if (!isStaffRole(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (isOnAccount && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};