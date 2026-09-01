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
  mobileStack = false,
}: {
  /** যে URL parameter-এ এই ছাঁকনির মান বসবে — "revenue", "top" … */
  param: string;
  range: RevenueRange;
  /**
   * ⚠️ Top Selling Items কার্ডের জন্য যোগ করা — মোবাইলে (৩২০–৬৩৯px)
   * এই কার্ডের header এখন শিরোনাম আর filter আলাদা সারিতে (দেখুন
   * admin/page.tsx), অর্থাৎ pill-টা title-এর *নিচে*, ডান পাশে নয়।
   *
   * `false` (ডিফল্ট) থাকলে আগের আচরণ অবিকল থাকে — `ml-auto` সবসময়
   * সক্রিয়, popup ডান কিনারা ধরে ঝোলে। Total Revenue কার্ড এখনো এই
   * ডিফল্ট ব্যবহার করে, কারণ ওর header সবসময় এক সারিতেই থাকে
   * (মোবাইলেও পাশাপাশি) — সেখানে `ml-auto`/`right-0` ছাড়া pill
   * শিরোনামের সাথে বাঁ দিকে লেগে যেত।
   *
   * `true` হলে মোবাইলে `ml-auto` বাদ যায় (pill title-এর মতোই বাঁ
   * কিনারায় বসে, Figma-র মোবাইল মকআপ অনুযায়ী) আর popup বাঁ কিনারা
   * ধরে ঝোলে যাতে পর্দার বাইরে না যায়। ≥৬৪০px-এ header আবার এক
   * সারিতে ফেরে (sm:flex-row), তাই সেখানে `sm:ml-auto`/ডান-কিনারা
   * popup-ও আগের মতো ফিরে আসে।
   */
  mobileStack?: boolean;
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
     * ⚠️ default path (`mobileStack === false`)-এর জন্য `ml-auto` +
     * `right-0` — Total Revenue কার্ডে এখনো এভাবেই চলে, header সবসময়
     * এক সারিতে (মোবাইলেও পাশাপাশি) বলে pill-কে জোর করে ডানে রাখতে
     * হয়, নাহলে `justify-between` একা থাকা item-কে শুরুতে বসিয়ে
     * দিত। popup তখন pill-এর ডান কিনারা ধরে বাঁ দিকে ২২৪px ছড়ায় —
     * pill ডানে থাকলে সেটা সবসময় কার্ডের ভেতরেই পড়ে।
     *
     * `mobileStack === true` (Top Selling Items) পথে ওপরের JSDoc
     * দ্রষ্টব্য — মোবাইলে header নিজেই দু'সারিতে ভাগ হয়ে যায় বলে
     * এই জোরাজুরির দরকার পড়ে না, `sm:` প্রিফিক্সে সরিয়ে দেওয়া হয়েছে।
     *
     * popup ২২৪px চওড়া (Users page-এর মাপ), FilterMenu-র `max-w`
     * শেষ রক্ষাকবচ হিসেবে থেকেই যায়।
     */
    <FilterMenu
      // ⚠️ `sm:` নয়, `min-[640px]:` — globals.css-এ
      // `--breakpoint-sm: 320px`, তাই `sm:` এই অ্যাপে ৩২০px থেকেই
      // সক্রিয়, অথচ এই stack↔row বদলটা ৬৪০-এ হওয়ার কথা। বিস্তারিত
      // admin/page.tsx-এর "Top Selling Items" header-এর মন্তব্যে।
      className={mobileStack ? "shrink-0 min-[640px]:ml-auto" : "ml-auto shrink-0"}
      menuPositionClassName={mobileStack ? "left-0 min-[640px]:right-0" : "right-0"}
      value={range}
      options={OPTIONS}
      onSelect={select}
      ariaLabel="Period"
    />
  );
}