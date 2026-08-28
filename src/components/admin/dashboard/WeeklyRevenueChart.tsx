"use client";

import { useState } from "react";

export interface RevenueDay {
  /** "Sat", "Sun" … */
  label: string;
  /** পুরো তারিখ, tooltip-এর মাথায় — "Mar 23, 2025"। */
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
  /** আজকের কলাম — Figma-র খাড়া সাদা ছেঁড়া-দাগ। */
  isToday: boolean;
}

/**
 * src/components/admin/dashboard/WeeklyRevenueChart.tsx
 *
 * Figma-র সাপ্তাহিক আয়ের নকশা: মাঝখানে একটা ছেঁড়া রেখা, তার উপরে
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
  `repeating-linear-gradient(115deg, rgba(255,255,255,${alpha}) 0 2px, transparent 2px 12px)`;

/** 52 → 84, অর্থাৎ মাত্র 32px-এর ব্যবধানে পুরো সপ্তাহ। নকশার দাবি,
 *  কিন্তু এর মানে পার্থক্যগুলো চাপা দেখায় — আসল সংখ্যা tooltip-এ। */
function pillHeight(value: number, max: number) {
  if (value <= 0) return PILL_MIN_H;
  const ratio = Math.min(value / max, 1);
  return PILL_MIN_H + ratio * (PILL_MAX_H - PILL_MIN_H);
}

export default function WeeklyRevenueChart({ days }: { days: RevenueDay[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // দুই সারি একই মাপকাঠিতে, আলাদা নয় — নাহলে ৫০ টাকার খরচ আর ৫০ হাজার
  // টাকার আয় একই উঁচু দেখাত, আর তুলনাটাই মিথ্যে হয়ে যেত।
  const scaleMax = Math.max(...days.map((d) => Math.max(d.income, d.expense)), 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex flex-col gap-[9px]">
        {/* উপরের সারি — আয়। items-end, তাই pill গুলো ছেঁড়া রেখা থেকে
            উপরের দিকে বাড়ে। */}
        <div className="flex h-[84px] items-end justify-between gap-[3px]">
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
              className="flex flex-1 justify-center focus:outline-none"
            >
              <span
                className={`w-full max-w-[52px] rounded-full transition-opacity ${
                  day.income > 0 ? "" : "opacity-40"
                }`}
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
        <div className="flex h-[84px] items-start justify-between gap-[3px]">
          {days.map((day, index) => (
            <button
              key={`expense-${day.label}`}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
              aria-hidden="true"
              className="flex flex-1 justify-center focus:outline-none"
            >
              <span
                className={`w-full max-w-[52px] rounded-full transition-opacity ${
                  day.expense > 0 ? "" : "opacity-40"
                }`}
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
            সরে গেছে। */}
        {activeIndex !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 flex justify-center"
            style={{
              left: `${(activeIndex / days.length) * 100}%`,
              width: `${(1 / days.length) * 100}%`,
            }}
          >
            <span className="h-full border-l-2 border-dashed border-white" />
          </div>
        )}

        {/* Tooltip — Figma: 152×92, #000, radius 12, padding 8, gap 8।
            প্রান্তের কলামে কেন্দ্রে বসালে কার্ডের বাইরে বেরিয়ে যেত,
            তাই প্রথম/শেষ দুটোতে সরিয়ে ধরা হয়। */}
        {activeIndex !== null && (
          <div
            className={`pointer-events-none absolute bottom-full z-10 mb-2 flex w-[152px] flex-col justify-center gap-2 rounded-[12px] bg-black p-2 ${
              activeIndex <= 1
                ? "left-0"
                : activeIndex >= days.length - 2
                  ? "right-0"
                  : "left-1/2 -translate-x-1/2"
            }`}
            role="status"
          >
            <span className="inline-flex w-fit items-center rounded-full bg-white px-[9px] py-1.5 font-sora text-[8px] leading-none text-black">
              {days[activeIndex].fullDate}
            </span>

            <div className="flex flex-col gap-1.5">
              <TooltipRow
                dot="#6DCB66"
                label="Income"
                value={days[activeIndex].incomeLabel}
              />
              <TooltipRow
                dot="#FB7000"
                label="Expense"
                value={days[activeIndex].expenseLabel}
              />
              {/* Figma-তে এই সারির নাম "Revenue"। এখানে "Gross profit",
                  কারণ উপরের সারিটাই আসল revenue — আয় থেকে খরচ বাদ
                  দিলে যেটা থাকে সেটাকে revenue বলা হিসাববিজ্ঞানে ভুল,
                  আর মালিক দুটোকে গুলিয়ে ফেললে ক্ষতিটা কাগজে থাকে না। */}
              <TooltipRow
                dot="#FF3F5C"
                label="Gross profit"
                value={days[activeIndex].profitLabel}
              />
            </div>
          </div>
        )}
      </div>

      {/* দিনের নাম — Figma: Sora 400, 14px, Black/70, padding 0 16px। */}
      <div className="flex justify-between gap-1 px-4">
        {days.map((day) => (
          <span
            key={`label-${day.label}`}
            className={`flex-1 text-center font-sora text-[14px] leading-none tracking-normal ${
              day.isToday ? "font-semibold text-black" : "text-black/70"
            }`}
          >
            {day.label}
          </span>
        ))}
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
        <span className="font-sora text-[12px] leading-none text-white">{label}</span>
      </span>
      <span className="font-frank-ruhl text-[12px] font-medium leading-none text-[#F9F9F9]">
        {value}
      </span>
    </div>
  );
}