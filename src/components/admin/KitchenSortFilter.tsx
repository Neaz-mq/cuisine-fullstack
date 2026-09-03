"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_KITCHEN_SORT,
  KITCHEN_SORT_OPTIONS,
  type KitchenSort,
} from "@/lib/kitchen-status";

/**
 * src/components/admin/KitchenSortFilter.tsx
 *
 * "Kitchen Display" কার্ডের শিরোনামের পাশের pill — Oldest first ·
 * Newest first · Dine in first।
 *
 * KitchenTypeFilter/InventoryCategoryFilter-এর হুবহু একই গড়ন: বোর্ডটা
 * server থেকে আসা তালিকা নিয়ে চলে, তাই এই মোড়কটার একমাত্র কাজ URL-এর
 * একটা param বদলানো।
 *
 * কেন ছাঁকনি নয়, ক্রম — যুক্তিটা `lib/kitchen-status.ts`-এ
 * `KitchenSort`-এর মাথায় লেখা।
 */
export default function KitchenSortFilter({ value }: { value: KitchenSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: KitchenSort) => {
    const params = new URLSearchParams(searchParams.toString());

    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?sort=oldest` দেখতে এমন লাগে
    // যেন কিছু বদলানো হয়েছে, অথচ হয়নি।
    if (next === DEFAULT_KITCHEN_SORT) params.delete("sort");
    else params.set("sort", next);

    // বাকি সব param অক্ষত — `q`, `status`, `type` কিছুই হারায় না।
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={KITCHEN_SORT_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Sort kitchen orders"
    />
  );
}
