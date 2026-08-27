"use client";

import { useState } from "react";
import { CircleDollarSign, Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react";

/**
 * src/components/admin/dashboard/RevenueHeroCard.tsx
 *
 * Figma-র বড় gradient কার্ড: মোট আয়, লুকানোর চোখ-বোতাম, আর গত
 * সপ্তাহের তুলনায় পরিবর্তন।
 *
 * চোখ-বোতামটা নিছক অলঙ্কার নয় — dashboard প্রায়ই এমন পর্দায় খোলা থাকে
 * যেটা কর্মী বা গ্রাহকের চোখে পড়ে (কাউন্টারের পেছনের laptop)। তাই
 * client component: শুধু এই টুকরোটাই, পুরো page নয়।
 */

/**
 * ডান পাশের সিঁড়ি-নকশা, Figma-র মাপে।
 *
 * পুরো frame 151.28 × 112.92px, আর একটা কলাম মেপে পাওয়া গেছে:
 * প্রস্থ 19.73px (Fixed), gap 2.19px, উচ্চতা Hug 43.85px।
 *
 * এই তিনটে সংখ্যা থেকেই বাকিটা বেরিয়ে আসে, আলাদা করে মাপতে হয়নি:
 *
 *   ঘরের উচ্চতা: 43.85 = 2h + 2.19  →  h = 20.83
 *     (অর্থাৎ ঘরগুলো ঠিক বর্গ নয় — 19.73 চওড়া, 20.83 উঁচু)
 *   কলাম সংখ্যা: 7 × 19.73 + 6 × 2.19 = 151.25 ≈ 151.28  →  ৭টা
 *   সারি সংখ্যা:  5 × 20.83 + 4 × 2.19 = 112.91 ≈ 112.92  →  ৫টা
 *
 * ⚠️ আগের কোডে ছিল ৫টা কলাম, 24×24 ঘর, 6px gap — অর্থাৎ গঠন আর
 * মাপ দুটোই আলাদা। তাই নকশাটা মকআপের চেয়ে বড় আর খাটো দেখাত।
 *
 * কলামগুলো নিচ থেকে গাঁথা (Figma-তে মাপা কলামের Top 69.07 আর
 * উচ্চতা 43.85 — যোগ করলে ঠিক 112.92, অর্থাৎ frame-এর তলা)।
 */
const STAIR_UNIT = 19.73; // ঘরের প্রস্থ
const STAIR_UNIT_H = 20.83; // ঘরের উচ্চতা
const STAIR_GAP = 2.19;

/**
 * প্রতিটা কলামে কটা ঘর। Figma-র panel এই সংখ্যাগুলো সরাসরি দেয় না
 * (ওটা শুধু frame আর একটা কলামের মাপ দেখায়), তাই এগুলো মকআপ দেখে
 * তোলা — ডান দিকে উঠতে থাকা সিঁড়ি, শেষ কলামে ৫টা।
 *
 * মিলছে না মনে হলে এই একটা array বদলালেই হবে, নিচের JSX-এ হাত
 * দিতে হবে না। Figma-তে frame-টা select করে Copy/Paste as →
 * Copy as code দিলে হুবহু সংখ্যাগুলোও পেয়ে যাবে।
 */
const STAIR_COLUMNS = [1, 2, 2, 3, 4, 4, 5];

export default function RevenueHeroCard({
  amount,
  deltaPercent,
}: {
  /** সাজানো-শেষ string (যেমন "BDT 5,765.12") — server-এ Decimal থেকে
   *  তৈরি, কারণ Decimal browser-এ পাঠানো যায় না। */
  amount: string;
  /** গত সপ্তাহের তুলনায় শতাংশ, নাকি null যদি গত সপ্তাহে কোনো বিক্রিই
   *  না থাকে (তখন "অসীম শতাংশ বৃদ্ধি" দেখানোর কোনো মানে হয় না)। */
  deltaPercent: number | null;
}) {
  const [hidden, setHidden] = useState(false);
  const up = (deltaPercent ?? 0) >= 0;

  return (
    /**
     * Figma Layout panel: Flow Vertical, radius 20px, padding 30px,
     * gap 50px। Colors: Linear Gradient #FF9540 → #FF70C6।
     *
     * ⚠️ এই দুটো hex আর dashboard heading-এর gradient এক নয় (ওটা
     * #FF7100 → #FF1CA4, দেখুন admin/page.tsx)। দেখতে একই পরিবারের,
     * তাই গুলিয়ে ফেলা সহজ — কিন্তু কাজ আলাদা: এখানে gradient-টা
     * background, তার উপরে সাদা লেখা পড়তে হয় বলে ইচ্ছাকৃতভাবে হালকা;
     * ওখানে gradient-টাই লেখা, তাই অনেক বেশি saturated।
     *
     * দূরত্বটা flex column + gap দিয়ে, প্রতিটা সন্তানের নিজস্ব mt-*
     * দিয়ে নয়। আগে ছিল mt-10 (40px) আর mt-4 (16px) — অর্থাৎ Figma-র
     * সমান ৫০/৫০-এর বদলে দুটো আলাদা মান, ফলে সবুজ pill-টা অঙ্কের গায়ে
     * চেপে বসত। এক জায়গায় একটাই gap থাকলে দুটো কখনো আলাদা হতে পারে না।
     *
     * দুটো সাজসজ্জাই (swirl আর সিঁড়ি) `absolute`, তাই ওরা flex item-ই
     * নয় — gap ওদের ছোঁয় না, আর ভেতরের তিনটে ব্লকের দূরত্ব অবিকৃত থাকে।
     *
     * ছোট পর্দায় ৫০/৩০ বাড়াবাড়ি: ৩৭৫px-এ কার্ডটা অকারণে লম্বা হয়ে
     * পুরো পর্দা খেয়ে ফেলে। তাই Figma-র মান দুটো md-scoped, বাকি
     * ফাইলগুলোর মতোই।
     */
    <div className="relative flex flex-col gap-8 overflow-hidden rounded-[20px] bg-gradient-to-r from-[#FF9540] to-[#FF70C6] p-5 md:gap-[50px] md:p-[30px]">
      {/**
       * Figma-র ভেতরের বাঁকানো শেপ — Frame 585×390, #FFFFFF @ 10%।
       *
       * ⚠️ opacity এখানে দেওয়া হয়নি, ইচ্ছাকৃতভাবে: Figma export করার
       * সময় ১০%-টা SVG ফাইলের ভেতরেই লিখে দিয়েছে (fill-opacity)।
       * এখানে আবার `opacity-10` দিলে দুটো গুণ হয়ে ১% হতো, আর শেপটা
       * কার্যত অদৃশ্য হয়ে যেত।
       *
       * সিঁড়ি-নকশার আগে বসানো, তাই DOM ক্রমে নিচে পড়ে; দুটোই absolute
       * বলে পরেরটা উপরে আঁকা হয় — Figma-তেও সিঁড়িটাই শেপের উপরে।
       *
       * প্রস্থ শতাংশে (585 ÷ 1059 ≈ 55%), স্থির px-এ নয়: Figma-র card
       * ১০৫৯px চওড়া, কিন্তু বাস্তবে card-টা viewport অনুযায়ী ছোট-বড়
       * হয়। px দিলে ফোনে শেপটা card-এর চেয়েও চওড়া হয়ে যেত।
       *
       * card-এর `overflow-hidden` শেপের নিচের অংশ কেটে দেয়, আর সেটাই
       * কাম্য — শেপ ৩৯০px লম্বা, card মাত্র ~২৬৭px, অর্থাৎ Figma-তেও
       * এটা কেটেই আছে।
       *
       * next/image ব্যবহার করা হয়নি: SVG optimize করাতে Next-এ
       * `dangerouslyAllowSVG` চালু করতে হয়, যেটা একটা আসল নিরাপত্তা-ছাড়
       * (SVG-তে script থাকতে পারে) — নিছক একটা সাজসজ্জার শেপের জন্য
       * নেওয়ার মতো নয়।
       */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/revenue-card-swirl.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-[33%] top-0 w-[55%] select-none"
      />

      {/**
       * ডান পাশের সিঁড়ি-নকশা। aria-hidden — এটা কোনো তথ্য বহন করে না,
       * screen reader-এ ২৫টা খালি div পড়ে শোনানোর কোনো মানে নেই।
       *
       * `items-end` — কলামগুলো নিচে গাঁথা, উপরে নয়। উপরে গাঁথলে সিঁড়িটা
       * উল্টো দিকে নামত।
       *
       * md-এর নিচে লুকানো: ৩৭৫px পর্দায় ১৫১px চওড়া নকশা টাকার অঙ্কের
       * উপরেই উঠে আসত।
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[30px] right-[30px] hidden items-end md:flex"
        style={{ gap: `${STAIR_GAP}px` }}
      >
        {STAIR_COLUMNS.map((count, col) => (
          <div key={col} className="flex flex-col" style={{ gap: `${STAIR_GAP}px` }}>
            {Array.from({ length: count }).map((_, row) => (
              <div
                key={row}
                className="rounded-[5px] bg-white"
                style={{
                  width: `${STAIR_UNIT}px`,
                  height: `${STAIR_UNIT_H}px`,
                  // Figma-তে ঘরগুলো সবই সাদা (White/100), পার্থক্য শুধু
                  // অস্বচ্ছতায় — উপরের দিকেরগুলো গাঢ়, একেবারে উপরেরটা
                  // পুরো সাদা। row === 0 মানে কলামের মাথা, কারণ এখানে
                  // flex-col (উল্টো নয়) আর কলামটা নিচে গাঁথা।
                  opacity: 1 - row * 0.18,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
          <CircleDollarSign className="h-6 w-6 text-[#121212]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        {/* Figma Typography: Frank Ruhl Libre, 500 Medium, 20px,
            line-height 100%, letter-spacing 0%, সাদা।
            আগে font-semibold (600) ছিল — এক ধাপ ভারী। */}
        <span className="font-frank-ruhl text-[20px] font-medium leading-none tracking-normal text-white">
          Total Revenue
        </span>
      </div>

      <div className="relative flex items-center gap-4">
        {/* Figma Typography: Frank Ruhl Libre, 600 SemiBold, 46px,
            line-height 100%, letter-spacing 0%, #FFFFFF।
            আগে font-bold (700) আর md:text-[44px] ছিল। */}
        <p className="font-frank-ruhl text-[36px] font-semibold leading-none tracking-normal text-white md:text-[46px]">
          {hidden ? "••••••" : amount}
        </p>
        <button
          type="button"
          onClick={() => setHidden((prev) => !prev)}
          aria-pressed={hidden}
          aria-label={hidden ? "Show total revenue" : "Hide total revenue"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {hidden ? (
            <EyeOff className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
      </div>

      {/**
       * সবুজ pill।
       *
       * Figma Typography: Sora, 400 Regular, 14px, line-height 100%,
       * letter-spacing 0%, রঙ Black/70。
       *
       * ⚠️ শতাংশের span-টাও 400 Regular — Figma-তে "Span (b)" আলাদা
       * করে দেখানো আছে আর সেটারও weight 400। অর্থাৎ ওটাকে আলাদা করে
       * সবুজ রঙ, মোটা করে নয়। আগে font-semibold ছিল।
       *
       * `self-start` — flex column-এ default align-items হলো stretch,
       * তাই `inline-flex` সত্ত্বেও pill-টা পুরো প্রস্থে টেনে যেত আর
       * গোল প্রান্ত দুটো কার্ডের দুই কিনারায় গিয়ে ঠেকত।
       */}
      <div className="relative inline-flex self-start items-center gap-1.5 rounded-full bg-white px-3 py-2">
        {deltaPercent === null ? (
          <span className="font-sora text-[14px] font-normal leading-none tracking-normal text-black/70">
            No sales last week to compare against
          </span>
        ) : (
          <>
            {up ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-600" strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" strokeWidth={2.2} aria-hidden="true" />
            )}
            <span
              className={`font-sora text-[14px] font-normal leading-none tracking-normal ${
                up ? "text-green-600" : "text-red-500"
              }`}
            >
              {up ? "+" : ""}
              {deltaPercent}%
            </span>
            <span className="font-sora text-[14px] font-normal leading-none tracking-normal text-black/70">
              {up ? "balance increase, good progress" : "down versus last week"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}