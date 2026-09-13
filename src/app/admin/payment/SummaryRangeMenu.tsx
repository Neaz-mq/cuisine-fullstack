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
 * ⚠️ প্রতিটা কার্ডের নিজের URL parameter (`payRange` / `shipRange`) —
 * আগে দুটোই একটা `summary` ভাগ করত, তাই একটা pill বদলালে অন্যটাও
 * বদলে যেত। কিন্তু প্রশ্ন দুটো আলাদা: "আজ কোন মাধ্যমে টাকা এল" আর
 * "এই মাসে কোন কুরিয়ারে কত গেল" একসাথে দেখতে চাওয়া খুব স্বাভাবিক।
 *
 * ⚠️ parameter-এর নামটা prop হিসেবে আসে, component-এর ভেতরে ঠিক হয় না —
 * তাহলে ভবিষ্যতে তৃতীয় কোনো সারাংশ যোগ করলে এই ফাইলে হাত দিতে হবে না।
 */
export default function SummaryRangeMenu({
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
    if (next === DEFAULT_SUMMARY_RANGE) params.delete(param);
    else params.set(param, next);
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
