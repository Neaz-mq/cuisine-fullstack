"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";
import {
  REVENUE_RANGES,
  REVENUE_RANGE_LABELS,
  type RevenueRange,
} from "@/lib/revenue-range";

/**
 * src/components/admin/dashboard/RangeSelect.tsx
 *
 * "This Week ⌄" pill — Figma-তে arrow-down আঁকা ছিল কিন্তু কোনো কিছুই
 * খুলত না। Revenue কার্ড আর Top Selling Items — দুটোতেই একই জিনিস।
 *
 * pill আর popup-এর চেহারা এখন FilterMenu-তে, এখানে নয়। এই ফাইলে
 * পড়ে থাকল কেবল **কী ঘটে** — অর্থাৎ URL-এ লেখা। আগে চেহারা আর
 * আচরণ একসাথে থাকায় DashboardFilters-এ ওই একই markup আরেকবার কপি
 * করতে হয়েছিল, আর দুটো ধীরে ধীরে আলাদা হয়ে গিয়েছিল।
 *
 * URL-এ লেখে, নিজের state-এ নয়। তাতে ছাঁকা অবস্থার link শেয়ার করা
 * যায় আর back button কাজ করে।
 *
 * ⚠️ কোন query parameter-এ লিখবে সেটা prop, হার্ডকোড নয়। এই পাতায়
 * এখন তিনটে আলাদা ছাঁকনি: `period` (Recent Orders), `revenue`
 * (chart), `top` (Top Selling Items)। একটা নাম ভাগ করে নিলে chart-এ
 * "This Year" বাছলে বাকি দুটোও নীরবে এক বছরের হয়ে যেত — অথচ কেউ
 * সেটা চায়নি।
 */

const OPTIONS: readonly FilterMenuOption<RevenueRange>[] = REVENUE_RANGES.map(
  (value) => ({ value, label: REVENUE_RANGE_LABELS[value] })
);

export default function RangeSelect({
  param,
  range,
}: {
  /** যে URL parameter-এ এই ছাঁকনির মান বসবে — "revenue", "top" … */
  param: string;
  range: RevenueRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (option: RevenueRange) => {
    const params = new URLSearchParams(searchParams.toString());
    // "week" ডিফল্ট, তাই সেটা URL-এ লেখা হয় না — পরিষ্কার link।
    if (option === "week") params.delete(param);
    else params.set(param, option);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    /**
     * ⚠️ `ml-auto` — ৩২০px-এ popup-টা পর্দার বাঁ দিকে কেটে যাওয়ার
     * আসল সমাধান এটাই, তালিকাটার নিজের কোনো class নয়।
     *
     * তালিকাটা `right-0` ধরে ঝোলে, অর্থাৎ ওর ডান কিনারা pill-এর ডান
     * কিনারায় মেলে আর ২২৪px বাঁ দিকে ছড়ায়। pill যতক্ষণ ডানে,
     * ততক্ষণ ওটা কার্ডের ভেতরেই থাকে।
     *
     * কিন্তু Top Selling Items-এর শিরোনামটা ২৪px-এ ~২০০px চওড়া, আর
     * pill ১২০ — ৩২০px পর্দায় দুটো এক সারিতে আঁটে না, তাই pill
     * দ্বিতীয় সারিতে নেমে যায়। `justify-between` একা থাকা item-কে
     * শুরুতে বসায়, অর্থাৎ pill চলে যায় একেবারে বাঁ কিনারায় — আর
     * তখন ওর ডান কিনারা থেকে ২২৪px বাঁয়ে গেলে সেটা কার্ডেরও বাইরে,
     * পর্দারও বাইরে।
     *
     * `ml-auto` থাকলে নিজের সারিতে নামলেও pill ডানেই থাকে, তাই
     * `right-0`-এর হিসাবটা আর ভাঙে না। এক সারিতে থাকা অবস্থায়
     * `justify-between` এমনিতেই যা করত, ml-auto তার সাথে সংঘাত
     * বাধায় না — Total Revenue কার্ডে (যেখানে wrap হয় না) কিছুই বদলায় না।
     *
     * ⚠️ popup এখন ১৬০ নয়, ২২৪px (Users page-এর মাপ)। ৩২০px পর্দায়
     * কার্ডের ভেতরে ২৪৮px পড়ে থাকে, তাই এখনো আঁটে — কিন্তু ফাঁকটা
     * আগের চেয়ে অনেক কম, তাই FilterMenu-র `max-w` রক্ষাকবচটা এখন
     * আগের চেয়ে বেশি প্রাসঙ্গিক।
     */
    <FilterMenu
      className="ml-auto shrink-0"
      value={range}
      options={OPTIONS}
      onSelect={select}
      ariaLabel="Period"
    />
  );
}