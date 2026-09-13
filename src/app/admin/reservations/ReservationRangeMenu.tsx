"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_OVERVIEW_RANGE,
  OVERVIEW_RANGE_OPTIONS,
  type SummaryRange,
} from "@/lib/payment-filters";

/**
 * Overview আর Reservations — দুটো কার্ডের সময়-pill।
 *
 * ⚠️ সময়সীমার তালিকাটা (All Over / Today / This Week / This Month)
 * Payment পাতার সাথে ভাগ করা, কারণ "কোন সময়ের হিসাব" প্রশ্নটা দুই
 * পাতায় হুবহু এক। অবস্থার তালিকাটা ভাগ করা হয়নি — ওটা সত্যিই আলাদা।
 *
 * ⚠️ parameter-এর নাম prop হিসেবে আসে, তাই দুটো কার্ড একই component
 * ব্যবহার করেও আলাদা আলাদা ছাঁকে।
 */
export default function ReservationRangeMenu({
  value,
  param,
}: {
  value: SummaryRange;
  param: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: SummaryRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_OVERVIEW_RANGE) params.delete(param);
    else params.set(param, next);
    // তালিকার ছাঁকনি বদলালে পৃষ্ঠা ১-এ ফেরা দরকার, Overview-রটায় নয়।
    if (param === "list") params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      surface="cream"
      value={value}
      options={OVERVIEW_RANGE_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter by time range"
    />
  );
}
