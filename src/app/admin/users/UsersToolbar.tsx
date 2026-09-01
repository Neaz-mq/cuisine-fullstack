"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { useScreenTier } from "@/components/admin/useScreenTier";
import {
  CUSTOMER_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SHORT_LABELS,
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

/**
 * Focus চিহ্ন — search box আর dropdown দুটোতেই এক।
 *
 * ⚠️ এখানে `ring-*` ব্যবহার করা হয় না, যদিও dashboard-এর ছাঁকনিগুলোয়
 * হয়। কারণটা এই দুটো নিয়ন্ত্রণের পটভূমিতে:
 *
 *   dashboard-এ  →  ছাঁকনিগুলো cream (#F9F6F3), বসে আছে সাদা কার্ডে
 *   এখানে        →  ছাঁকনিগুলো সাদা, বসে আছে cream পাতায়
 *
 * Tailwind-এর ring আসলে একটা box-shadow, আর সেটা দুই স্তরের: প্রথমে
 * `ring-offset-color` (ডিফল্টে **সাদা**), তার বাইরে আসল রঙ। প্রথম
 * স্তরটা শূন্য চওড়া হলেও ওই সাদাটা pill-এর কিনারায় আধা-পিক্সেল ধরে
 * থেকে যায়। সাদা কার্ডের উপরে সেটা চোখেই পড়ে না — সাদার উপর সাদা।
 * কিন্তু এখানে চারপাশ cream, আর সাদা pill-এর বাইরে ওই সাদা রেখাটা
 * কমলার আগে একটা আলাদা ফাঁক হয়ে ফুটে ওঠে।
 *
 * outline-এ ওই offset স্তরটাই নেই। আর ঋণাত্মক offset দিয়ে সেটা
 * pill-এর কিনারার সামান্য *ভেতরে* আঁকা হয়, ফলে বাইরে কোনো ফাঁক
 * জ্যামিতিকভাবেই সম্ভব নয় — বাক্সটা নিজেই কমলা হয়ে ওঠে।
 *
 * শর্টহ্যান্ড class-এর বদলে সরাসরি CSS লেখা, কারণ outline-এর
 * শর্টহ্যান্ড Tailwind v3 আর v4-এ আলাদা আচরণ করে (v3-এ `outline` মানে
 * width, v4-এ style)। এভাবে লিখলে কোন সংস্করণ চলছে তাতে কিছু আসে যায় না।
 *
 * ⚠️ এটা সাজসজ্জা নয়, keyboard দিয়ে চালানোর একমাত্র সূত্র — `focus`
 * নয়, `focus-visible`, তাই mouse দিয়ে click করলে চিহ্নটা আসে না,
 * কেবল Tab চাপলে।
 */
const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

/**
 * Placeholder — দুটো রূপ।
 *
 * ⚠️ এটা CSS দিয়ে করা যায় না, আর সেটাই এখানে JS ব্যবহারের একমাত্র
 * কারণ: placeholder একটা **attribute**, element-এর ভেতরের লেখা নয়।
 * `::placeholder`-এ font-size বা রঙ বদলানো যায়, কিন্তু `content`
 * কাজ করে না। লেখাটাই বদলাতে হলে JS-কে জানতে হয় পর্দা কত চওড়া।
 *
 * ⚠️ সীমানাটা lg (১০২৪), আর সেটাই এখানকার সবচেয়ে ভুল বোঝার মতো
 * জায়গা — মনে হতে পারে tablet-এ তো জায়গা আছেই। নেই, কারণ ৪৮০ থেকে
 * "All Statuses" pill পাশে চলে আসে আর ইনপুট **উল্টো সরু হয়ে যায়**।
 * ভেতরে লেখার জায়গা:
 *
 *   ৩২০  (ইনপুট একা)   → 288 − 44 − 16        = 228px
 *   ৪৮০  (pill সহ)     → 448 − 156 − 24 − 60  = 208px   ← সবচেয়ে কম
 *   ৭৬৮  (pill সহ)     → 736 − 156 − 24 − 60  = 496px
 *   ১০২৪+              → sidebar বাদেও যথেষ্ট
 *
 * ৭৬৮-এ ৪৯৬px থাকলেও পুরো Figma লেখাটা (~২৫৭px) দিব্যি আঁটত। তবু
 * ছোট রাখা হলো, কারণ একটাই সীমানা মনে রাখা সহজ, আর tablet-এ
 * ছাঁকনি-সারিটা এমনিতেই ঠাসা। মাঝের ধাপে ছাঁটা একটা তৃতীয় লেখা
 * ছিল — বাদ দেওয়া হলো, তিনটে রূপ রাখার মতো যথেষ্ট কারণ ছিল না।
 *
 * ⚠️ ছোট লেখা মানে কম তথ্য, তাই `aria-label`-টা সব পর্দাতেই পুরো
 * থাকে — screen reader ব্যবহারকারী কখনোই কেবল "Search" শোনেন না।
 */
const FULL_PLACEHOLDER = "Search by Customer Name, Email…";
const SHORT_PLACEHOLDER = "Search";

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

  /**
   * ধাপটা এখানে হিসাব করা হয় না — useScreenTier-এ। AdminTopbar-এও
   * ঠিক একই মাপ লাগে, আর দুই জায়গায় দুটো matchMedia রাখলে একদিন
   * একটার সীমানা বদলে অন্যটা পিছিয়ে থাকত।
   */
  const tier = useScreenTier();

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // এই পাতার নিজের parameter — page ইচ্ছাকৃতভাবে বাদ, কারণ ছাঁকনি
    // বদলে ফলাফল কমে গেলে ৫ নম্বর page-এ খালি পর্দা আসত।
    //
    // ⚠️ `period` তালিকার ছাঁকনি নয় (ওটা উপরের Overview কার্ডের),
    // কিন্তু এখানে না রাখলে search বা category বদলালেই সেটা নীরবে
    // "All"-এ ফিরে যেত।
    ["q", "category", "period"].forEach((key) => {
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
     * Figma (Frame 2147236295): row, gap 24, উচ্চতা 50,
     * align-items flex-start। search box `flex-grow: 1`, pill
     * `flex: none` — অর্থাৎ বাক্সটাই বাকি জায়গা নেয়।
     *
     * ৩২০px-এ দুটো এক সারিতে আঁটে না (শুধু pill-ই ১৫৬), তাই ছোট
     * পর্দায় উপর-নিচে — ওখানে gap 24 বাড়াবাড়ি, তাই 12।
     *
     * ⚠️ এখানে `sm:` ব্যবহার করা যায় না, আর সেটাই এই ফাইলের সবচেয়ে
     * সহজে ভুল হওয়ার মতো জায়গা। globals.css-এ
     * `--breakpoint-sm: 320px` — Tailwind-এর ডিফল্ট ৬৪০ নয়। অর্থাৎ
     * `sm:` মানে "৩২০ থেকে", আর ৩২০-এর চেয়ে সরু পর্দা বাস্তবে নেই,
     * তাই `sm:` কার্যত **সবসময়ই** চালু। আগে এখানে `sm:flex-row` ছিল
     * আর সেই কারণেই ৩২০px-এ দুটো পাশাপাশি বসত: search box চেপে গিয়ে
     * "Sear…" হয়ে যেত আর pill-টা কিনারা ছাড়িয়ে যেত।
     *
     * তাই স্পষ্ট করে ৪৮০ লেখা। হিসাবটা: ৪৮০ − ৩২ (shell-এর padding)
     * = ৪৪৮, তার থেকে pill ১৫৬ আর gap ২৪ বাদ দিলে search পায় ২৬৮ —
     * placeholder-টা কাটলেও টাইপ করার মতো যথেষ্ট। ৩২০-এ ওটাই দাঁড়াত
     * ১০৮।
     */
    <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:gap-6">
      {/**
       * Figma: padding 16, gap 8, radius 100, BG #FFFFFF, উচ্চতা 50।
       *
       * icon-টা flex-এর ভেতরের প্রথম item, তাই লেখা শুরু হয়
       * 16 (padding) + 20 (icon) + 8 (gap) = 44px-এ → `pl-11`।
       * এখানে icon-টা absolute, কারণ <input>-এর ভেতরে সত্যিকারের
       * flex child বসানো যায় না — কিন্তু মাপটা এক।
       */}
      <div className="relative h-[50px] min-w-0 flex-1">
        {/* vuesax/linear/search-normal — 20×20, stroke 1.5,
            Black/100 (#000000)। */}
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tier === "wide" ? FULL_PLACEHOLDER : SHORT_PLACEHOLDER}
          aria-label="Search customers by name, email or phone"
          /* Figma type: Sora 400, 16px, line-height 100%, Black/70।
             লেখা আর placeholder দুটোরই — তাই `text-black/70`, আর
             একটা কঠিন ধূসর নয় (cream পটভূমিতে ওটা অন্যরকম বসত)।

             ⚠️ মাপ সব পর্দায় ১৬-তেই, ছোট করা হয়নি। আগে ৩২০px-এ
             placeholder-টা ১৩px করা হয়েছিল, কিন্তু সেটা ভুল সমাধান
             ছিল — লেখাটা তখন ছোট **আর** কাটা, দুটোই। এখন লেখাটাই
             বদলায় (উপরের FULL_PLACEHOLDER / SHORT_PLACEHOLDER), তাই মাপ
             কমানোর দরকার নেই।

             ১৬-তে রাখার আলাদা কারণও আছে: iOS Safari ১৬px-এর কম
             font-size-এর ইনপুটে focus করলে পুরো পাতাটা zoom করে দেয়,
             আর সেই zoom নিজে থেকে ফেরে না। */
          className={`h-[50px] w-full rounded-full bg-white pl-11 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-black/70 ${FOCUS_RING}`}
        />
      </div>

      <div className="relative shrink-0" ref={dropdownRef}>
        {/**
         * Figma: 156×50, padding 16, gap 8, justify space-between,
         * radius 100, BG #FFFFFF।
         *
         * ১৫৬-টা স্থির মাপ, hug নয় — ভেতরের লেখার জন্য বরাদ্দ ৯৬px
         * (156 − 16 − 16 − 8 − 20)। তাই pill-এ ছোট নাম দেখানো হয়
         * ("Platinum"), পুরোটা নয় — দেখুন CATEGORY_SHORT_LABELS।
         *
         * ছোট পর্দায় পুরো প্রস্থ, কারণ ওখানে pill-টা নিজের সারিতে একা।
         * ৪৮০ থেকে স্থির ১৫৬ — উপরের wrapper-এর সাথে একই সীমা, দুটো
         * আলাদা হলে একটা সরু ফাঁকে pill নিজের সারিতে অথচ ১৫৬px চওড়া
         * হয়ে বসত।
         */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`flex h-[50px] w-full items-center justify-between gap-2 rounded-full bg-white p-4 font-sora text-[16px] font-normal leading-none text-black transition-colors hover:bg-black/[0.03] min-[480px]:w-[156px] ${FOCUS_RING}`}
        >
          {/* Figma: Sora 400 16px, Black/100 — search-এর লেখা Black/70,
              এটা নয়। বাছাই করা মান আর placeholder এক নয়, তাই পার্থক্যটা
              ইচ্ছাকৃত। */}
          <span className="truncate">
            {category ? CATEGORY_SHORT_LABELS[category] : "All Statuses"}
          </span>
          {/* vuesax/linear/arrow-down — 20×20, stroke 1.5, Black/70।
              ⚠️ search icon-টা Black/100, এটা Black/70। export-এ দুটো
              আলাদা, তাই একই রঙ দেওয়া চলবে না। */}
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-black/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>

        {open && (
          /**
           * Figma "popup": column, padding 16, gap 6, চওড়া 224,
           * radius 16, BG #FFFFFF, shadow 0 4px 30px rgba(0,0,0,0.06)।
           *
           * ছায়াটা আগের চেয়ে অনেক নরম — ৩০px ছড়ানো কিন্তু মাত্র ৬%
           * ঘন। আগে ছিল ৩২px/১৪%, তাই তালিকাটা পাতার উপরে ভেসে না
           * থেকে যেন চেপে বসত। `ring`-টাও সরানো হলো: Figma-তে কোনো
           * পাড় নেই, ছায়াই আলাদা করার কাজটা করে।
           */
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 flex w-[224px] max-w-[calc(100vw-48px)] flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]"
          >
            {[ALL, ...CUSTOMER_CATEGORIES].map((option) => {
              const selected = option === ALL ? category === null : option === category;
              return (
                <li key={option} className="w-full">
                  {/**
                   * Figma item: row, padding 10, উচ্চতা 34, লেখা
                   * Sora 400 14px LH 100% #121212।
                   *
                   * ⚠️ বাছাই করা item-টা কমলা নয় — লেখার রঙ সবার
                   * এক (#121212), শুধু তার পেছনে একটা cream (#F9F6F3)
                   * pill বসে। আমার আগের কমলা-গাঢ় লেখাটা নকশায় নেই।
                   *
                   * আর radius দুটো আলাদা, আর সেটাও ইচ্ছাকৃত:
                   * বাছাই করাটা 100 (পুরো pill), বাকিরা 12। বাকিদের
                   * তো কোনো পটভূমিই নেই, তাই ওই ১২ কেবল hover-এর
                   * সময় চোখে পড়ে — designer সেই অবস্থাটার জন্যই
                   * মাপটা দিয়ে রেখেছেন।
                   */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      push({ category: option === ALL ? null : option });
                    }}
                    className={`flex h-[34px] w-full items-center gap-2 whitespace-nowrap p-2.5 text-left font-sora text-[14px] font-normal leading-none text-[#121212] transition-colors ${
                      selected ? "rounded-full bg-[#F9F6F3]" : "rounded-[12px] hover:bg-black/[0.04]"
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