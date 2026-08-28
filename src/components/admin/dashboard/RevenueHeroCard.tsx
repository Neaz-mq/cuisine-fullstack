"use client";

import { useState } from "react";
import { CircleDollarSign, Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react";

/**
 * src/components/admin/dashboard/RevenueHeroCard.tsx
 *
 * Figma-র বড় gradient কার্ড: মোট আয়, লুকানোর চোখ-বোতাম, আর গত
 * সপ্তাহের তুলনায় পরিবর্তন। সব মাপ Figma-র CSS export থেকে।
 *
 * চোখ-বোতামটা নিছক অলঙ্কার নয় — dashboard প্রায়ই এমন পর্দায় খোলা থাকে
 * যেটা কর্মী বা গ্রাহকের চোখে পড়ে (কাউন্টারের পেছনের laptop)। তাই
 * client component: শুধু এই টুকরোটাই, পুরো page নয়।
 */

/**
 * ডান পাশের সিঁড়ি-নকশা, Figma থেকে হুবহু।
 *
 * প্রতিটা ভেতরের array একটা কলাম, উপর থেকে নিচে, আর সংখ্যাগুলো ঘরের
 * অস্বচ্ছতা — সাদা 100% বা 40%।
 *
 * ⚠️ এটা কোনো নিয়ম মেনে চলে না, আর সেটাই আসল কথা। আগে আমি ধরে
 * নিয়েছিলাম কলামগুলো ডান দিকে একটানা উঁচু হয় (1,2,2,3,4,4,5) আর
 * উপরের ঘর সবচেয়ে গাঢ় — দুটোই ভুল। Figma-তে উচ্চতা মাঝপথে নেমেও
 * যায় (3-এর পরে 2), আর অস্বচ্ছতার ক্রম কলামভেদে আলাদা। এটা তথ্য নয়,
 * নিছক নকশা — তাই কোনো সূত্রে বসানো যায় না, তালিকা হিসেবেই লিখতে হয়।
 */
const STAIR_COLUMNS: number[][] = [
  [0.4],
  [1],
  [1, 0.4],
  [0.4, 1],
  [1, 0.4, 0.4],
  [1, 0.4],
  [1, 0.4, 1, 0.4, 1],
];

/** Figma: ঘর 19.73 × 20.83, radius 4, ফাঁক 2.19 — দুই দিকেই। */
const CELL_W = 19.73;
const CELL_H = 20.83;
const CELL_GAP = 2.19;

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

  /**
   * শতাংশটার রঙ — বৃদ্ধিতে সবুজ, পতনে লাল।
   *
   * ⚠️ কেবল শতাংশটা রঙিন, পুরো বাক্যটা নয়।
   *
   * Figma-র CSS export বিভ্রান্তিকর: ওখানে গোটা text node-টার রঙ
   * #0ECF00 লেখা, তাই দেখে মনে হয় সবটুকুই সবুজ। কিন্তু মকআপে স্পষ্ট
   * দেখা যায় "+12%" সবুজ আর "balance increase, good progress" কালো —
   * অর্থাৎ ভেতরে একটা span override আছে, যেটা export-এ আসেই না।
   * এরকম জায়গায় মকআপই শেষ কথা, export নয়।
   *
   * পতনের কোনো variant Figma-তে আঁকা নেই, তাই লাল হিসেবে #FF3F5C —
   * chart tooltip-এও একই লাল, তাই জোড়াটা মানানসই থাকে।
   */
  const deltaColor = up ? "#0ECF00" : "#FF3F5C";

  return (
    /**
     * Figma Layout: Vertical, padding 30, gap 50, radius 20,
     * 1059 × 266.92। উচ্চতাটা মিলিয়ে দেখার মতো:
     * 30 + 44 (উপরের সারি) + 50 + 112.92 (নিচের সারি) + 30 = 266.92।
     *
     * ⚠️ Gradient-টা `bg-gradient-to-r` নয়।
     * Figma: `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`
     *
     * দুটো পার্থক্য, দুটোই চোখে পড়ে:
     *   • কোণ 93.36°, 90° নয় — তাই রঙটা সামান্য তেরছাভাবে নামে
     *   • গোলাপির স্টপ **145.78%**, 100% নয় — অর্থাৎ পুরো গোলাপিটা
     *     কার্ডের ডান প্রান্তের অনেক বাইরে পড়ে, ভেতরে কখনো পৌঁছায়ই
     *     না। আগের `to-r ... to-[#FF70C6]` ডান কিনারায় খাঁটি গোলাপি
     *     এনে ফেলত, আর কার্ডটা মকআপের চেয়ে অনেক বেশি গোলাপি দেখাত।
     *
     * ছোট পর্দায় ৫০/৩০ বাড়াবাড়ি: ৩৭৫px-এ কার্ডটা অকারণে লম্বা হয়ে
     * পুরো পর্দা খেয়ে ফেলে। তাই Figma-র মান দুটো md-scoped।
     */
    <div className="relative flex flex-col gap-8 overflow-hidden rounded-[20px] bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] p-5 md:gap-[50px] md:p-[30px]">
      {/**
       * ভেতরের বাঁকানো শেপ — Figma: Vector 1400, 585×390,
       * left 367, top −1, #FFFFFF @ 10%।
       *
       * শতাংশে বসানো, স্থির px-এ নয়: Figma-র card ১০৫৯px চওড়া কিন্তু
       * বাস্তবে card-টা viewport অনুযায়ী ছোট-বড় হয়।
       *   left  367 ÷ 1059 = 34.65%
       *   width 585 ÷ 1059 = 55.24%
       *
       * ⚠️ opacity এখানে দেওয়া হয়নি: Figma export করার সময় ১০%-টা SVG
       * ফাইলের ভেতরেই লিখে দিয়েছে। আবার দিলে দুটো গুণ হয়ে ১% হতো আর
       * শেপটা কার্যত অদৃশ্য হয়ে যেত। SVG-টা কখনো opacity ছাড়া
       * export করা হলে এখানে `opacity-10` যোগ করতে হবে।
       *
       * card-এর `overflow-hidden` শেপের নিচের অংশ কেটে দেয় — শেপ
       * ৩৯০px, card ২৬৭px, অর্থাৎ Figma-তেও এটা কেটেই আছে।
       *
       * next/image ব্যবহার করা হয়নি: SVG optimize করাতে Next-এ
       * `dangerouslyAllowSVG` চালু করতে হয়, যেটা একটা আসল
       * নিরাপত্তা-ছাড় (SVG-তে script থাকতে পারে) — নিছক একটা
       * সাজসজ্জার শেপের জন্য নেওয়ার মতো নয়।
       */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/revenue-card-swirl.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-[34.65%] top-[-1px] w-[55.24%] select-none"
      />

      {/* উপরের সারি — Figma: 44px উঁচু, icon আর লেখার মাঝে gap 12। */}
      <div className="relative flex items-center gap-3">
        {/* Figma: 44×44 সাদা বৃত্ত, ভেতরে 20×20 কালো icon। */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
          <CircleDollarSign className="h-5 w-5 text-black" strokeWidth={1.5} aria-hidden="true" />
        </span>
        {/* Figma: Frank Ruhl Libre, 500 Medium, 20px, LH 100%, সাদা। */}
        <span className="font-frank-ruhl text-[20px] font-medium leading-none tracking-normal text-white">
          Total Revenue
        </span>
      </div>

      {/* নিচের সারি — Figma: space-between, align flex-end, 112.92 উঁচু। */}
      <div className="relative flex items-end justify-between gap-6">
        {/* বাঁ কলাম — Figma: column, align flex-start, gap 18।
            প্রস্থটা hug: অঙ্কের সারিটাই সবচেয়ে চওড়া (236 + 23 + 50 =
            309), আর নিচের badge সেই মাপে টেনে যায় (align-self stretch)। */}
        <div className="flex min-w-0 flex-col items-start gap-[18px]">
          {/* Figma: row, align center, gap 23.02, উচ্চতা 50। */}
          <div className="flex items-center gap-[23px]">
            {/* Figma: Frank Ruhl Libre, 600 SemiBold, 46px, LH 100%, সাদা। */}
            <p className="font-frank-ruhl text-[36px] font-semibold leading-none tracking-normal text-white md:text-[46px]">
              {hidden ? "••••••" : amount}
            </p>
            {/* Figma: 50×50, radius 100, rgba(255,255,255,0.2),
                padding 15 → ভেতরের icon ঠিক 20×20। */}
            <button
              type="button"
              onClick={() => setHidden((prev) => !prev)}
              aria-pressed={hidden}
              aria-label={hidden ? "Show total revenue" : "Hide total revenue"}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {hidden ? (
                <EyeOff className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>

          {/**
           * Figma: সাদা pill, উচ্চতা 26, radius 109.6, padding
           * 6px 12px 6px 6px, gap 4 — আর `align-self: stretch`।
           *
           * ওই stretch-টাই এখানে আসল: pill-টা নিজের লেখার মাপে সঙ্কুচিত
           * হয় না, উপরের অঙ্কের সারির সমান চওড়া হয়। ফলে দুটোর বাঁ আর
           * ডান প্রান্ত একসারিতে পড়ে — মকআপে যেটা দেখতে পরিপাটি লাগে।
           * আগে এটা hug ছিল (`inline-flex self-start`), তাই ছোট লেখায়
           * pill-টা অর্ধেক হয়ে যেত।
           *
           */}
          <div className="flex h-[26px] w-full items-center justify-center gap-1 rounded-full bg-white py-1.5 pl-1.5 pr-3">
            {deltaPercent === null ? (
              <span className="font-sora text-[12px] leading-none text-black md:text-[14px]">
                No sales last week to compare
              </span>
            ) : (
              <>
                {/* Figma: 13×13, ভরাট তীর, রঙ #0ECF00। */}
                {up ? (
                  <TrendingUp
                    className="h-[13px] w-[13px] shrink-0"
                    style={{ color: deltaColor }}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingDown
                    className="h-[13px] w-[13px] shrink-0"
                    style={{ color: deltaColor }}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
                {/* Figma: Sora 400, 14px, LH 100%। শতাংশটুকু রঙিন,
                    বর্ণনাটা Black/100 — উপরের deltaColor-এর মন্তব্য
                    দ্রষ্টব্য। */}
                <span className="whitespace-nowrap font-sora text-[12px] font-normal leading-none md:text-[14px]">
                  <span style={{ color: deltaColor }}>
                    {up ? "+" : ""}
                    {deltaPercent}%
                  </span>{" "}
                  <span className="text-black">
                    {up ? "balance increase, good progress" : "down versus last week"}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/**
         * সিঁড়ি-নকশা — Figma: Group 2147258169, 151.28 × 112.92।
         *
         * কলামগুলো নিচে গাঁথা (`items-end`): প্রতিটার top + height
         * যোগ করলেই ঠিক 112.92 আসে, অর্থাৎ সবার তলা এক সারিতে।
         *
         * aria-hidden — কোনো তথ্য বহন করে না, screen reader-এ ১৬টা
         * খালি div পড়ে শোনানোর মানে হয় না।
         *
         * md-এর নিচে লুকানো: ৩৭৫px পর্দায় ১৫১px চওড়া নকশা টাকার
         * অঙ্কের উপরেই উঠে আসত।
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none hidden shrink-0 items-end md:flex"
          style={{ gap: `${CELL_GAP}px`, height: 112.92 }}
        >
          {STAIR_COLUMNS.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className="flex flex-col"
              style={{ gap: `${CELL_GAP}px` }}
            >
              {column.map((opacity, cellIndex) => (
                <span
                  key={cellIndex}
                  className="block rounded-[4px] bg-white"
                  style={{ width: CELL_W, height: CELL_H, opacity }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}