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
/**
 * Recent Orders কার্ড নিজে যে দুটো URL parameter চালায়।
 *
 * বাকি দুটো — `revenue` (Revenue chart) আর `top` (Top Selling Items) —
 * অন্য কার্ডের, তাই এখান থেকে কিছু বদলালে ওগুলো URL-এ থাকে না।
 *
 * ⚠️ `period` কিন্তু রাখতেই হবে, বাদ দেওয়া চলবে না। ওটাও এই কার্ডেরই
 * ছাঁকনি, আর "All time" অবস্থায় কেউ কোনো পুরনো গ্রাহকের নাম খুঁজলে
 * period যদি নীরবে "Today"-তে ফিরে যেত, তাহলে যে অর্ডারটা খুঁজছেন
 * ঠিক সেটাই তালিকা থেকে ছেঁকে বাদ পড়ত — খোঁজার ফল শূন্য, অথচ
 * কারণটা পর্দায় কোথাও লেখা নেই।
 */
const OWN_PARAMS = ["q", "period"] as const;

export default function DashboardFilters({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** URL এই মুহূর্তে যা ধরে আছে। */
  const urlQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * ⚠️ শেষবার আমরা URL-কে যে মানটা ধরতে *বলেছি* — URL এই মুহূর্তে যা
   * ধরে আছে তা নয়। এই পার্থক্যটাই এখানকার আসল কথা।
   *
   * আগে তুলনাটা হতো সরাসরি `searchParams`-এর সাথে, আর তাতেই একটা
   * নীরব বাগ ছিল:
   *
   *   ০ms    "naim" টাইপ করা হলো
   *   ৪০০ms  ?q=naim push করা হলো — কিন্তু navigation সাথে সাথে শেষ
   *          হয় না, এই পাতাটা প্রায় পনেরোটা Prisma query চালায়
   *   ৫০০ms  ব্যবহারকারী ✕ চেপে বাক্সটা খালি করলেন
   *   ৯০০ms  debounce জাগল। searchParams এখনো পুরনো (q নেই), আর
   *          query-ও খালি — অর্থাৎ "কোনো পরিবর্তন নেই" মনে করে
   *          push-টা বাদ দেওয়া হলো
   *   ১২০০ms আগের navigation এসে পৌঁছল, URL হয়ে গেল ?q=naim
   *
   * ফল: বাক্স খালি, অথচ তালিকা ছাঁকা, আর URL-এ q আটকে আছে। তারপর
   * refresh করলে বাক্সে আবার "naim" ফিরে আসত — কারণ URL কখনো
   * পরিষ্কারই হয়নি। "বাতিল করলেও থেকে যায়" আর "refresh করলে
   * ডিফল্টে ফেরে না" — দুটোই আসলে এই একটাই ঘটনা।
   *
   * নিজের অনুরোধের সাথে তুলনা করলে navigation কতক্ষণ নিচ্ছে তাতে
   * কিছু আসে যায় না।
   */
  const requestedRef = useRef(urlQuery);

  /** আমাদের শেষ অনুরোধটা এখনো পথে আছে কিনা। */
  const pendingRef = useRef(false);

  const pushParams = (changes: Record<string, string | null>) => {
    /**
     * ⚠️ পুরনো URL-টা হুবহু কপি করা হয় না — কেবল এই কার্ডের নিজের
     * parameter গুলোই রাখা হয় (OWN_PARAMS), বাকি সব ঝেড়ে ফেলা হয়।
     *
     * ফলে "This Month" অবস্থায় খুঁজলে URL হয় `/admin?q=naim`,
     * `/admin?revenue=month&q=naim` নয় — অর্থাৎ খোঁজা শুরু করলেই
     * পাতাটা তার ডিফল্ট চেহারায় ফেরে।
     *
     * `page`-ও এই কারণেই বাদ পড়ে: ৬ নম্বর page-এ থাকা অবস্থায় নতুন
     * ছাঁকনি বসালে ফলাফল যদি ৩ page হয়, তাহলে খালি পর্দা আসত।
     */
    const params = new URLSearchParams();
    OWN_PARAMS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });

    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    /**
     * `{ scroll: false }` — Pagination আর RangeSelect-এর মতোই।
     * এটা ছাড়া প্রতিটা URL বদলের পরে পাতাটা একেবারে উপরে লাফ দিত,
     * অর্থাৎ টাইপ করতে করতেই যে table-টা দেখছিলেন সেটা পর্দা থেকে
     * হারিয়ে যেত।
     */
    router.push(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };

  // প্রতিটা keystroke-এ নতুন URL push করলে server component প্রতিবার
  // নতুন করে render হতো। ৪০০ms থামলে তবেই — /admin/orders-এর
  // OrdersToolbar-এ একই আচরণ।
  useEffect(() => {
    // যা চাওয়া হয়েছিল তা-ই লেখা আছে — কিছু করার নেই। মনে রাখতে হবে,
    // এখানে খালি করাটাও একটা পরিবর্তন: "" ≠ "naim", তাই ✕ চাপলে
    // push হবেই।
    if (query === requestedRef.current) return;

    const timer = setTimeout(() => {
      requestedRef.current = query;
      pendingRef.current = true;
      pushParams({ q: query || null });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /**
   * উল্টো দিক: URL বাইরে থেকে বদলালে বাক্সটাও যেন বদলায়।
   *
   * সবচেয়ে সাধারণ ঘটনা back/forward button — ছাঁকা অবস্থা থেকে পিছিয়ে
   * এলে তালিকা তো ভরে যেত, কিন্তু বাক্সে পুরনো লেখাটা বসে থাকত, কারণ
   * `useState`-এর প্রাথমিক মানটা কেবল mount-এর সময় একবারই পড়া হয়।
   *
   * ⚠️ নিজের অনুরোধ পথে থাকলে URL-কে বিশ্বাস করা যাবে না — উপরের
   * দৃশ্যে ১২০০ms-এ URL সাময়িকভাবে "naim" হয়, অথচ ব্যবহারকারী ততক্ষণে
   * বাক্সটা খালি করে ফেলেছেন। ওই মুহূর্তে সিঙ্ক করলে "naim" আবার
   * বাক্সে ফিরে আসত।
   */
  useEffect(() => {
    if (urlQuery === requestedRef.current) {
      // আমাদের অনুরোধ পৌঁছে গেছে, এখন থেকে URL-ই সত্য।
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
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    // Figma: row, justify flex-end, gap 10, উচ্চতা 40।
    <div className="flex items-center gap-2.5">
      {/* Figma: 122×40 pill, radius 100, BG #F9F6F3, padding 12, gap 8।
          Icon 16×16 কালো, placeholder Sora 400 14px Black/70। */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black"
          strokeWidth={1.2}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search recent orders by name, email or order ID"
          /**
           * বিশ্রামে ঠিক Figma-র ১২২px, কিন্তু focus করলে ২২০ —
           * মকআপে ওটা নিছক একটা ছবি, বাস্তবে ওখানে গ্রাহকের নাম টাইপ
           * করতে হয়। ১২২-এ icon আর padding বাদ দিলে লেখার জন্য ৭৪px
           * পড়ে থাকে, অর্থাৎ "Md. Rai" পর্যন্ত দেখা যেত।
           */
          className="h-10 w-[122px] rounded-full bg-[#F9F6F3] pl-9 pr-3 font-sora text-[14px] leading-none text-black transition-[width] duration-200 placeholder:text-black/70 focus:w-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540] focus-visible:ring-offset-0"
        />
      </div>

      <div className="relative" ref={dropdownRef}>
        {/* Figma: 91×40 pill, একই BG/radius, লেখা Sora 400 14px
            Black/100, arrow 16×16। */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex h-10 items-center gap-2 rounded-full bg-[#F9F6F3] px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540] focus-visible:ring-offset-0"
        >
          {PERIOD_LABELS[period]}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.2}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
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