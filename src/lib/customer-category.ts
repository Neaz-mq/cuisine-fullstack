import { getTierForPoints, type LoyaltyTierDef } from "./loyalty-tiers";

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
 *
 * Tier-গুলো এখন admin → Loyalty → Customer Ranking থেকে বদলানো যায়
 * (LoyaltyTier table), তাই শ্রেণিগুলো আর স্থির তালিকা নয়: "new" অথবা
 * একটা tier-এর id। প্রতিটা function tier-তালিকাটা parameter হিসেবে
 * নেয় — server সেটা lib/loyalty-config.ts থেকে পড়ে, client prop-এ পায়।
 */

/** "new" or a LoyaltyTier id. */
export type CustomerCategory = string;

export const NEW_CATEGORY = "new";

export interface CategoryOption {
  value: CustomerCategory;
  /** In lists: "Gold Customer". */
  label: string;
  /** On the filter pill, where space is tight: "Gold". */
  shortLabel: string;
}

/** Every filter option, in order: New, then tiers lowest first. */
export function categoryOptions(tiers: LoyaltyTierDef[]): CategoryOption[] {
  return [
    { value: NEW_CATEGORY, label: "New Customer", shortLabel: "New" },
    ...tiers.map((tier) => ({
      value: tier.id,
      label: `${tier.label} Customer`,
      shortLabel: tier.label,
    })),
  ];
}

export function isCustomerCategory(value: unknown, tiers: LoyaltyTierDef[]): value is CustomerCategory {
  return (
    typeof value === "string" &&
    (value === NEW_CATEGORY || tiers.some((tier) => tier.id === value))
  );
}

/** একজন গ্রাহক কোন শ্রেণিতে — তালিকার প্রতিটা সারির জন্য। */
export function categoryFor(
  points: number,
  orderCount: number,
  tiers: LoyaltyTierDef[]
): CustomerCategory {
  if (orderCount === 0) return NEW_CATEGORY;
  return getTierForPoints(points, tiers).id;
}

export function categoryLabel(category: CustomerCategory, tiers: LoyaltyTierDef[]): string {
  return categoryOptions(tiers).find((option) => option.value === category)?.label ?? "Customer";
}

/**
 * ছাঁকনির জন্য পয়েন্টের সীমা — [সর্বনিম্ন, সর্বোচ্চ)।
 *
 * সর্বোচ্চটা পরের tier-এর সর্বনিম্ন, আর সবচেয়ে উপরেরটার কোনো ছাদ নেই
 * (null)। tier-তালিকা থেকেই হিসাব হয়, হাতে লেখা নয় — নাহলে কেউ একটা
 * সীমা বদলালে এই ছাঁকনিটা নীরবে ভুল লোক দেখাত।
 */
export function pointsRangeFor(
  tierId: CustomerCategory,
  tiers: LoyaltyTierDef[]
): { min: number; max: number | null } {
  const index = tiers.findIndex((tier) => tier.id === tierId);
  if (index === -1) return { min: 0, max: null };
  const next = tiers[index + 1];
  return { min: tiers[index].minPoints, max: next ? next.minPoints : null };
}
