import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

/**
 * auth.ts
 *
 * এটাই পূর্ণ NextAuth config — Prisma এবং bcrypt এখানে আছে, কারণ এই ফাইল
 * শুধু server component আর API route-এ import হয় (Node.js runtime),
 * middleware.ts-এ এই ফাইল import হয় না।
 *
 * import করার নিয়ম:
 *   import { auth, signIn, signOut } from "@/auth";
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // user.password null হবে যদি সে Google দিয়ে signup করে থাকে
        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google দিয়ে প্রথমবার login করলে User টেবিলে row তৈরি করা
    // (PrismaAdapter ব্যবহার না করে JWT strategy দিয়ে manual handle)
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email as string },
        });

        if (!existingUser) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email as string,
              name: user.name,
              role: "CUSTOMER",
              // password null থাকবে — এই user শুধু Google দিয়েই login করতে পারবে
            },
          });
          user.id = newUser.id;
          (user as { role?: string }).role = newUser.role;
        } else {
          user.id = existingUser.id;
          (user as { role?: string }).role = existingUser.role;
        }
      }
      return true;
    },
  },
});