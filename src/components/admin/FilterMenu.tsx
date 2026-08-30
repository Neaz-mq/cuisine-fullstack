"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * src/components/admin/FilterMenu.tsx
 *
 * Admin panel-এর ছাঁকনি dropdown — pill + popup, একটাই জায়গায়।
 *
 * ── কেন আলাদা component ────────────────────────────────────────────────
 *
 * Dashboard-এ তিনটে dropdown আছে: Recent Orders-এর period, Revenue
 * chart-এর range, Top Selling Items-এর range। তিনটেরই markup আর
 * class হুবহু এক ছিল, কিন্তু **কপি করা** — DashboardFilters-এ একবার,
 * RangeSelect-এ আরেকবার। ফলে একটার নকশা বদলালে অন্যটা নীরবে পিছিয়ে
 * থাকত, আর ঠিক সেটাই হয়েছিল: Users page-এর popup নতুন নকশায় গেছে,
 * dashboard-এরগুলো পুরনোতেই রয়ে গেছে।
 *
 * এখন popup-এর চেহারা এই একটা ফাইলেই। নতুন কোনো ছাঁকনি যোগ করলে
 * সেটা আপনা থেকেই মিলে যাবে।
 *
 * ⚠️ UsersToolbar.tsx-এ এই একই popup এখনো inline লেখা আছে। ওটাও এই
 * component-এ সরানো উচিত — তাহলে সত্যিই একটাই উৎস থাকে। এখন সরানো
 * হয়নি কারণ ওই পাতাটা চলছে আর ডেমো কাছে; কিন্তু ততদিন দুটো কপি
 * থাকছে, সেটা মনে রাখতে হবে।
 *
 * ── কী মেলানো হলো, কী মেলানো হয়নি ──────────────────────────────────────
 *
 * **popup** পুরোপুরি Users page-এর মতো: ২২৪px চওড়া, ভেতরে padding
 * 16, item-এর মাঝে gap 6, radius 16, ছায়া 0 4px 30px rgba(0,0,0,0.06),
 * কোনো ring নেই। বাছাই করা item-এর লেখা কমলা বা bold হয় না — সবার
 * লেখা #121212, কেবল তার পেছনে একটা cream (#F9F6F3) pill বসে।
 *
 * **pill (trigger)** dashboard-এর নিজের মাপেই থাকল: উচ্চতা 40, cream
 * পটভূমি, hug প্রস্থ। Users page-এর pill সাদা আর ১৫৬px স্থির, কারণ
 * ওটা cream পাতায় বসে; dashboard-এর pill বসে সাদা কার্ডে, তাই উল্টো
 * রঙ। দুটোকে এক করলে dashboard-এর pill কার্ডের সাথে মিশে গিয়ে
 * অদৃশ্য হয়ে যেত। অর্থাৎ পার্থক্যটা অসঙ্গতি নয়, পটভূমির ফল।
 */

/**
 * Focus চিহ্ন — UsersToolbar থেকে হুবহু।
 *
 * `ring-*` নয়, কারণ Tailwind-এর ring আসলে দুই স্তরের box-shadow, আর
 * প্রথম স্তরটা (`ring-offset-color`) ডিফল্টে সাদা। চওড়া শূন্য হলেও
 * ওই সাদাটা কিনারায় আধা-পিক্সেল থেকে যায় — cream pill-এর বাইরে
 * সেটা কমলার আগে একটা ফাঁক হয়ে ফুটে ওঠে।
 *
 * outline-এ ওই offset স্তরটাই নেই, আর ঋণাত্মক offset দিয়ে সেটা
 * কিনারার সামান্য ভেতরে আঁকা হয় — বাইরে ফাঁক জ্যামিতিকভাবেই অসম্ভব।
 *
 * শর্টহ্যান্ডের বদলে সরাসরি CSS, কারণ `outline` শর্টহ্যান্ড Tailwind
 * v3-এ width বোঝায় আর v4-এ style।
 *
 * `focus-visible`, `focus` নয় — mouse দিয়ে click করলে চিহ্নটা আসে না,
 * কেবল Tab চাপলে।
 */
export const FILTER_FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

