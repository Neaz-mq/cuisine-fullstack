"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_SUMMARY_RANGE,
  SUMMARY_RANGE_OPTIONS,
  type SummaryRange,
} from "@/lib/payment-filters";

/**
 * "Payment Summary" আর "Shipping Summary" কার্ডের ডান পাশের সময়-pill।
 *
 * ⚠️ দুটো কার্ডে একটাই parameter (`summary`) — আলাদা করা যেত, কিন্তু
 * Figma-তে দুটো pill সবসময় একই মান দেখায় ("Today"), আর কার্ড দুটো
 * একই প্রশ্নের দুই কাটাকাটি: "এই সময়ে কোন মাধ্যমে কত এল"। আলাদা
 * parameter হলে একটায় "আজ" আর অন্যটায় "এই মাস" রেখে দুটো সংখ্যা
 * পাশাপাশি দেখে ভুল তুলনা করার সুযোগ থাকত।
 */
export default function SummaryRangeMenu({ value }: { value: SummaryRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: SummaryRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_SUMMARY_RANGE) params.delete("summary");
    else params.set("summary", next);
    // ⚠️ `page` মোছা হয় না — সারাংশের সময়সীমা নিচের তালিকার একটা সারিও
    // বদলায় না, তাই staff-কে পৃষ্ঠা ১-এ ফেরত পাঠানো অকারণ।
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      surface="white"
      value={value}
      options={SUMMARY_RANGE_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter summary by time range"
    />
  );
}
