"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_KITCHEN_TYPE,
  KITCHEN_TYPE_OPTIONS,
  type KitchenTypeFilter,
} from "@/lib/kitchen-status";

/**
 * src/components/admin/KitchenTypeFilter.tsx
 *
 * "Overview" কার্ডের উপরের ছাঁকনি — All Orders · Dine in · Delivery।
 *
 * OverviewPeriodFilter / InventoryCategoryFilter-এর হুবহু একই গড়ন:
 * Overview কার্ডগুলো server component, তাই FilterMenu সরাসরি ব্যবহার
 * করা যায় না (onSelect-এ router লাগে, আর router client-only hook)।
 * এই মোড়কটার একমাত্র কাজ URL-এর একটা param বদলানো।
 *
 * কেন period নয়, ধরন — সেই যুক্তিটা `lib/kitchen-status.ts`-এ
 * `KitchenTypeFilter`-এর মাথায় লেখা।
 */
export default function KitchenTypeFilter({ value }: { value: KitchenTypeFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: KitchenTypeFilter) => {
    const params = new URLSearchParams(searchParams.toString());

    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?type=all` দেখতে এমন লাগে যেন
    // কিছু ছাঁকা হয়েছে, অথচ হয়নি।
    if (next === DEFAULT_KITCHEN_TYPE) params.delete("type");
    else params.set("type", next);

    /**
     * ⚠️ বাকি সব param অক্ষত — বিশেষত `q` আর `status`। এই ছাঁকনিটা
     * নিচের বোর্ড বদলায় না, শুধু উপরের চারটে সংখ্যা; তাই কেউ কিছু
     * খুঁজতে খুঁজতে এটা বদলালে তাঁর খোঁজাটা মুছে ফেলা অকারণ ক্ষতি হতো।
     */
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={KITCHEN_TYPE_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter kitchen summary by order type"
    />
  );
}
