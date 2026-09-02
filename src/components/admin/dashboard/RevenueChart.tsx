"use client";

import { useState } from "react";

export interface RevenueDay {
  /** অক্ষের নিচে ছোট লেখা — "Sat", "15", "Aug"। কোন range বাছা আছে
   *  তার উপর নির্ভর করে, দেখুন lib/revenue-range.ts। */
  label: string;
  /** Tooltip-এর মাথায় পুরো কথাটা — "Aug 28, 2026", "Aug 1 – Aug 5"। */
  fullDate: string;

  /**
   * ⚠️ এই তিনটে সংখ্যা কেবল উচ্চতা ঠিক করার জন্য — টাকার হিসাব নয়।
   * দেখানোর মতো সাজানো string গুলো নিচে আলাদা করে আসে, কারণ Prisma-র
   * Decimal browser-এ পাঠানো যায় না আর float-এ রূপান্তর করলে মুদ্রার
   * নির্ভুলতা নষ্ট হয়।
   */
  income: number;
  expense: number;
  profit: number;

  incomeLabel: string;
  expenseLabel: string;
  profitLabel: string;

  orders: number;
  /** চলতি খোপ (আজ / এই ৫ দিন / এই মাস) — অক্ষে গাঢ় করে দেখানো হয়। */
  isToday: boolean;
}

/**
 * src/components/admin/dashboard/RevenueChart.tsx
 *
 * Figma-র আয়-খরচের নকশা: মাঝখানে একটা ছেঁড়া রেখা, তার উপরে
 * আয়ের সারি (উপরে বাড়ে), নিচে খরচের সারি (নিচে বাড়ে)। প্রজাপতির
 * ডানার মতো — এক নজরে বোঝা যায় কোন দিন কামাই খরচকে ছাড়িয়ে গেছে।
 *
 * ⚠️ এটা আগের RevenueBubbleChart-এর জায়গা নিয়েছে। ওটা প্রতিদিনের
 * জন্য একটা বৃত্ত আঁকত আর tooltip-এ Gross/Tax/Revenue দেখাত — Figma-র
 * নকশা সেটা নয়, আর রেস্তোরাঁর মালিকের কাছে "কত কর নিয়েছি" প্রতিদিনের
 * প্রশ্নও নয়। এখন যা দেখায় সেটাই রোজকার প্রশ্ন: কত এল, কত গেল,
 * কত থাকল।
 *
 * ── জ্যামিতি, Figma-র CSS export থেকে হুবহু ──────────────────────
 * pill 52px চওড়া, radius 100 (তাই সবচেয়ে ছোটটা পুরো বৃত্ত), সারির
 * উচ্চতা 84, দুই সারির মাঝে 9px, তারপর 20px পরে দিনের নাম।
 * উপরের pill: #F9F6F3 + সাদা ডোরা 60%। নিচের: #FF9540 + সাদা ডোরা 15%।
 */

/** Figma: pill-এর প্রস্থ 52, আর radius 100 মানে উচ্চতা ৫২-র নিচে
 *  নামলে ওটা আর pill থাকে না। তাই সর্বনিম্নটাই ৫২ — একটা বৃত্ত। */
const PILL_MIN_H = 52;
/** Layout panel: সারির Hug উচ্চতা 84px। */
const PILL_MAX_H = 84;

/**
 * Figma-তে ডোরাগুলো ৯৬টা আলাদা rectangle (2.03px চওড়া, 10.13px পর পর,
 * তির্যকভাবে ঘোরানো)। প্রতিটা pill-এ ৯৬টা div বসানোর কোনো মানে নেই —
 * একই জিনিস একটা repeating-gradient-এ হয়ে যায়, আর DOM-এ ১৩০০টা node
 * কমে।
 */
const stripes = (alpha: number) =>
  `repeating-linear-gradient(135deg, rgba(255,255,255,${alpha}) 0 2px, transparent 2px 10px)`;

