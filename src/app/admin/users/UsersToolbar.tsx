"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import {
  CUSTOMER_CATEGORIES,
  CATEGORY_LABELS,
  type CustomerCategory,
} from "@/lib/customer-category";

/**
 * src/app/admin/users/UsersToolbar.tsx
 *
 * Figma-র উপরের সারি: চওড়া search box + একটা "All Statuses" dropdown।
 *
 * DashboardFilters-এর মতোই সব URL-এ লেখে, নিজের state-এ নয় — ছাঁকা
 * অবস্থার link শেয়ার করা যায় আর back button কাজ করে।
 */

const ALL = "all";

export default function UsersToolbar({
  category,
}: {
  /** null মানে কোনো ছাঁকনি নেই — "All Statuses"। */
  category: CustomerCategory | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * ⚠️ শেষবার আমরা URL-কে যে মানটা ধরতে *বলেছি* — URL এই মুহূর্তে যা
   * ধরে আছে তা নয়। DashboardFilters-এ এর বিস্তারিত ব্যাখ্যা আছে;
   * সংক্ষেপে: navigation শেষ হতে সময় লাগে, আর সেই ফাঁকে searchParams
   * পুরনো থেকে যায়। সরাসরি তার সাথে তুলনা করলে দ্রুত ✕ চাপলে push-টা
   * বাদ পড়ে আর URL-এ পুরনো q আটকে থাকে।
   */
  const requestedRef = useRef(urlQuery);
  const pendingRef = useRef(false);

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // এই পাতার নিজের parameter দুটোই — page ইচ্ছাকৃতভাবে বাদ, কারণ
    // ছাঁকনি বদলে ফলাফল কমে গেলে ৫ নম্বর page-এ খালি পর্দা আসত।
    ["q", "category"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === requestedRef.current) return;
    const timer = setTimeout(() => {
      requestedRef.current = query;
      pendingRef.current = true;
      push({ q: query || null });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // back/forward চাপলে বাক্সটাও URL অনুযায়ী বদলায়। নিজের অনুরোধ পথে
  // থাকলে URL-কে বিশ্বাস করা হয় না — নাহলে মুছে ফেলা লেখাটা সাময়িকভাবে
  // ফিরে আসত।
  useEffect(() => {
    if (urlQuery === requestedRef.current) {
      pendingRef.current = false;
      return;
    }
    if (pendingRef.current) return;
    requestedRef.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
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

  return (
    /**
     * Figma: row, gap 20, উচ্চতা 56 — search box বাকি জায়গা নেয়,
     * dropdown নিজের মাপে।
     *
     * ৩২০px-এ দুটো এক সারিতে আঁটে না (search-এর ন্যূনতম প্রস্থই
     * ~২০০), তাই sm-এর নিচে উপর-নিচে।
     */
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black"
          strokeWidth={1.2}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by Customer Name, Email…"
          aria-label="Search customers by name, email or phone"
          className="h-14 w-full rounded-full bg-white pl-12 pr-4 font-sora text-[14px] leading-none text-black placeholder:text-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540]/40"
        />
      </div>

      <div className="relative shrink-0" ref={dropdownRef}>
        {/* Figma: pill 56 উঁচু, radius 100, BG #FFFFFF, লেখা Sora 400
            16px #000000। */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex h-14 w-full items-center justify-between gap-2 rounded-full bg-white px-5 font-sora text-[15px] font-normal leading-none text-black transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540]/40 sm:w-auto"
        >
          {category ? CATEGORY_LABELS[category] : "All Statuses"}
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.4}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 w-full min-w-[190px] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:w-auto"
          >
            {[ALL, ...CUSTOMER_CATEGORIES].map((option) => {
              const selected = option === ALL ? category === null : option === category;
              return (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      push({ category: option === ALL ? null : option });
                    }}
                    className={`w-full whitespace-nowrap px-4 py-2 text-left font-sora text-[13px] transition-colors hover:bg-gray-50 ${
                      selected ? "font-semibold text-[#FF4C15]" : "text-gray-700"
                    }`}
                  >
                    {option === ALL ? "All Statuses" : CATEGORY_LABELS[option as CustomerCategory]}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}