/**
 * src/lib/currency-format.ts
 *
 * একটা অঙ্ককে মানুষের পড়ার মতো করে দেখানোর জন্য — currency চিহ্ন আর
 * সঠিক দশমিক সংখ্যা সহ।
 *
 * ⚠️ এই file-টা অবশ্যই Prisma-মুক্ত থাকবে। client component-ও এটা import
 * করে (tracking পাতা, checkout), আর lib/money.ts বা lib/pricing.ts
 * generated Prisma client ছোঁয়, যা `node:module` টানে — browser bundle-এ
 * তার অস্তিত্ব থাকতে পারে না। loyalty-tiers.ts-এর header-এ একই সতর্কতা,
 * আর এই প্রজেক্টে সেটা একবার ভেঙে `next build` থামিয়েছিল।
 *
 * তাই এখানে কোনো Decimal নেই। যে মান আসে সেটা ইতিমধ্যেই string (server
 * serialize করে পাঠিয়েছে) — এখানে কেবল সাজানো হয়, হিসাব নয়।
 *
 * ── দশমিক সংখ্যাটা Order-এর নিজের currency থেকে কেন ──────────────────
 *
 * RestaurantSettings-এ currencyMinorUnits আছে, কিন্তু সেটা *আজকের*
 * সেটিং। একটা পুরোনো চালান ইয়েনে কাটা হয়ে থাকলে, আর দোকান পরে টাকায়
 * চলে গেলে, ওই পুরোনো চালান দুই দশমিকে দেখানো ভুল হতো — ¥1,200.00 বলে
 * কিছু নেই।
 *
 * Order row-তে currency snapshot করা আছে, তাই সেটা থেকেই দশমিক বের করা
 * হয়। এতে ইতিহাস অবিকৃত থাকে, ঠিক যে কারণে taxRate/taxName-ও
 * snapshot করা।
 */

/**
 * ব্যতিক্রমগুলোর তালিকা। বাকি সব currency-তে ২ দশমিক, তাই এখানে কেবল
 * যেগুলো আলাদা সেগুলোই আছে — পুরো ISO 4217 তালিকা বয়ে বেড়ানোর দরকার
 * নেই, আর নতুন currency যোগ করলে ডিফল্টটাই সাধারণত সঠিক।
 */
const MINOR_UNIT_EXCEPTIONS: Record<string, number> = {
  // দশমিকহীন — এদের কোনো ভগ্নাংশ একক নেই।
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  UGX: 0,
  RWF: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,

  // ১০০০ ভাগে বিভক্ত।
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  IQD: 3,
  LYD: 3,
};

/** এই currency-তে কয়টা দশমিক দেখানো উচিত। অচেনা হলে ২। */
export function minorUnitsFor(currency: string): number {
  return MINOR_UNIT_EXCEPTIONS[currency?.toUpperCase()] ?? 2;
}

/**
 * "BDT 105.00", "JPY 1200", "KWD 12.345"।
 *
 * চিহ্ন (৳, ¥, $) নয়, ISO কোড ব্যবহার করা হয় ইচ্ছাকৃতভাবে: চিহ্নগুলো
 * দ্ব্যর্থক ($ কোন ডলার?) আর অনেক font-এ অনুপস্থিত, অথচ কোডটা সব
 * জায়গায় একই অর্থ বহন করে। চালানে দ্ব্যর্থতা সবচেয়ে ব্যয়বহুল।
 */
export function formatAmount(value: string | number, currency: string): string {
  const units = minorUnitsFor(currency);
  const asNumber = typeof value === "number" ? value : parseFloat(value);

  if (!Number.isFinite(asNumber)) return `${currency} ${value}`;

  return `${currency} ${asNumber.toFixed(units)}`;
}

/** একটা money string আদৌ শূন্যের বেশি কিনা — লাইনটা দেখাব কিনা ঠিক করতে। */
export function isPositiveAmount(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const asNumber = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(asNumber) && asNumber > 0;
}
