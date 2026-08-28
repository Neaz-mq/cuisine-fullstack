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
 * src/components/admin/dashboard/RevenueRangeSelect.tsx
 *
 * Revenue কার্ডের "This Week ⌄" pill — Figma-তে arrow-down আঁকা ছিল
 * কিন্তু কোনো কিছুই খুলত না।
 *
 * DashboardFilters-এর মতোই URL-এ লেখে, নিজের state-এ নয়। তাতে
 * ছাঁকা অবস্থার link শেয়ার করা যায় আর back button কাজ করে।
 *
 * ⚠️ Query parameter `revenue`, `period` নয়। একই পাতায় Recent
 * Orders-এর নিজস্ব `period` ছাঁকনি আছে — দুটো এক নাম ব্যবহার করলে
 * chart-এ "This Year" বাছলে নিচের order তালিকাও নীরবে এক বছরের হয়ে
 * যেত, অথচ কেউ সেটা চায়নি।
 */
export default function RevenueRangeSelect({ range }: { range: RevenueRange }) {
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
    if (option === "week") params.delete("revenue");
    else params.set("revenue", option);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Figma Layout: Hug 120×40, radius 100, padding 12, gap 8,
          BG #F9F6F3। লেখা Sora 400 14px #000000, icon 16×16। */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Revenue period: ${REVENUE_RANGE_LABELS[range]}`}
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
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
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