"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_TABLE_PERIOD,
  TABLE_PERIOD_OPTIONS,
  type TablePeriod,
} from "@/lib/table-period";

/**
 * src/app/admin/tables/TablePeriodFilter.tsx
 *
 * পাতলা client wrapper — Overview কার্ডগুলো server component, তাই
 * FilterMenu সরাসরি ব্যবহার করা যায় না (onSelect-এ router লাগে, আর
 * router client-only hook)। কাজটা শুধু URL-এর `period` param বদলানো।
 *
 * ⚠️ components/admin/OverviewPeriodFilter.tsx-এর হুবহু নকল, কেবল
 * তালিকাটা table-period-এর। ওটা `OverviewPeriod` type-এ বাঁধা, আর
 * generic করতে গেলে পাঁচটা পাতার wrapper-ও বদলাতে হতো — একটা নতুন
 * ছাঁকনির জন্য সেই ঝুঁকি নেওয়ার মানে হয় না।
 *
 * ⚠️ এখানে **সব** বিদ্যমান param রেখে দেওয়া হয়, TablesToolbar-এর মতো
 * `page` ফেলে দেওয়া হয় না। কারণ ওর কাজ তালিকা ছাঁকা — ছাঁকনি বদলালে
 * ফল কমে যায়। এটা তালিকার কিছুই বদলায় না, শুধু উপরের কার্ডের সংখ্যা।
 */
export default function TablePeriodFilter({ value }: { value: TablePeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: TablePeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?period=today` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ ওটাই স্বাভাবিক অবস্থা।
    if (next === DEFAULT_TABLE_PERIOD) params.delete("period");
    else params.set("period", next);

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      // pill-টা বসছে সাদা Overview কার্ডের উপরে, তাই cream — সাদা দিলে
      // পটভূমির সাথে মিশে যেত (FilterMenu-র `surface` prop দ্রষ্টব্য)।
      surface="cream"
      value={value}
      options={TABLE_PERIOD_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter overview by period"
    />
  );
}
