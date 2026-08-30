import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * src/lib/prisma.ts
 *
 * Next.js dev mode-এ hot-reload হওয়ার সময় বারবার নতুন PrismaClient
 * instance তৈরি হয়ে "too many connections" এরর হতে পারে।
 * এই pattern (globalThis-এ cache করা) সেটা প্রতিরোধ করে।
 *
 * ── কেন driver adapter, কেন সরাসরি `new PrismaClient()` নয় ─────────────
 *
 * schema.prisma-য় `engineType = "client"` — অর্থাৎ Rust query engine
 * (libquery_engine-*.so.node) আর তৈরিই হয় না। ওই binary-টাই ছিল
 * production-এ প্রতিটা DB query ভাঙার কারণ: custom output
 * (src/generated/prisma) মানে generated client Next.js-এর bundle-এ ঢুকে
 * যায়, আর bundler .so.node ফাইল trace করে না — তাই Vercel-এ
 * "could not locate the Query Engine for runtime rhel-openssl-3.0.x"।
 *
 * engineType = "client" হলে Prisma query compile করে WASM দিয়ে আর
 * ডাটাবেসে কথা বলে একটা সাধারণ JS driver দিয়ে — এখানে node-postgres,
 * @prisma/adapter-pg-এর মোড়কে। তখন adapter পাঠানো ঐচ্ছিক নয়,
 * **বাধ্যতামূলক** — adapter ছাড়া client-এর ডাটাবেসে যাওয়ার কোনো পথই নেই।
 *
 * ⚠️ connection string এখন schema-র datasource থেকে নয়, এখান থেকে যায়।
 * DATABASE_URL = Supabase transaction pooler (:6543)। URL-এর
 * `pgbouncer=true` / `connection_limit=1` প্যারামিটার দুটো Prisma-র
 * নিজস্ব ছিল; node-postgres ওগুলো চেনে না, চুপচাপ উপেক্ষা করে। ক্ষতি নেই —
 * pg নামহীন (unnamed) prepared statement ব্যবহার করে, যা pgbouncer-এর
 * transaction mode-এর সাথে এমনিতেই সঙ্গতিপূর্ণ।
 *
 * Prisma CLI (migrate/seed/studio) এই ফাইলে আসে না — সেগুলো
 * prisma.config.ts-এর DIRECT_URL (session pooler, :5432) দিয়েই চলে।
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  // আগে অনুপস্থিত DATABASE_URL ধরা পড়ত Prisma-র নিজের initialization
  // error দিয়ে। adapter নিজে undefined পেলে অনেক পরে, অস্পষ্ট একটা
  // node-postgres error দেয় — তাই এখানেই স্পষ্ট করে ফেলা হলো।
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — Prisma Client cannot be created without it."
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}