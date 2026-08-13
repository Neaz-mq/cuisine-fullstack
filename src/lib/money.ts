import { Prisma } from "@/generated/prisma/client";

/**
 * src/lib/money.ts
 *
 * প্রতিটা money value এই file-এর মধ্য দিয়ে যাবে। কোথাও `+`, `*` বা
 * `Math.round(x * 100)` হাতে লেখা যাবে না।
 *
 * কেন Decimal, Float নয়
 * ---------------------
 * Postgres double precision-এ 0.1 + 0.2 = 0.30000000000000004। একটা
 * order-এ ব্যাপারটা অদৃশ্য, কিন্তু gift card-এ নয়: একটা কার্ড ধাপে ধাপে
 * খরচ হয়, আর 50 − 19.99 − 12.35 − 17.66 শেষ হয় ~1.8e-15-তে, শূন্যে নয়।
 * ফলে কার্ডটা চিরকাল "এখনো টাকা আছে" দেখাতো, অথচ কিছুই কেনা যেতো না।
 * Prisma Decimal (decimal.js) ভেতরে দশমিক ভিত্তিতে হিসাব করে, তাই এই
 * শ্রেণির ভুল আর সম্ভব নয়।
 *
 * কেন ৩ দশমিক, ২ নয়
 * ------------------
 * কুয়েতি দিনার, বাহরাইনি দিনার আর ওমানি রিয়াল ১০০০ ভাগে বিভক্ত
 * (fils)। Decimal(10,2) ওই তিন দেশে system-টা চালানোই অসম্ভব করে
 * দিতো। ৩ দশমিক সব ISO 4217 currency ধরে ফেলে।
 *
 * ⚠️ সংরক্ষণের নির্ভুলতা আর প্রদর্শনের নির্ভুলতা এক জিনিস নয়। column ৩
 * দশমিক ধরে রাখতে পারে, কিন্তু কোন currency-তে কয়টা দশমিক *দেখানো* হবে
 * সেটা RestaurantSettings.currencyMinorUnits বলে — জাপানি ইয়েনে ০,
 * টাকায় ২, দিনারে ৩।
 */

export type Money = Prisma.Decimal;

/**
 * যা যা থেকে একটা Money বানানো যায়।
 *
 * `Prisma.Decimal.Value` লেখা যায় না — `Prisma.Decimal` একটা class,
 * namespace নয়, তাই তার ভেতরের type-এ dot দিয়ে পৌঁছানো যায় না
 * (TS2713)। union-টা তাই এখানে নিজেই লেখা।
 */
export type MoneyInput = Money | number | string;

/** Prisma-র Decimal constructor, যাতে প্রতিটা file-এ generated client
 *  import করতে না হয়। */
export const Decimal = Prisma.Decimal;

export const ZERO: Money = new Prisma.Decimal(0);

/**
 * যেকোনো কিছু থেকে Money — number, string, বা আরেকটা Decimal।
 *
 * number গ্রহণ করা হয় কারণ HTTP body সবসময় JSON, আর JSON-এ Decimal নেই।
 * তবে সীমানাটা যেন এখানেই থাকে: request handler `toMoney()` ডেকে সাথে
 * সাথে Decimal-এ চলে যাবে, তারপর আর কখনো number-এ ফিরবে না।
 */
export function toMoney(value: MoneyInput | null | undefined): Money {
  if (value === null || value === undefined) return ZERO;
  return new Prisma.Decimal(value);
}

/** যোগ — খালি তালিকায় ০। */
export function sum(...values: Money[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(v), ZERO);
}

/**
 * ঋণাত্মক হলে ০-তে থামায়। discount বা redemption bill-এর চেয়ে বড় হলে
 * total যেন ঋণাত্মক না হয় — যা হলে Stripe-এ negative charge যেতো।
 */
export function clampToZero(value: Money): Money {
  return value.isNegative() ? ZERO : value;
}

/** a আর b-এর মধ্যে ছোটটা — "gift card balance না bill total, যেটা কম" ধরনের
 *  হিসাবের জন্য। */
export function minMoney(a: Money, b: Money): Money {
  return a.lessThan(b) ? a : b;
}

/**
 * Currency-র নিজস্ব দশমিক সংখ্যায় round করে (half-up)।
 *
 * ব্যাংকিং round-half-even ব্যবহার করা হয়নি ইচ্ছাকৃতভাবে: চালান আর
 * VAT হিসাবে প্রায় সব জায়গায় half-up প্রত্যাশিত, আর auditor যখন হাতে
 * মিলিয়ে দেখবে তখন ওটাই মিলবে।
 *
 * প্রতিটা লাইন আলাদা করে round করা হয় (subtotal, tax, tip …), শেষে
 * একবার নয় — তাহলে চালানের লাইনগুলো যোগ করলে মোট মিলবে, যা customer
 * নিজেই যাচাই করতে পারে।
 */