/**
 * ⚠️ pill-গুলো সবসময় পূর্ণ রঙে, শূন্য হলেও — Figma-তে তাই।
 *
 * আগে শূন্য মানে `opacity-40` ছিল, যাতে "সেদিন কিছুই হয়নি" আর
 * "হয়েছে, তবে সামান্য" আলাদা দেখা যায়। কিন্তু মকআপে ওরকম কোনো
 * অবস্থা নেই, আর একটা নতুন রেস্তোরাঁয় (বা যেখানে এখনো Purchase
 * Order ব্যবহার শুরু হয়নি) পুরো সারিটাই ফ্যাকাশে হয়ে থাকত — দেখে
 * মনে হতো chart-টাই ভাঙা।
 *
 * ফলে একটা আসল ছাড় দিতে হয়েছে: উচ্চতা ৫২-র নিচে নামে না, তাই শূন্য
 * দিন আর সবচেয়ে কম বিক্রির দিন এখন দেখতে এক। পার্থক্যটা কেবল
 * tooltip-এ। নকশাটার নিজস্ব সীমা, কোডের নয়।
 */

/** 52 → 84, অর্থাৎ মাত্র 32px-এর ব্যবধানে পুরো সপ্তাহ। নকশার দাবি,
 *  কিন্তু এর মানে পার্থক্যগুলো চাপা দেখায় — আসল সংখ্যা tooltip-এ। */
function pillHeight(value: number, max: number) {
  if (value <= 0) return PILL_MIN_H;
  const ratio = Math.min(value / max, 1);
  return PILL_MIN_H + ratio * (PILL_MAX_H - PILL_MIN_H);
}

/** Figma: pill 52px চওড়া, কলামের মাঝে গ্যাপ 3px। */
const COL_W = 52;
const COL_GAP = 3;

/**
 * একটা কলাম সর্বোচ্চ কত চওড়া হতে পারে।
 *
 * ⚠️ এই সীমাটা না থাকলে pill-এর **আকৃতি** নষ্ট হয়, আর সেটাই এখানে
 * আসল প্রশ্ন। Figma-তে pill ৫২px চওড়া আর ৫২–৮৪px উঁচু — অর্থাৎ
 * সবচেয়ে ছোটটা নিখুঁত বৃত্ত, বাকিগুলো **খাড়া** ডিম্বাকৃতি (চওড়ার
 * চেয়ে লম্বা)।
 *
 * pill-কে কলামের সাথে বাড়তে দিলে ৭২px চওড়া হয়ে যেত, অথচ উচ্চতা
 * ন্যূনতম ৫২ — ফলে শুয়ে থাকা চ্যাপ্টা ডিম, ঠিক উল্টো চেহারা।
 *
 * তাই pill স্থির ৫২, আর ফাঁকটা যাতে হাস্যকর বড় না হয় সেজন্য
 * কলামেরই একটা সীমা: ৮৮px (Figma-র ৫১৭.৫px কার্ডে সাতটা কলাম মানে
 * ~৬৫px, আর ট্যাবলেট মকআপে ~৮০ — ৮৮ তার সামান্য উপরে, যাতে চওড়া
 * কার্ডেও ফাঁকটা ~৩৬px-এ থামে)।
 */
const COL_MAX_W = 88;

