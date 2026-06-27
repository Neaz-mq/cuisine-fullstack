import { PrismaClient } from "@/generated/prisma/client";

/**
 * src/lib/prisma.ts
 *
 * Next.js dev mode-এ hot-reload হওয়ার সময় বারবার নতুন PrismaClient
 * instance তৈরি হয়ে "too many connections" এরর হতে পারে।
 * এই pattern (globalThis-এ cache করা) সেটা প্রতিরোধ করে।
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
