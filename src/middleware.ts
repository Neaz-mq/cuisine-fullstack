import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isStaffRole } from "@/lib/permissions";

/**
 * src/middleware.ts
 *
 * এটা edge runtime-এ চলে, তাই auth.config.ts-এর শুধু edge-compatible অংশ
 * ব্যবহার হয় এখানে — কোনো database query (login attempt) এখানে হয় না।
 *
 * আগে এটা ডিফল্ট `NextAuth(authConfig).auth` (authConfig.callbacks.authorized
 * callback-নির্ভর) ব্যবহার করতো। কিন্তু NextAuth-এর ডিফল্ট আচরণ হলো:
 * authorized() যখনই false return করে — session না থাকা আর role ভুল হওয়া,
 * দুটো ভিন্ন কারণেই — সবসময় /login-এ redirect করে দেয়। ফলে একজন logged-in
 * কিন্তু non-admin (CUSTOMER) ইউজারও ভুলভাবে login page দেখতো, যেটা
 * confusing (সে already logged in, তবু আবার login ফর্ম)।
 *
 * এখন explicit middleware function দিয়ে দুটো case আলাদা করা হলো:
 *   - session নেই                → /login (callbackUrl সহ)
 *   - session আছে কিন্তু role ভুল  → / (home)
 *
 * matcher দিয়ে ঠিক করা আছে কোন route-এ middleware চলবে — static file,
 * image, api routes বাদ দেওয়া হয়েছে পারফরম্যান্সের জন্য।
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