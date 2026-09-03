import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/category-filter.ts
 *
 * Categories তালিকার ছাঁকনির একমাত্র উৎস।
 *
 * ⚠️ আলাদা ফাইল হওয়ার কারণ গোছানো নয়, বাধ্যতা। এগুলো প্রথমে
 * `CategoryListFilter.tsx`-এ ছিল, আর সেই ফাইলের মাথায় `"use client"` —
 * তাতে `page.tsx` (server component) থেকে ধ্রুবক বা যাচাই-function
 * ব্যবহার করলেই Next.js থামিয়ে দিত:
 *
 *   Attempted to call … from the server but … is on the client.
 *
 * `"use client"` ফাইল থেকে কেবল **component** সীমা পেরোতে পারে।
 * Kitchen-এ ঠিক এই ভুলটাই একবার হয়েছে, তাই এবার আগেই সরানো।
 *
 * `lib/kitchen-status.ts` আর `lib/inventory-status.ts` একই কারণে
 * একইভাবে সাজানো।
 */
export type CategoryFilter = "all" | "active" | "empty";

export const DEFAULT_CATEGORY_FILTER: CategoryFilter = "all";

export function isCategoryFilter(value: unknown): value is CategoryFilter {
  return typeof value === "string" && ["all", "active", "empty"].includes(value);
}

export const CATEGORY_FILTER_OPTIONS: FilterMenuOption<CategoryFilter>[] = [
  { value: "all", label: "All" },
  /**
   * "Active" মানে অন্তত একটা পদ **এখন পাওয়া যাচ্ছে** (`isAvailable`),
   * শুধু "পদ আছে" নয়। শ্রেণিতে পাঁচটা পদ থাকলেও সবগুলো বন্ধ থাকলে
   * খদ্দের মেনুতে ওই শ্রেণিটা কার্যত খালি দেখেন — তাই সেটাকে
   * "Active" বলা ভুল হতো।
   */
  { value: "active", label: "Active" },
  // একটাও পদ নেই — মেনু গোছানোর সময় এগুলোই আগে চোখে পড়া দরকার।
  { value: "empty", label: "Empty" },
];
