"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  CATEGORY_SCOPE_OPTIONS,
  DEFAULT_CATEGORY_SCOPE,
  type CategoryScope,
} from "@/lib/category-scope";

/**
 * src/components/admin/CategoryScopeFilter.tsx
 *
 * Categories পাতার Overview কার্ডের মাথার pill — পাতলা client wrapper,
 * ঠিক `OverviewPeriodFilter`-এর মতোই (Overview কার্ড server component,
 * তাই FilterMenu সরাসরি বসানো যায় না: onSelect-এ router লাগে)।
 *
 * কোনটা কী ছাঁকে তার ব্যাখ্যা `lib/category-scope.ts`-এ।
 *
 * ⚠️ `page` param ইচ্ছাকৃতভাবে অক্ষত রাখা হয়। এই ছাঁকনিটা নিচের
 * তালিকার একটা সারিও বদলায় না — শুধু উপরের চারটে সংখ্যা। কেউ ৩ নম্বর
 * page-এ থেকে scope বদলালে তাঁকে ১ নম্বরে ছুঁড়ে ফেলাটা অকারণ ক্ষতি
 * হতো। তালিকা-ছাঁকনিগুলো (CategoryListFilter, CategoriesToolbar) উল্টো
 * নিয়মে চলে, আর সেটাও ইচ্ছাকৃত — ওরা ফল কমিয়ে দেয়।
 */
export default function CategoryScopeFilter({ value }: { value: CategoryScope }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: CategoryScope) => {
    const params = new URLSearchParams(searchParams.toString());

    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?scope=all` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ হয়নি। বাকি ছাঁকনিগুলোও একই নিয়মে চলে।
    if (next === DEFAULT_CATEGORY_SCOPE) params.delete("scope");
    else params.set("scope", next);

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={CATEGORY_SCOPE_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter overview by item availability"
    />
  );
}