export type FilterMenuOption<T extends string> = {
  value: T;
  /** popup-এর তালিকায় যা দেখাবে। */
  label: string;
  /**
   * pill-এ যা দেখাবে, যদি popup-এর নামটা লম্বা হয়। না দিলে `label`।
   * Users page-এ এভাবেই "Platinum Customer" pill-এ "Platinum" হয়।
   */
  triggerLabel?: string;
};

export default function FilterMenu<T extends string>({
  value,
  options,
  onSelect,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: readonly FilterMenuOption<T>[];
  onSelect: (value: T) => void;
  /** screen reader-এর জন্য, যেমন "Period"। */
  ariaLabel?: string;
  /** বাইরের wrapper-এ বাড়তি class — যেমন RangeSelect-এর `ml-auto`। */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape — keyboard user-এর বেরোনোর পথ। আগে এটা RangeSelect-এ ছিল
    // কিন্তু DashboardFilters-এ ছিল না; একসাথে আনায় সেটাও মিলে গেল।
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

  // অজানা মান এলে (যেমন URL-এ হাতে লেখা ?period=xyz) প্রথমটায় পড়ে
  // থাকে, যাতে pill খালি না দেখায়।
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Figma Layout: Hug ×40, radius 100, padding 12, gap 8,
          BG #F9F6F3। লেখা Sora 400 14px #000000, icon 16×16। */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ? `${ariaLabel}: ${selected.label}` : undefined}
        className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[#F9F6F3] px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black/[0.06] ${FILTER_FOCUS_RING}`}
      >
        {selected.triggerLabel ?? selected.label}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </button>

      {open && (
        /**
         * Figma "popup": column, padding 16, gap 6, চওড়া 224,
         * radius 16, BG #FFFFFF, shadow 0 4px 30px rgba(0,0,0,0.06)।
         *
         * ⚠️ ছায়াটা ইচ্ছাকৃতভাবে খুব নরম — ৩০px ছড়ানো, মাত্র ৬% ঘন।
         * Users page-এ popup-টা cream পাতার উপরে ভাসে, তাই সাদা-বনাম-
         * cream পার্থক্যটাই আলাদা করার কাজ করে আর ছায়ার দরকার পড়ে না।
         * Dashboard-এ কিন্তু popup বসে **সাদা কার্ডের উপরে** — সাদার
         * উপর সাদা, তাই কেবল এই ৬% ছায়াই আলাদা করে।
         *
         * বাস্তবে দেখে যদি চ্যাপ্টা লাগে, একটাই সংযোজন যথেষ্ট:
         * এই তালিকায় `ring-1 ring-black/5` যোগ করুন। নকশায় পাড় নেই,
         * তাই সেটা ইচ্ছাকৃত deviation হিসেবে লিখে রাখতে হবে।
         *
         * `max-w` শেষ রক্ষাকবচ: ৩২০px পর্দায় ২২৪px আঁটে, কিন্তু
         * ভবিষ্যতে কেউ আরও সরু জায়গায় বসালে যেন নীরবে উপচে না পড়ে।
         */
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 flex w-[224px] max-w-[calc(100vw-48px)] flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]"
        >
          {options.map((option) => {
            const isSelected = option.value === selected.value;
            return (
              <li key={option.value} className="w-full">
                {/**
                 * Figma item: row, padding 10, উচ্চতা 34, লেখা
                 * Sora 400 14px LH 100% #121212।
                 *
                 * ⚠️ বাছাই করা item কমলা বা bold নয় — লেখার রঙ সবার
                 * এক, কেবল পেছনে cream pill। আগে dashboard-এ এটা
                 * `font-semibold text-[#FF4C15]` ছিল, যা নকশায় নেই।
                 *
                 * radius দুটো আলাদা, সেটাও ইচ্ছাকৃত: বাছাই করাটা 100
                 * (পুরো pill), বাকিরা 12। বাকিদের কোনো পটভূমিই নেই,
                 * তাই ওই ১২ কেবল hover-এর সময় চোখে পড়ে — designer
                 * সেই অবস্থাটার জন্যই মাপটা দিয়েছেন।
                 */}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setOpen(false);
                    onSelect(option.value);
                  }}
                  className={`flex h-[34px] w-full items-center gap-2 whitespace-nowrap p-2.5 text-left font-sora text-[14px] font-normal leading-none text-[#121212] transition-colors ${
                    isSelected
                      ? "rounded-full bg-[#F9F6F3]"
                      : "rounded-[12px] hover:bg-black/[0.04]"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}