export default function RevenueChart({ days }: { days: RevenueDay[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // দুই সারি একই মাপকাঠিতে, আলাদা নয় — নাহলে ৫০ টাকার খরচ আর ৫০ হাজার
  // টাকার আয় একই উঁচু দেখাত, আর তুলনাটাই মিথ্যে হয়ে যেত।
  const scaleMax = Math.max(...days.map((d) => Math.max(d.income, d.expense)), 1);

  /**
   * ⚠️ কলামগুলো আর `flex-1`-এ সংকুচিত হয় না — Figma নিজেই ৩২০px-এ
   * এটা করে না।
   *
   * আগে `flex-1 justify-between`-এ যত কলামই থাকুক (সপ্তাহে ৭টা, মাসে
   * ৬টা, বছরে ১২টা), সবগুলোকে জোর করে কার্ডের ভেতরে গুঁজে দেওয়া হতো।
   * "This Year"-এ ১২টা কলাম ৩২০px পর্দায় (padding বাদে ~256px) মানে
   * প্রতিটা কলাম ~21px — অথচ pill-এর radius 100 (পুরো গোল), ফলে ৫২px
   * চওড়া pill ২১px-এ নামলে সেটা আর pill থাকে না, ছোট্ট রঙিন বিন্দু
   * হয়ে যায় (ঠিক যা screenshot-এ ধরা পড়েছিল), আর নিচের মাসের নামও
   * তিন লাইনে ভেঙে পড়ত।
   *
   * Figma-র নিজের মকআপ ৩২০px-এ এই সমস্যাটাই মেনে নেয়নি — কলাম আকার
   * (52px) অক্ষত রেখে বাকিটা পাশে সরিয়ে (touch-scroll করে) দেখায়।
   *
   * ⚠️ কিন্তু ৫২px একটা **ন্যূনতম**, স্থির মাপ নয় — আর এই তফাতটা
   * প্রথমে ভুল হয়েছিল। `width: contentWidth` বসানোয় সাতটা কলাম
   * সবসময় ৩৮২px জুড়ে বসত, এমনকি ৯০০px চওড়া কার্ডেও — ডান দিকে
   * বিশাল ফাঁকা জায়গা পড়ে থাকত। Figma-র ডেস্কটপ মকআপে কলামগুলো
   * কার্ডের পুরো প্রস্থ জুড়ে ছড়ানো (৫১৭.৫px কার্ডে সাতটা কলাম,
   * প্রতিটা ~৭০px)।
   *
   * তাই এখন `minWidth` — জায়গা থাকলে কলামগুলো `flex-1` দিয়ে বেড়ে
   * পুরোটা ভরাট করে, আর জায়গা কম পড়লে ৫২px-এ থেমে যায় আর বাইরের
   * `overflow-x-auto` wrapper স্লাইড করতে দেয়। একটাই নিয়মে দুই
   * প্রান্ত: ৩২০px-এ "This Year"-এর ১২টা কলাম scroll করে, আর
   * ডেস্কটপে সপ্তাহের সাতটা কলাম কার্ড ভরে দেয়।
   *
   * ⚠️ pill নিজে স্থির ৫২px, বাড়ে শুধু **কলাম** — আর কলামও
   * `COL_MAX_W` পর্যন্ত (ওই ধ্রুবকের মন্তব্যে কারণ)। ফলে pill-এর
   * আকৃতি সব মাপে এক থাকে, আর দুই দিনের মাঝের ফাঁকও ~৩৬px-এর
   * বেশি হয় না।
   *
   * ⚠️ কার্ড এই সর্বোচ্চ মাপের চেয়েও চওড়া হলে chart-টা **মাঝখানে**
   * বসে (`mx-auto`), বাঁয়ে নয়। বাঁ-ঘেঁষা রাখলে ডান পাশে একটা বড়
   * ফাঁকা জায়গা পড়ে থাকত আর মনে হতো কিছু একটা লোড হয়নি; মাঝখানে
   * থাকলে সেটা একটা ইচ্ছাকৃত বিন্যাস বলেই দেখায়।
   */
  const contentWidth = days.length * COL_W + Math.max(days.length - 1, 0) * COL_GAP;
  const maxContentWidth = days.length * COL_MAX_W + Math.max(days.length - 1, 0) * COL_GAP;

  /**
   * ⚠️ `overflow-y-hidden` জরুরি, যদিও উল্লম্বভাবে কিছুই উপচে পড়ার
   * কথা নয়।
   *
   * CSS-এর নিয়ম: `overflow-x` যদি `visible` ছাড়া অন্য কিছু হয়, আর
   * `overflow-y` যদি `visible` থাকে, তবে browser নিজে থেকেই
   * `overflow-y`-কে `auto` বানিয়ে ফেলে — দুটো অক্ষ আলাদা রাখা সম্ভব
   * নয়। ফলে শুধু `overflow-x-auto` লিখলে কার্ডের ভেতরে একটা
   * **উল্লম্ব scrollbar-ও** জন্মায়, কারণ pill-গুলোর inline height
   * সাব-পিক্সেলে গোল হয়ে মাঝে মাঝে এক-দু' পিক্সেল বেশি হয়ে যায়।
   *
   * স্পষ্ট করে `hidden` লিখলে ওই দ্বিতীয় scrollbar-টা আর আসে না, আর
   * আড়াআড়ি scroll (যেটা আসলে দরকার — "This Year"-এ ১২টা কলাম)
   * অক্ষত থাকে।
   *
   * ⚠️ কিন্তু `overflow-y-hidden`-এর একটা পার্শ্বপ্রতিক্রিয়া আছে:
   * tooltip-টা ইচ্ছাকৃতভাবে chart-এর মাথার ৮px উপরে উপচে পড়ে
   * (Figma-র `top: 93px`, নিচে tooltip-এর নিজের মন্তব্য দ্রষ্টব্য),
   * আর `hidden` সেই উপচে পড়া অংশটুকু কেটে দিত — কালো কার্ডের উপরের
   * গোল কোনাদুটো কাটা দেখাত।
   *
   * তাই wrapper-এ `pt-2` (৮px) — ঠিক ততটুকু জায়গা যতটা tooltip
   * উপরে ওঠে। scroll-এর আচরণ বদলায় না, শুধু কাটা পড়া বন্ধ হয়।
   * tooltip-কে wrapper-এর বাইরে সরানো যেত, কিন্তু তখন সেটা আড়াআড়ি
   * scroll-এর সাথে নড়ত না — কলাম সরে গেলেও tooltip জায়গামতোই
   * দাঁড়িয়ে থাকত।
   */
  return (
    <div className="overflow-x-auto overflow-y-hidden pt-2">
      <div
        className="mx-auto flex flex-col gap-5"
        style={{ minWidth: contentWidth, maxWidth: maxContentWidth }}
      >
        <div className="relative flex flex-col gap-[9px]">
          {/* উপরের সারি — আয়। items-end, তাই pill গুলো ছেঁড়া রেখা থেকে
              উপরের দিকে বাড়ে। */}
          <div className="flex h-[84px] items-end gap-[3px]">
            {days.map((day, index) => (
              <button
                key={`income-${day.label}`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                // ফোনে hover বলে কিছু নেই, তাই tap-ও একই কাজ করে।
                onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
                aria-label={`${day.fullDate}: ${day.incomeLabel} in, ${day.expenseLabel} out, ${day.profitLabel} kept, ${day.orders} orders`}
                // ⚠️ কলামটা `flex-1` (বাড়ে), ভেতরের pill স্থির ৫২px।
                // উপরের contentWidth-এর মন্তব্য দ্রষ্টব্য।
                className="flex min-w-[52px] flex-1 justify-center focus:outline-none"
              >
                <span
                  className="w-[52px] shrink-0 rounded-full"
                  style={{
                    height: pillHeight(day.income, scaleMax),
                    backgroundColor: "#F9F6F3",
                    backgroundImage: stripes(0.6),
                  }}
                />
              </button>
            ))}
          </div>

          {/* Figma: 1px dashed #D9D9D9, পুরো চওড়া জুড়ে। */}
          <div aria-hidden="true" className="border-t border-dashed border-[#D9D9D9]" />

          {/* নিচের সারি — খরচ। items-start, তাই আয়নার মতো নিচে বাড়ে। */}
          <div className="flex h-[84px] items-start gap-[3px]">
            {days.map((day, index) => (
              <button
                key={`expense-${day.label}`}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
                aria-hidden="true"
                className="flex min-w-[52px] flex-1 justify-center focus:outline-none"
              >
                <span
                  className="w-[52px] shrink-0 rounded-full"
                  style={{
                    height: pillHeight(day.expense, scaleMax),
                    backgroundColor: "#FF9540",
                    backgroundImage: stripes(0.15),
                  }}
                />
              </button>
            ))}
          </div>

        {/* খাড়া ছেঁড়া দাগ — Figma-তে 2×190, সাদা। কোন কলামটা পড়া হচ্ছে
            তা চোখে ধরিয়ে দেয়, বিশেষত যখন tooltip পাশের কলামের উপরে
            সরে গেছে।

            ⚠️ মোবাইলে `hidden` — ৩২০-৩৭৫px পর্দায় দাগটা ৫২px চওড়া
            pill-এর ঠিক ওপরে বসে ছোট চার্টটাকে আরও এলোমেলো দেখাচ্ছিল,
            আর tooltip (কালো কার্ড, যেটাতে আসল তথ্য — Income/Expense/
            Profit) থাকতেই একই কলাম বোঝানোর জন্য আলাদা করে এই দাগের
            দরকার পড়ে না। `md:flex`-এ বড় পর্দায় আগের মতোই থাকে। */}
        {activeIndex !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 hidden justify-center md:flex"
            style={{
              left: `${(activeIndex / days.length) * 100}%`,
              width: `${(1 / days.length) * 100}%`,
            }}
          >
            <span className="h-full border-l-2 border-dashed border-white" />
          </div>
        )}

        {/**
         * Tooltip — Figma: 152×92, #000, radius 12, padding 8, gap 8।
         *
         * ⚠️ chart-এর ভেতরে, উপরে নয়। আগে `bottom-full` ছিল, তাই এটা
         * পুরো chart-এর মাথার উপরে গিয়ে "Total Revenue" শিরোনামটার
         * গায়ে বসত — কার্ডের বাইরেও বেরিয়ে যেত।
         *
         * Figma-র CSS: `top: 93px`। উপরের সারি শেষ হয় ৮৪-এ আর tooltip
         * উঁচু ৯২, অর্থাৎ ওটার তলা ছেঁড়া বিভাজকের গায়ে এসে থামে আর
         * মাথাটা ৮px উপরে উপচে পড়ে। তাই `top: -8`।
         *
         * অনুভূমিকভাবে clamp() — কলামের কেন্দ্রে বসে, কিন্তু দুই
         * প্রান্তে কার্ডের বাইরে যায় না। আগে প্রথম/শেষ দুটো কলামে
         * left-0/right-0-এ লাফ দিত, আর মাঝের কলামে ফিরলে আবার লাফ।
         */}
        {activeIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 flex w-[152px] flex-col justify-center gap-2 rounded-[12px] bg-black p-2"
            style={{
              top: -8,
              left: `clamp(0px, calc(${
                ((activeIndex + 0.5) / days.length) * 100
              }% - 76px), calc(100% - 152px))`,
            }}
            role="status"
          >
            <span className="inline-flex w-fit items-center rounded-full bg-white px-[9px] py-1.5 font-sora text-[8px] leading-none text-black">
              {days[activeIndex].fullDate}
            </span>

            <div className="flex flex-col gap-1.5">
              <TooltipRow dot="#6DCB66" label="Income" value={days[activeIndex].incomeLabel} />
              <TooltipRow dot="#FB7000" label="Expense" value={days[activeIndex].expenseLabel} />
              {/* Figma-তে এই সারির নাম "Revenue"। সেটা রাখা যেত না:
                  উপরের সারিটাই আসল revenue, আর আয় থেকে খরচ বাদ দিলে
                  যা থাকে তাকে revenue বলা হিসাববিজ্ঞানে ভুল — মালিক
                  দুটো গুলিয়ে ফেললে ক্ষতিটা কাগজে থাকে না।

                  "Gross profit" ছিল, কিন্তু ১৫২px চওড়া tooltip-এ ওটা
                  দু'লাইনে ভেঙে যেত আর সারি তিনটের উচ্চতা অসমান হয়ে
                  যেত। এক শব্দে একই কথা। */}
              <TooltipRow dot="#FF3F5C" label="Profit" value={days[activeIndex].profitLabel} />
            </div>
          </div>
        )}
      </div>

        {/**
         * দিনের নাম — Figma: Sora 400, 14px, Black/70।
         *
         * ⚠️ pill-গুলোর মতো এই কলামগুলোও `flex-1 min-w-[52px]` + 3px গ্যাপ —
         * বারের ঠিক নিচেই বসে থাকে, viewport যত সরুই হোক (আগে এই
         * সারিটা আলাদাভাবে `flex-1`-এ সংকুচিত হতো, তাই বার আর তার
         * নামের কেন্দ্র ৩২০px-এ একে অপরের থেকে সরে যেত)।
         */}
        <div className="flex gap-[3px]">
          {days.map((day) => (
            <span
              key={`label-${day.label}`}
              className={`min-w-[52px] flex-1 text-center font-sora text-[12px] leading-none tracking-normal sm:text-[14px] ${
                day.isToday ? "font-semibold text-black" : "text-black/70"
              }`}
            >
              {day.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Figma: 6px গোল বিন্দু, label Sora 400 12px সাদা, অঙ্ক Frank Ruhl
 *  Libre 500 12px #F9F9F9। */
function TooltipRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
        <span className="whitespace-nowrap font-sora text-[12px] leading-none text-white">
          {label}
        </span>
      </span>
      <span className="whitespace-nowrap font-frank-ruhl text-[12px] font-medium leading-none text-[#F9F9F9]">
        {value}
      </span>
    </div>
  );
}