export function roundMoney(value: Money, minorUnits: number): Money {
  return value.toDecimalPlaces(minorUnits, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Stripe-এর `unit_amount` / `amount` যে integer minor unit চায়, সেটা।
 *
 * পুরোনো কোড সব currency-তে `Math.round(price * 100)` করতো। USD-তে ঠিক,
 * কিন্তু ¥১,২০০-র order Stripe-এ যেতো 120000 হয়ে — অর্থাৎ ১২ লক্ষ ইয়েন,
 * ১০০ গুণ বেশি। আর KWD-তে উল্টোটা: ১০০০ দিয়ে গুণ করার কথা, ১০০ দিয়ে
 * করায় ১০ ভাগের ১ ভাগ আদায় হতো।
 *
 * Stripe-এর zero-decimal তালিকা (JPY, KRW, VND, CLP …) আর three-decimal
 * তালিকা (KWD, BHD, OMR, JOD, TND) — দুটোই এই এক গুণক দিয়ে সামলে যায়,
 * কারণ গুণকটা settings থেকে আসে, কোডে লেখা থাকে না।
 */
export function toStripeMinorUnits(value: Money, minorUnits: number): number {
  const scaled = roundMoney(value, minorUnits).times(new Prisma.Decimal(10).pow(minorUnits));

  // .toNumber() এখানে নিরাপদ: এটা ইতিমধ্যে একটা পূর্ণসংখ্যা, আর Stripe
  // API JSON number-ই নেয়। Number.MAX_SAFE_INTEGER ছাড়াতে হলে একটা
  // order-কে ৯০ ট্রিলিয়ন ইয়েন হতে হবে।
  return scaled.toNumber();
}

/**
 * Stripe থেকে ফেরত আসা minor unit → Money। Webhook-এ
 * `session.amount_total` মিলিয়ে দেখার সময় দরকার।
 */
export function fromStripeMinorUnits(amount: number, minorUnits: number): Money {
  return new Prisma.Decimal(amount).dividedBy(new Prisma.Decimal(10).pow(minorUnits));
}

/**
 * শতাংশ প্রয়োগ। rate ভগ্নাংশ হিসেবে আসে (0.05 = ৫%), শতাংশ হিসেবে নয় —
 * schema-তেও ওভাবেই রাখা, তাই মাঝপথে কোথাও ১০০ দিয়ে ভাগ করার সুযোগ নেই।
 *
 * ইচ্ছাকৃতভাবে round করা হয় না: কোন ধাপে round হবে সেটা pricing.ts
 * সিদ্ধান্ত নেয়, যাতে round করার জায়গাগুলো এক জায়গায় দেখা যায়।
 */
export function applyRate(base: Money, rate: Money): Money {
  return base.times(rate);
}

/**
 * INCLUSIVE tax mode-এ কর ইতিমধ্যে দামের ভেতরে — তাই যোগ নয়, বের করে
 * আনতে হয়:
 *
 *     tax = total × rate / (1 + rate)
 *
 * ১১৫ টাকায় ১৫% VAT অন্তর্ভুক্ত মানে কর ১৫ টাকা (১০০-এর উপর), ১৭.২৫
 * নয়। এই একটা ভুলে ইউরোপ/জাপানের প্রতিটা চালান বেশি কর দেখাতো।
 */
export function extractInclusiveTax(grossAmount: Money, rate: Money): Money {
  if (rate.isZero()) return ZERO;
  return grossAmount.times(rate).dividedBy(rate.plus(1));
}

/**
 * মানুষের পড়ার মতো করে — "৳1,250.00", "¥1,200", "KWD 12.345"।
 *
 * Intl.NumberFormat-কে দশমিক সংখ্যা স্পষ্ট করে বলা হয়, কারণ সে নিজে
 * currency দেখে ধরে নিলে settings-এর মানের সাথে অমিল হতে পারে — আর
 * তখন একই পাতায় দুই রকম দশমিক দেখাবে।
 */
export function formatMoney(
  value: MoneyInput,
  currency: string,
  minorUnits: number,
  locale?: string
): string {
  const asNumber = new Prisma.Decimal(value).toNumber();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
    }).format(asNumber);
  } catch {
    // অচেনা বা ভুল currency code Intl throw করে। তখন চালান ফাঁকা দেখানোর
    // চেয়ে code-সহ সংখ্যাটা দেখানো ভালো।
    return `${currency} ${asNumber.toFixed(minorUnits)}`;
  }
}

/**
 * Client-এ পাঠানোর জন্য। Prisma Decimal JSON.stringify হলে একটা object
 * হয়ে যায় ("{"s":1,"e":2,...}"), তাই API boundary-তে string-এ রূপান্তর।
 *
 * string, number নয় — কারণ JavaScript-এর number-এ ফেরত পাঠানো মানে
 * ঠিক সেই float সমস্যাটাই আবার ডেকে আনা, শুধু এবার browser-এ।
 */
export function serializeMoney(value: Money, minorUnits: number): string {
  return roundMoney(value, minorUnits).toFixed(minorUnits);
}
