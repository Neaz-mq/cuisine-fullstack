"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_CATEGORY_FILTER,
  type CategoryFilter,
} from "@/lib/category-filter";

/**
 * src/app/admin/categories/CategoryListFilter.tsx
 *
 * "Categories" কার্ডের শিরোনামের পাশের pill।
 *
 * ⚠️ ছাঁকনির তালিকা আর ধ্রুবক এখানে **নেই**, `lib/category-filter.ts`-এ —
 * এই ফাইলটা `"use client"`, আর ওখান থেকে component ছাড়া কিছু
 * server-এ ব্যবহার করা যায় না।
 *
 * ⚠️ Figma-তে pill দুটো — একটা Overview-র মাথায়, একটা এখানে। কিন্তু
 * Overview-রটা বসানো যায় না: `Category`-তে কোনো তারিখের মাঠ নেই, আর
 * অবস্থা দিয়ে ছাঁকলে ওখানকার কার্ডগুলো নিজেদের উত্তরই আবার দেখাত
 * ("Active" বাছলে Total 5 · Active 5 · Empty 0)। ছাঁকনিটা তাই কেবল
 * এখানে, যেখানে ওটা সত্যিই তালিকা ছোট করে।
 */
export default function CategoryListFilter({ value }: { value: CategoryFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: CategoryFilter) => {
    const params = new URLSearchParams(searchParams.toString());

    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?filter=all` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ হয়নি।
    if (next === DEFAULT_CATEGORY_FILTER) params.delete("filter");
    else params.set("filter", next);

    /**
     * ⚠️ ছাঁকনি বদলালে page ১-এ ফেরত। ৩ নম্বর page-এ থেকে "Empty"
     * বাছলে ফল হয়তো একটাই — তখন ৩ নম্বর page বলে কিছু থাকে না, আর
     * ব্যবহারকারী একটা খালি পাতা দেখতেন। Inventory-র শ্রেণি-ছাঁকনিতে
     * এই সমস্যা নেই, কারণ ওটা তালিকা ছোঁয় না; এটা ছোঁয়।
     */
    params.delete("page");

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={CATEGORY_FILTER_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter categories"
    />
  );
}
