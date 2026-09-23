import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

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

/**
 * ⚠️ dev-এ cache করা client পুরনো হয়ে যেতে পারে।
 *
 * schema-য় নতুন model যোগ করে `prisma generate` চালালে generated কোড
 * বদলায়, কিন্তু globalThis-এ রাখা **পুরনো instance**-টা dev server
 * চলা পর্যন্ত থেকেই যায় — তাতে নতুন model-এর delegate নেই। ফলাফল:
 * `prisma.productOffer` undefined, আর "Cannot read properties of
 * undefined (reading 'findMany')" (ProductOffer যোগ করার পর ঠিক এটাই
 * হয়েছিল)।
 *
 * তাই cache-টা তখনই ব্যবহার হয় যখন তাতে এখনকার generated client-এর
 * প্রতিটা model আছে; নাহলে পুরনোটা বন্ধ করে নতুন বানানো হয়। production-এ
 * cache নেই, তাই এটা কেবল dev-এর জন্য।
 */
function isCurrent(client: PrismaClient): boolean {
  return Object.values(Prisma.ModelName).every((name) => {
    const delegate = name.charAt(0).toLowerCase() + name.slice(1);
    return delegate in client;
  });
}

const cached = globalForPrisma.prisma;
if (cached && !isCurrent(cached)) {
  void cached.$disconnect().catch(() => {});
}

export const prisma = cached && isCurrent(cached) ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}