import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * auth.config.ts
 *
 * এটা "edge-compatible" config — শুধু middleware.ts এটা import করে।
 * এখানে Prisma client, bcrypt, বা কোনো Node-only API রাখা যাবে না,
 * কারণ middleware edge runtime-এ চলে, যেখানে এগুলো কাজ করে না।
 *
 * Credentials provider (যেটা database query করে) এখানে নেই —
 * সেটা auth.ts-এ আছে, যেটা শুধু server-side API route/server component-এ
 * import হয়, middleware-এ না।
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    // middleware এই callback ব্যবহার করে route protection-এর জন্য
    // এখানে কোনো database query নেই, শুধু token/session চেক
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = request.nextUrl.pathname.startsWith("/admin");
      const isOnAccount = request.nextUrl.pathname.startsWith("/account");

      if (isOnAdmin) {
        return isLoggedIn && (auth?.user as { role?: string })?.role === "ADMIN";
      }

      if (isOnAccount) {
        return isLoggedIn;
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
};