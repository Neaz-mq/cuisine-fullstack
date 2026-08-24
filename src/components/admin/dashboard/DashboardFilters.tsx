"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import {
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

/**
 * src/components/admin/dashboard/DashboardFilters.tsx
 *
 * Recent Orders কার্ডের search box আর period dropdown।
 *
 * দুটোই URL-এ লেখে (?q= / ?period=), component-এর নিজের state-এ নয়।
 * ফলে ছাঁকা অবস্থার একটা link শেয়ার করা যায়, back button কাজ করে, আর —
 * সবচেয়ে জরুরি — Export button ঠিক ওই একই URL parameter গুলো API-তে
 * পাঠাতে পারে, অর্থাৎ যা দেখা যাচ্ছে ঠিক তা-ই নামে।
 */
export default function DashboardFilters({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pushParams = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    // ছাঁকনি বদলালে সবসময় প্রথম page — নাহলে ৬ নম্বর page-এ থাকা অবস্থায়
    // "Today" বেছে নিলে ফলাফল ৩ page হলে খালি পর্দা আসত।
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  };

  // প্রতিটা keystroke-এ নতুন URL push করলে server component প্রতিবার
  // নতুন করে render হতো। ৪০০ms থামলে তবেই — /admin/orders-এর
  // OrdersToolbar-এ একই আচরণ।
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== (searchParams.get("q") ?? "")) {
        pushParams({ q: query || null });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search recent orders by customer name or email"
          className="w-32 rounded-full bg-[#F9F6F3] py-2.5 pl-9 pr-3 font-sora text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540]/40 md:w-44"
        />
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 rounded-full bg-[#F9F6F3] px-4 py-2.5 font-sora text-[13px] text-gray-700 transition-colors hover:bg-gray-100"
        >
          {PERIOD_LABELS[period]}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            {DASHBOARD_PERIODS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option === period}
                  onClick={() => {
                    setOpen(false);
                    // "all" ডিফল্ট নয় — ডিফল্ট "today", তাই সেটাকেই URL
                    // থেকে বাদ দেওয়া হয়, বাকিগুলো লেখা হয়।
                    pushParams({ period: option === "today" ? null : option });
                  }}
                  className={`w-full px-4 py-2 text-left font-sora text-[13px] transition-colors hover:bg-gray-50 ${
                    option === period ? "font-semibold text-[#FF4C15]" : "text-gray-700"
                  }`}
                >
                  {PERIOD_LABELS[option]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}