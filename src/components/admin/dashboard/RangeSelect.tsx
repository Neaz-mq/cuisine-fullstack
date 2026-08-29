"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
 * DashboardFilters-এর মতোই URL-এ লেখে, নিজের state-এ নয়। তাতে
 * ছাঁকা অবস্থার link শেয়ার করা যায় আর back button কাজ করে।
 *
 * ⚠️ কোন query parameter-এ লিখবে সেটা prop, হার্ডকোড নয়। এই পাতায়
 * এখন তিনটে আলাদা ছাঁকনি: `period` (Recent Orders), `revenue`
 * (chart), `top` (Top Selling Items)। একটা নাম ভাগ করে নিলে chart-এ
 * "This Year" বাছলে বাকি দুটোও নীরবে এক বছরের হয়ে যেত — অথচ কেউ
 * সেটা চায়নি।
 */
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

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape — keyboard user-এর বেরোনোর পথ।
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (option: RevenueRange) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    // "week" ডিফল্ট, তাই সেটা URL-এ লেখা হয় না — পরিষ্কার link।
    if (option === "week") params.delete(param);
    else params.set(param, option);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    /**
     * ⚠️ `ml-auto` — ৩২০px-এ dropdown-টা পর্দার বাঁ দিকে কেটে যাওয়ার
     * আসল সমাধান এটাই, তালিকাটার নিজের কোনো class নয়।
     *
     * তালিকাটা `right-0` ধরে ঝোলে, অর্থাৎ ওর ডান কিনারা pill-এর ডান
     * কিনারায় মেলে আর ১৬০px বাঁ দিকে ছড়ায়। pill যতক্ষণ ডানে,
     * ততক্ষণ ওটা কার্ডের ভেতরেই থাকে।
     *
     * কিন্তু Top Selling Items-এর শিরোনামটা ২৪px-এ ~২০০px চওড়া, আর
     * pill ১২০ — ৩২০px পর্দায় দুটো এক সারিতে আঁটে না, তাই pill
     * দ্বিতীয় সারিতে নেমে যায়। `justify-between` একা থাকা item-কে
     * শুরুতে বসায়, অর্থাৎ pill চলে যায় একেবারে বাঁ কিনারায় — আর
     * তখন ওর ডান কিনারা থেকে ১৬০px বাঁয়ে গেলে সেটা কার্ডেরও বাইরে,
     * পর্দারও বাইরে।
     *
     * `ml-auto` থাকলে নিজের সারিতে নামলেও pill ডানেই থাকে, তাই
     * `right-0`-এর হিসাবটা আর ভাঙে না। এক সারিতে থাকা অবস্থায়
     * `justify-between` এমনিতেই যা করত, ml-auto তার সাথে সংঘাত
     * বাধায় না — Total Revenue কার্ডে (যেখানে wrap হয় না) কিছুই বদলায় না।
     */
    <div className="relative ml-auto shrink-0" ref={dropdownRef}>
      {/* Figma Layout: Hug 120×40, radius 100, padding 12, gap 8,
          BG #F9F6F3। লেখা Sora 400 14px #000000, icon 16×16। */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Period: ${REVENUE_RANGE_LABELS[range]}`}
        className="flex h-10 items-center gap-2 rounded-full bg-[#F9F6F3] px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540]/40"
      >
        {REVENUE_RANGE_LABELS[range]}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          /* max-w — শেষ রক্ষাকবচ। ৩২০px-এ কার্ডের ভেতরে ২৪৮px পড়ে
             থাকে, তাই ১৬০px দিব্যি আঁটে; কিন্তু ভবিষ্যতে কেউ এই
             pill-টা আরও সরু কোনো জায়গায় বসালে তালিকাটা যেন নীরবে
             উপচে না পড়ে। */
          className="absolute right-0 z-20 mt-2 w-40 max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
        >
          {REVENUE_RANGES.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === range}
                onClick={() => select(option)}
                className={`w-full px-4 py-2 text-left font-sora text-[13px] transition-colors hover:bg-gray-50 ${
                  option === range ? "font-semibold text-[#FF4C15]" : "text-gray-700"
                }`}
              >
                {REVENUE_RANGE_LABELS[option]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}