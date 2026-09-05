import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/category-scope.ts
 *
 * Categories পাতার Overview কার্ডের ছাঁকনির একমাত্র উৎস।
 *
 * ⚠️ আলাদা ফাইল, কারণ `CategoryScopeFilter.tsx`-এর মাথায়
 * `"use client"` — ওই ফাইল থেকে component ছাড়া কিছু server-এ যায় না।
 * `lib/category-filter.ts` ঠিক একই কারণে আলাদা, আর সেখানেই এই
 * ফাঁদটার পুরো ব্যাখ্যা আছে।
 *
 * ── কেন "period" নয় ────────────────────────────────────────────────
 *
 * Figma-তে Overview-র মাথায় "Today ⌄" আঁকা, আর বাকি পাতাগুলোয় ওখানে
 * `OverviewPeriodFilter` বসে। এখানে সেটা বসানো যায় না: `Category`
 * model-এ কোনো তারিখের মাঠই নেই (`createdAt` পর্যন্ত না), তাই
 * "this month" বলে কিছু গোনার উপায় নেই। কলামটা যোগ করে দিলে পুরনো
 * সব শ্রেণির তারিখ হত migration চালানোর দিন — অর্থাৎ সংখ্যাটা সত্যি
 * দেখাত, কিন্তু হত মিথ্যা।
 *
 * ── কেন অবস্থার ছাঁকনিও নয় ─────────────────────────────────────────
 *
 * নিচের তালিকার ছাঁকনিটা (All/Active/Empty) এখানে বসালে কার্ডগুলো
 * নিজেদের উত্তরই আবার দেখাত: "Active" বাছলে Total 13 · Active 13 ·
 * Empty 0।
 *
 * ── যেটা বসেছে ─────────────────────────────────────────────────────
 *
 * ছাঁকনিটা শ্রেণি ছাঁকে না, **কোনটা "পদ" হিসেবে গোনা হবে** সেটা বদলায়:
 *
 *   All Items       — মেনুতে যা যা আছে, বন্ধ পদগুলো সহ (মালিকের চোখ)
 *   Available Only  — খদ্দের এই মুহূর্তে যা যা অর্ডার করতে পারেন
 *
 * দ্বিতীয়টায় "Menu Items" হয়ে যায় এখন-পাওয়া-যাচ্ছে এমন পদের সংখ্যা,
 * আর "Empty" হয়ে যায় "খদ্দেরের কাছে যে শ্রেণিগুলো কার্যত খালি" —
 * অর্থাৎ পদ আছে কিন্তু সবগুলো বন্ধ, এমন শ্রেণিও ওখানে ধরা পড়ে।
 * ঠিক এই সংখ্যাটাই দোকান খোলার আগে দেখা দরকার, আর ডিফল্ট দৃশ্যে
 * সেটা কোথাও দেখা যায় না।
 */
export type CategoryScope = "all" | "available";

export const DEFAULT_CATEGORY_SCOPE: CategoryScope = "all";

export function isCategoryScope(value: unknown): value is CategoryScope {
  return typeof value === "string" && ["all", "available"].includes(value);
}

export const CATEGORY_SCOPE_OPTIONS: FilterMenuOption<CategoryScope>[] = [
  { value: "all", label: "All Items" },
  // triggerLabel — pill-এ "Available Only" লম্বা হয়ে ৩২০px-এ শিরোনামের
  // ঘাড়ে চেপে বসে; popup-এ পুরো নামটাই থাকে।
  { value: "available", label: "Available Only", triggerLabel: "Available" },
];

/**
 * কার্ডের নিচের ছোট লেখাগুলো — ক্রম: Total · Active · Menu Items · Empty।
 *
 * ⚠️ hint-গুলো scope-এর সাথে বদলায়, নাহলে ছাঁকনি ঘুরিয়ে "Menu Items"
 * ৩৯ থেকে ৩১ হয়ে যেত অথচ নিচে সেই একই "Across All Categories" লেখা
 * থাকত — সংখ্যাটা কেন কমল, তার কোনো ইঙ্গিতই পর্দায় থাকত না।
 */
export const CATEGORY_SCOPE_HINTS: Record<
  CategoryScope,
  [string, string, string, string]
> = {
  all: ["All Menu Categories", "Currently Available", "Across All Categories", "No Items Added"],
  available: [
    "All Menu Categories",
    "Currently Available",
    "Available Right Now",
    "Nothing Available",
  ],
};
