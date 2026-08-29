import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Password guessing is the obvious attack against this endpoint —
        // unlike coupon/gift-card codes (rate-limited elsewhere), a login
        // attempt has no separate "preview" step, so this check has to
        // live right here. IP-scoped like the rest of rate-limit.ts's
        // usage: makes a single script grinding through a password list
        // impractical without blocking normal mistyped-password retries.
        const rateLimitResult = checkRateLimit(request, "login", {
          limit: 10,
          windowMs: 5 * 60_000,
        });
        if (!rateLimitResult.allowed) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const user = await prisma.user.findUnique({
          where: { email },
          include: { staffProfile: { select: { isActive: true } } },
        });
        // user.password null হবে যদি সে Google দিয়ে signup করে থাকে
        if (!user || !user.password) {
          return null;
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }
        // Deactivated staff can't log in at all, even with the right
        // password — same treatment as a disabled account anywhere else.
        if (user.role !== "CUSTOMER" && user.staffProfile?.isActive === false) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          // ⚠️ এটা না থাকলে ছবিটা কেবল Google-লগইনে দেখা যেত।
          // যিনি একবার Google দিয়ে ঢুকে পরে পাসওয়ার্ড বসিয়েছেন,
          // তাঁর ছবি DB-তে আছে — কিন্তু credentials পথে সেটা কখনো
          // session-এ পৌঁছাত না, কারণ এখান থেকে যা ফেরানো হয়
          // কেবল সেটাই যায়।
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google দিয়ে প্রথমবার login করলে User টেবিলে row তৈরি করা
    // (PrismaAdapter ব্যবহার না করে JWT strategy দিয়ে manual handle)
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // SECURITY: Google-এর email_verified flag চেক না করলে account
        // takeover সম্ভব — কেউ credentials দিয়ে victim@gmail.com নামে
        // আগেই একটা account বানিয়ে রাখতে পারে, পরে আসল victim Google দিয়ে
        // login করলে সেই আগের (attacker-controlled) account-এর সাথে
        // silently merge হয়ে যেত। Google সাধারণত verified email-ই পাঠায়,
        // কিন্তু defensive coding হিসেবে এখানে explicit চেক রাখা হলো।
        if (!profile?.email_verified) {
          return false;
        }

        /**
         * Google-এর প্রোফাইল ছবি।
         *
         * NextAuth `user.image`-এ ওটা বসায় (Google-এর নিজের নাম
         * `picture`), কিন্তু আমরা PrismaAdapter ব্যবহার করি না — JWT
         * strategy দিয়ে হাতে সামলাই — তাই সংরক্ষণ করার দায়িত্বও
         * আমাদের। না করলে মানটা শুধু session-এ থাকত, আর admin panel
         * (যেটা DB থেকে পড়ে) কোনো ছবিই দেখতে পেত না।
         *
         * ⚠️ `?? null`, `?? undefined` নয়। Google থেকে ছবি না এলে
         * আগের মানটা মুছে ফেলাই ঠিক — কেউ Google-এ ছবি সরিয়ে দিলে
         * আমাদের কাছে একটা অচল URL পড়ে থাকা উচিত নয়।
         */
        const picture = user.image ?? null;

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email as string },
        });
        if (!existingUser) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email as string,
              name: user.name,
              image: picture,
              role: "CUSTOMER",
              // password null থাকবে — এই user শুধু Google দিয়েই login করতে পারবে
            },
          });
          user.id = newUser.id;
          (user as { role?: string }).role = newUser.role;
        } else {
          user.id = existingUser.id;
          (user as { role?: string }).role = existingUser.role;

          // ছবিটা বদলে থাকলে তবেই লেখা হয়। প্রতিটা login-এ শর্তহীন
          // update করলে প্রতিবার একটা অপ্রয়োজনীয় write হতো, অথচ
          // মানটা বছরে হয়তো একবার বদলায়।
          if (existingUser.image !== picture) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: picture },
            });
          }
        }
      }
      return true;
    },
  },
});