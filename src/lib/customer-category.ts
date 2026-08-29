import { LOYALTY_TIERS, getTierForPoints } from "./loyalty-tiers";

/**
 * src/lib/customer-category.ts
 *
 * Figma-র "Customer Category" কলামটা কোথা থেকে আসে।
 *
 * ⚠️ মকআপে লেখা আছে Loyal / VIP / Regular / New / Guest — পাঁচটা নাম,
 * যার একটাও এই app-এ নেই। ওগুলো ধরে নতুন একটা শ্রেণিবিভাগ বানানো
 * যেত, কিন্তু সেটা হতো নিছক সাজসজ্জা: কোথাও সংরক্ষিত নয়, কোনো নিয়মে
 * ব্যবহৃত নয়, কেউ বদলাতেও পারত না।
 *
 * অথচ ঠিক এই কাজটা করার একটা ব্যবস্থা আগে থেকেই আছে — loyalty tier
 * (lib/loyalty-tiers.ts)। ওটা loyaltyPoints থেকে হিসাব হয়, checkout-এ
 * সত্যিকারের ছাড় দেয় (Gold = ৫%, Platinum = ৮%), আর গ্রাহক নিজে তার
 * account page-এ ওই নামটাই দেখেন। তাই admin panel-এ ভিন্ন নাম দেখানো
 * মানে একই মানুষকে দু'জায়গায় দু'রকম বলা।
 *
 * একটাই সংযোজন: "New"। যাঁর একটাও order নেই তাঁর পয়েন্টও শূন্য,
 * অর্থাৎ tier হিসেবে তিনি Bronze — কিন্তু "গতকাল sign up করেছেন" আর
 * "দশটা order করেছেন, পয়েন্ট জমেনি" এক কথা নয়। মকআপের "New Customer"
 * এই পার্থক্যটাই ধরে, তাই সেটা রাখা হয়েছে।
 *
 * ⚠️ loyalty-tiers.ts-এর মতোই এই ফাইলেও Prisma পৌঁছয় এমন কোনো import
 * রাখা যাবে না — UsersToolbar একটা client component, আর সে এখান থেকে
 * label গুলো নেয়। কারণটা ওই ফাইলের মন্তব্যে বিস্তারিত আছে।
 */

export const CUSTOMER_CATEGORIES = [
  "new",
  "bronze",
  "silver",
  "gold",
  "platinum",
] as const;

export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[number];

/** Figma-র গড়ন: "<নাম> Customer"। */
export const CATEGORY_LABELS: Record<CustomerCategory, string> = {
  new: "New Customer",
  bronze: "Bronze Customer",
  silver: "Silver Customer",
  gold: "Gold Customer",
  platinum: "Platinum Customer",
};

export function isCustomerCategory(value: unknown): value is CustomerCategory {
  return typeof value === "string" && CUSTOMER_CATEGORIES.includes(value as CustomerCategory);
}

/** একজন গ্রাহক কোন শ্রেণিতে — তালিকার প্রতিটা সারির জন্য। */
export function categoryFor(points: number, orderCount: number): CustomerCategory {
  if (orderCount === 0) return "new";
  return getTierForPoints(points).id.toLowerCase() as CustomerCategory;
}

/**
 * ছাঁকনির জন্য পয়েন্টের সীমা — [সর্বনিম্ন, সর্বোচ্চ)।
 *
 * সর্বোচ্চটা পরের tier-এর সর্বনিম্ন, আর সবচেয়ে উপরেরটার কোনো ছাদ নেই
 * (null)। এটা এখানে হিসাব করা হয়, হাতে লেখা নয় — নাহলে loyalty-tiers.ts-এ
 * কেউ একটা সীমা বদলালে এই ছাঁকনিটা নীরবে ভুল লোক দেখাত।
 */
export function pointsRangeFor(
  category: Exclude<CustomerCategory, "new">
): { min: number; max: number | null } {
  const index = LOYALTY_TIERS.findIndex((tier) => tier.id.toLowerCase() === category);
  const tier = LOYALTY_TIERS[index];
  const next = LOYALTY_TIERS[index + 1];
  return { min: tier.minPoints, max: next ? next.minPoints : null };
}