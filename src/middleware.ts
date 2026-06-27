import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * src/middleware.ts
 *
 * এটা edge runtime-এ চলে, তাই auth.config.ts-এর শুধু `authorized` callback
 * ব্যবহার হয় এখানে — কোনো database query (login attempt) এখানে হয় না।
 *
 * matcher দিয়ে ঠিক করা আছে কোন route-এ middleware চলবে — static file,
 * image, api routes বাদ দেওয়া হয়েছে পারফরম্যান্সের জন্য।
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
