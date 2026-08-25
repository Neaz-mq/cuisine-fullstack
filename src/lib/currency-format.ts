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

/**
 * এই currency-তে সাধারণত কয়টা দশমিক থাকে। অচেনা হলে ২।
 *
 * ⚠️ এটা একটা **পরামর্শ**, কোনো সিদ্ধান্ত নয় — নাম বদলে
 * `defaultMinorUnitsFor` করা হয়েছে ঠিক সেটা মনে করিয়ে দিতেই।
 *
 * এর একমাত্র বৈধ কাজ দুটো:
 *
 *   ১. admin নতুন currency বাছলে "Decimal places" ঘরে কী বসানো উচিত
 *      তার প্রস্তাব দেওয়া
 *   ২. formatAmount()-এ fallback, যখন caller নিজে কিছু বলেনি
 *
 * টাকার আসল হিসাবে — charge, refund, চালান — এটা **কখনো** ব্যবহার করা
 * যাবে না। ওখানে order.currencyMinorUnits পড়তে হবে, অর্থাৎ order যখন
 * তৈরি হয়েছিল তখন কার্যকর মানটা।
 *
 * কারণটা তেতো অভিজ্ঞতা: charge হতো settings থেকে, refund হতো এই
 * তালিকা থেকে। admin ইয়েন বেছে দশমিক ২ রেখে দিলে (UI সেটা আটকায় না)
 * Stripe-এ ১০০ গুণ বেশি যেতো আর ফেরত আসত ১০০ গুণ কম — নীরবে।
 */
export function defaultMinorUnitsFor(currency: string): number {
  return MINOR_UNIT_EXCEPTIONS[currency?.toUpperCase()] ?? 2;
}

/**
 * পর্দায় দেখানোর চিহ্ন।
 *
 * আগে এই ফাইল সব জায়গায় ISO কোড দেখাত, আর তার যুক্তি ছিল: চিহ্নগুলো
 * দ্ব্যর্থক ($ কোন ডলার?) আর অনেক font-এ অনুপস্থিত। যুক্তিটা এখনো
 * সত্যি — তাই সেটা ফেলে দেওয়া হয়নি, ভাগ করা হয়েছে:
 *
 *   • পর্দায় (dashboard, তালিকা, checkout) চিহ্ন — design এটাই চায়,
 *     আর সেখানে গ্রাহক জানেনই কোন দোকানে আছেন।
 *   • চালান/email-এ ISO কোড — formatAmountWithCode() দ্রষ্টব্য।
 *
 * দ্ব্যর্থতার সমস্যাটা এখানে ডলারের ভাইদের আলাদা চিহ্ন দিয়ে সামলানো
 * হয়েছে: শুধু USD-ই খালি "$", বাকিরা "CA$", "A$", "S$"। একইভাবে
 * CNY "CN¥", কারণ ¥ একা লিখলে JPY না CNY বোঝা যায় না।
 *
 * যে currency-র ভালো চিহ্ন নেই বা font-এ ঠিকমতো আসে না (AED, SAR,
 * KWD, BHD, OMR) সেগুলো তালিকার বাইরে — তাদের ক্ষেত্রে ISO কোডই দেখানো
 * হয়, যেটা পড়া না-যাওয়া চিহ্নের চেয়ে ঢের ভালো।
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  BDT: "৳",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  PKR: "₨",
  THB: "฿",
  MYR: "RM",
  JPY: "¥",
  CNY: "CN¥",
  KRW: "₩",
  VND: "₫",
  AUD: "A$",
  CAD: "CA$",
  SGD: "S$",
};

/** এই currency-র চিহ্ন, নাকি null যদি কোড দেখানোই ভালো হয়। */
export function symbolFor(currency: string): string | null {
  return CURRENCY_SYMBOLS[currency?.toUpperCase()] ?? null;
}

/**
 * "$300.00", "৳105.00", "¥1200", "KWD 12.345"।
 *
 * চিহ্ন জানা থাকলে চিহ্ন (ফাঁক ছাড়া, design যেমন দেখায়), নাহলে ISO
 * কোড আর একটা ফাঁক। চালান বা email-এর জন্য formatAmountWithCode()
 * ব্যবহার করতে হবে — সেখানে কোডটাই থাকা দরকার।
 */
export function formatAmount(
  value: string | number,
  currency: string,
  /**
   * দশমিক সংখ্যা জোর করে বসানোর সুযোগ — ডিফল্ট currency-র নিজস্ব সংখ্যা।
   *
   * ⚠️ এটা যোগ করতে হয়েছে একটা বাস্তব বাগের পর। কাঁচামালের দাম প্রায়ই
   * গ্রাম বা মিলিলিটার প্রতি — রান্নার তেল ০.০০৩০/মিলি। সেটা টাকার
   * ডিফল্ট দুই দশমিকে সাজালে "BDT 0.00" হয়ে যেতো, অর্থাৎ তালিকা বলতো
   * তেলের কোনো দামই নেই, অথচ Insights-এর food cost ঠিকই সেটা ধরছিল।
   *
   * সেসব ক্ষেত্রে caller নিজেই দশমিক ঠিক করে দেয়। এটা প্রদর্শনযোগ্য
   * দাম নয় — হিসাবের হার, আর হারের নির্ভুলতা মুদ্রার নির্ভুলতার চেয়ে
   * বেশি হতে পারে।
   */
  decimalPlaces?: number
): string {
  const units = decimalPlaces ?? defaultMinorUnitsFor(currency);
  const asNumber = typeof value === "number" ? value : parseFloat(value);

  if (!Number.isFinite(asNumber)) return `${currency} ${value}`;

  const symbol = symbolFor(currency);
  return symbol
    ? `${symbol}${asNumber.toFixed(units)}`
    : `${currency} ${asNumber.toFixed(units)}`;
}

/**
 * সবসময় ISO কোড: "USD 300.00", "BDT 105.00"।
 *
 * চালান, রসিদ আর email-এর জন্য। একজন গ্রাহক ছ'মাস পর নিজের mail ঘেঁটে
 * "$19.93" দেখলে সেটা কোন ডলার ছিল বোঝার উপায় থাকে না — বিশেষত এই
 * app-এ, যেখানে দোকান মাঝপথে currency বদলাতে পারে আর পুরোনো order
 * নিজের currency নিয়েই থেকে যায়। কোডটা সেই প্রশ্নটাই উঠতে দেয় না।
 */
export function formatAmountWithCode(
  value: string | number,
  currency: string,
  decimalPlaces?: number
): string {
  const units = decimalPlaces ?? defaultMinorUnitsFor(currency);
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
