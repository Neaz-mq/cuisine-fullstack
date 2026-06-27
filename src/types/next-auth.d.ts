import { DefaultSession } from "next-auth";

/**
 * src/types/next-auth.d.ts
 *
 * next-auth-এর default Session/User টাইপে `id` আর `role` নেই,
 * তাই TypeScript এগুলো অ্যাক্সেস করতে দিলে এরর দেখাবে।
 * এই ফাইল module augmentation দিয়ে টাইপ বাড়িয়ে দেয়।
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
