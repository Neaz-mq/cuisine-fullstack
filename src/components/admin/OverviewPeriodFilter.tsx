"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_OVERVIEW_PERIOD,
  OVERVIEW_PERIOD_OPTIONS,
  type OverviewPeriod,
} from "@/lib/overview-period";

/**
 * src/components/admin/OverviewPeriodFilter.tsx
 *
 * পাতলা client wrapper — Overview কার্ডগুলো server component, তাই
 * FilterMenu সরাসরি ব্যবহার করা যায় না (onSelect-এ router লাগে, আর
 * router client-only hook)। কাজটা শুধু URL-এর `period` param বদলানো।
 *
 * ⚠️ এখানে **সব** বিদ্যমান param রেখে দেওয়া হয়, RoleFilter/UsersToolbar-এর
 * মতো শুধু একটা whitelist নয়। কারণ ওদের কাজ তালিকা ছাঁকা — ছাঁকনি
 * বদলালে ফলাফল কমে যায়, তাই তারা ইচ্ছাকৃতভাবে `page` ফেলে দেয়।
 * এটা তালিকার কিছুই বদলায় না, শুধু উপরের কার্ডের সংখ্যা। কেউ ৩ নম্বর
 * page-এ থাকা অবস্থায় period বদলালে তাঁকে ১ নম্বরে ছুঁড়ে ফেলাটা
 * অকারণ ক্ষতি — যেটা তিনি দেখছিলেন সেটা তো বদলায়ইনি।
 */
export default function OverviewPeriodFilter({
  value,
  param = "period",
  surface,
}: {
  value: OverviewPeriod;
  /**
   * URL-এ কোন নামে বসবে।
   *
   * ⚠️ Suppliers পাতায় **দুটো** এমন ছাঁকনি — একটা Overview কার্ডের,
   * একটা Recent Deliveries-এর। দুটোই `period` ব্যবহার করলে একটা
   * বদলালে অন্যটাও বদলে যেত, অথচ ওরা সম্পূর্ণ আলাদা জিনিস ছাঁকে।
   */
  param?: string;
  /** pill-টা কীসের উপরে বসছে — FilterMenu-র `surface` prop দ্রষ্টব্য। */
  surface?: "cream" | "white";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: OverviewPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?period=all` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ হয়নি। বাকি ছাঁকনিগুলোও একই নিয়মে চলে।
    if (next === DEFAULT_OVERVIEW_PERIOD) params.delete(param);
    else params.set(param, next);

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      surface={surface}
      value={value}
      options={OVERVIEW_PERIOD_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter by period"
    />
  );
}
