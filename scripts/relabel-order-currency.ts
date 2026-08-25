/**
 * scripts/relabel-order-currency.ts
 *
 * পুরোনো order গুলোর currency snapshot বদলে দেয়।
 *
 * ⚠️ সাধারণ অবস্থায় এটা চালানো **উচিত নয়**।
 *
 * প্রতিটা order নিজের currency আলাদা করে জমিয়ে রাখে, আর সেটাই একটা
 * পুরোনো চালানকে সৎ রাখে — দোকান পরে currency বদলালেও ছ'মাস আগের
 * রসিদ ঠিক যা ঘটেছিল তা-ই বলে। এই script সেই সুরক্ষাটাই তুলে নেয়:
 * ৳500-এর একটা order-কে $500 বলতে শুরু করে, অথচ ব্যাংকে গিয়েছিল
 * ৫০০ টাকা।
 *
 * তাহলে এটা আছে কেন? demo বা portfolio database-এর জন্য, যেখানে
 * order গুলো seed করা — সেখানে "ইতিহাস" বলে কিছু নেই, শুধু নমুনা
 * data, আর পুরো পর্দা এক মুদ্রায় দেখানোটাই আসল উদ্দেশ্য।
 *
 * অঙ্ক বদলায় না, শুধু নামটা বদলায়। ১৯.৯৩ টাকা ১৯.৯৩ ডলার হয়ে যায় —
 * কোনো বিনিময় হার প্রয়োগ হয় না। আসল হারে রূপান্তর চাইলে সেটা আলাদা
 * কাজ, আর তাতে প্রতিটা Decimal ঘর (subtotal, tax, tip, grandTotal,
 * totalAmount…) একসাথে বদলাতে হবে যাতে যোগফল মিলে থাকে।
 *
 * চালানোর নিয়ম:
 *
 *     npx tsx scripts/relabel-order-currency.ts --from BDT --to USD
 *     npx tsx scripts/relabel-order-currency.ts --from BDT --to USD --yes
 *
 * --yes ছাড়া কিছুই লেখা হয় না, শুধু কতগুলো row বদলাত সেটা দেখায়।
 */
/**
 * ⚠️ এই import-টা সবার উপরে থাকতেই হবে, PrismaClient তৈরির আগে।
 *
 * `npx prisma migrate` নিজে .env পড়ে নেয়, কিন্তু বাঁচা `npx tsx` তা
 * করে না — Node নিজে থেকে .env চেনে না। prisma/seed.ts-ও dotenv তোলে
 * না, কারণ ওটা `prisma db seed` দিয়ে চলে আর env-টা তখন Prisma CLI
 * সরবরাহ করে। এই script সরাসরি চলে, তাই তাকে নিজেরটা নিজেই তুলতে হয়।
 *
 * এটা না থাকলে যে error আসে সেটা বিভ্রান্তিকর: "Environment variable
 * not found: DATABASE_URL" দেখে মনে হয় .env ফাইলটাই ভুল বা নেই, অথচ
 * ফাইলটা ঠিকঠাক পাশেই পড়ে আছে — কেউ পড়েনি কেবল।
 *
 * dotenv আগে থেকেই devDependency (^17.4.2), নতুন কিছু install করতে
 * হবে না।
 */
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { defaultMinorUnitsFor } from "../src/lib/currency-format";

// dotenv-এর পরেও যদি না মেলে, তাহলে Prisma-র ভেতর থেকে stack trace
// সহ error আসার চেয়ে এখানেই এক লাইনে বলে দেওয়া ভালো।
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run this from the project root, where .env lives."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const from = arg("from")?.toUpperCase();
  const to = arg("to")?.toUpperCase();
  const confirmed = process.argv.includes("--yes");

  if (!from || !to) {
    console.error("Usage: npx tsx scripts/relabel-order-currency.ts --from BDT --to USD [--yes]");
    process.exit(1);
  }

  // ISO 4217 কোড ঠিক তিন অক্ষরের। এই যাচাইটা না থাকলে একটা টাইপো
  // (--to USDD) নীরবে প্রতিটা order-এ বসে যেত, আর ধরা পড়ত অনেক পরে।
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    console.error("Currency codes must be three letters, e.g. BDT or USD.");
    process.exit(1);
  }

  const minorUnits = defaultMinorUnitsFor(to);
  const affected = await prisma.order.count({ where: { currency: from } });

  console.log(`Orders currently in ${from}: ${affected}`);
  console.log(`Would relabel to:          ${to} (${minorUnits} decimal places)`);

  if (affected === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!confirmed) {
    console.log("\nDry run — nothing written. Re-run with --yes to apply.");
    return;
  }

  /**
   * ⚠️ currency আর currencyMinorUnits একই update-এ বদলায়, আলাদা দুটো
   * query-তে নয়।
   *
   * দশমিক সংখ্যাটা সাজানোর ব্যাপার নয় — Stripe-এ অঙ্ক যায় minor
   * unit-এ, গুণক 10^currencyMinorUnits। JPY-তে যাওয়ার সময় জোড়াটা
   * আলাদা হয়ে গেলে ¥1,200 চলে যেত 120000 হয়ে, অর্থাৎ ১০০ গুণ বেশি।
   * দুটো একসাথে রাখলে সেই ফাঁকটা তৈরিই হয় না।
   */
  const result = await prisma.order.updateMany({
    where: { currency: from },
    data: { currency: to, currencyMinorUnits: minorUnits },
  });

  console.log(`\nRelabelled ${result.count} orders from ${from} to ${to}.`);
  console.log("Amounts were NOT converted — only the currency label changed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
