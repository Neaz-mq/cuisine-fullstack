"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_OVERVIEW_RANGE,
  OVERVIEW_RANGE_OPTIONS,
  type SummaryRange,
} from "@/lib/payment-filters";

/**
 * Overview কার্ডের ডান পাশের "All Over" pill।
 *
 * ⚠️ নিজের URL parameter (`overview`) — নিচের দুটো সারাংশের ছাঁকনির
 * থেকে আলাদা। তিনটে কার্ড তিনটে আলাদা প্রশ্নের উত্তর দেয়, তাই একটা
 * বদলালে বাকিগুলো বদলানো উচিত নয়।
 */
export default function OverviewRangeMenu({ value }: { value: SummaryRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: SummaryRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_OVERVIEW_RANGE) params.delete("overview");
    else params.set("overview", next);
    // ⚠️ `page` মোছা হয় না — Overview-র সময়সীমা নিচের তালিকার একটা
    // সারিও বদলায় না, তাই পৃষ্ঠা ১-এ ফেরত পাঠানো অকারণ।
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      surface="cream"
      value={value}
      options={OVERVIEW_RANGE_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter overview by time range"
    />
  );
}
