"use client";

import { useState } from "react";

export interface RevenueDay {
  /** "Sat", "Sun" … */
  label: string;
  /** পুরো তারিখ, tooltip-এর মাথায় — "Mar 23, 2025"। */
  fullDate: string;
  /** কেবল উচ্চতা ঠিক করতে; টাকার হিসাব নয়। */
  revenue: number;
  /** সাজানো-শেষ string গুলো — Decimal browser-এ পাঠানো যায় না, তাই
   *  server-এই সাজিয়ে পাঠানো হয়। */
  grossLabel: string;
  taxLabel: string;
  revenueLabel: string;
  orders: number;
  /** আজকের কলামে Figma-র সাদা ছেঁড়া-দাগ। */
  isToday: boolean;
}

/**
 * src/components/admin/dashboard/RevenueBubbleChart.tsx
 *
 * Figma-র সাপ্তাহিক আয়ের নকশা।
 *
 * জ্যামিতিটা Figma-র inspect panel থেকে হুবহু: প্রতিটা দিন একটা
 * **fixed 52px চওড়া** আকৃতি, উচ্চতা 84px, radius 100px (তাই বৃত্ত নয়,
 * লম্বাটে উপবৃত্ত), সারিটা space-between, আর ভরাট অংশের রঙ
 * Primary/100 = #FF9540।
 *
 * ⚠️ চওড়া কখনো বদলায় না — মান বোঝায় কেবল উচ্চতা। আগের version-এ
 * ব্যাসটাই মানের সাথে বাড়ত, যাতে দুটো সমস্যা ছিল: Figma-র সাথে মিলত
 * না, আর বৃত্তের ক্ষেত্রফল ব্যাসের বর্গের সাথে বাড়ে বলে ছবিটা
 * পার্থক্যকে বাস্তবের চেয়ে অনেক বাড়িয়ে দেখাত।
 */

/** Figma-র তির্যক ডোরা। rgba, যাতে একই কায়দা কমলা ভরাট আর ফ্যাকাশে
 *  পটভূমি — দুটোতেই বসে। */
const STRIPES =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.38) 0 5px, transparent 5px 11px)";

/** Layout panel: Height Hug (84px)। */
const TRACK_HEIGHT = 84;

export default function RevenueBubbleChart({ days }: { days: RevenueDay[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  // সপ্তাহের গড় — Figma-র ছেঁড়া অনুভূমিক রেখাটা এখানেই বসে। মকআপে
  // রেখাটার কোনো নাম দেওয়া নেই, কিন্তু একটা তুলনার রেখা ছাড়া ওটা নিছক
  // অলঙ্কার হয়ে যেত; গড়ই সবচেয়ে কাজের, কারণ তখন এক নজরেই বোঝা যায়
  // কোন দিনগুলো সপ্তাহটাকে টেনে তুলছে আর কোনগুলো নামাচ্ছে।
  const average = days.reduce((sum, d) => sum + d.revenue, 0) / (days.length || 1);
  const averageOffset = Math.min((average / maxRevenue) * TRACK_HEIGHT, TRACK_HEIGHT);

  return (
    <div className="relative flex items-end justify-between gap-2">
      {/* গড়ের ছেঁড়া রেখা — কলামগুলোর পেছনে, পুরো চওড়া জুড়ে। label-এর
          উচ্চতা (~2rem) বাদ দিয়ে হিসাব, কারণ bottom-0 মানে label-এর
          নিচের প্রান্ত, track-এর নয়। */}
      {average > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-300"
          style={{ bottom: `calc(2rem + ${averageOffset}px)` }}
        />
      )}

      {days.map((day, index) => {
        const active = activeIndex === index;
        // ন্যূনতম ১০% — নাহলে একটা ব্যতিক্রমী দিন (ধরা যাক ঈদের বিক্রি)
        // বাকি ছয় দিনকে ২%-এ নামিয়ে দিত, অর্থাৎ ১-২ পিক্সেলের একটা
        // অদৃশ্য ফালি। তখন "সেদিন কোনো বিক্রিই হয়নি" আর "হয়েছে, তবে
        // কম" — দুটো এক দেখাত, অথচ পার্থক্যটাই সবচেয়ে জরুরি।
        const fillPercent = day.revenue > 0 ? Math.max((day.revenue / maxRevenue) * 100, 10) : 0;

        return (
          <div key={day.label} className="relative flex flex-1 flex-col items-center gap-3">
            {active && (
              <div className="absolute bottom-full z-10 mb-3 w-44 rounded-2xl bg-[#121212] p-3 text-white shadow-lg">
                <p className="inline-block rounded-full bg-white px-2.5 py-1 font-sora text-[10px] font-medium text-[#121212]">
                  {day.fullDate}
                </p>

                {/* Figma-তে তিনটে সারি (Income / Expense / Revenue)।
                    এই app-এ খরচের হিসাব নেই, কিন্তু একই তিনটে সারি
                    সৎভাবেই ভরে: বিল, কর, আর কর বাদে যা থাকে। */}
                {[
                  { dot: "bg-green-400", label: "Gross", value: day.grossLabel },
                  { dot: "bg-[#FF9540]", label: "Tax", value: day.taxLabel },
                  { dot: "bg-pink-400", label: "Revenue", value: day.revenueLabel },
                ].map((row) => (
                  <div key={row.label} className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-sora text-[11px]">
                      <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
                      {row.label}
                    </span>
                    <span className="font-sora text-[11px] font-semibold">{row.value}</span>
                  </div>
                ))}

                <p className="mt-2 border-t border-white/15 pt-2 font-sora text-[10px] text-white/60">
                  {day.orders} {day.orders === 1 ? "order" : "orders"}
                </p>
              </div>
            )}

            <button
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              // onFocus/onBlur — Tab চেপেও একই তথ্য পাওয়া যায়, শুধু
              // mouse থাকলে নয়।
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${day.fullDate}: ${day.revenueLabel} from ${day.orders} orders`}
              // w-full + max-w-[52px]: Figma-র মাপ 52px, কিন্তু সরু
              // পর্দায় ৭টা কলাম আঁটাতে ওরা ছোট হতে পারে। বড় পর্দায়
              // ঠিক 52px-এই থেমে যায়।
              className="relative w-full max-w-[52px] overflow-hidden rounded-full bg-[#F1EDE9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9540]"
              style={{ height: TRACK_HEIGHT }}
            >
              {/* ফ্যাকাশে পটভূমির ডোরা — Figma-র উপরের ফিকে অংশটা। */}
              <span
                aria-hidden="true"
                className="absolute inset-0 opacity-60"
                style={{ backgroundImage: STRIPES }}
              />

              {/* ভরাট অংশ, নিচ থেকে উঠে আসে। rounded-full track-এর ভেতরে
                  overflow-hidden থাকায় নিচের বাঁকটা এমনিতেই সঠিক আকারে
                  কাটা পড়ে। */}
              {fillPercent > 0 && (
                <span
                  className={`absolute inset-x-0 bottom-0 rounded-full bg-[#FF9540] ${
                    active ? "opacity-100" : "opacity-95"
                  }`}
                  style={{ height: `${fillPercent}%` }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundImage: STRIPES }}
                  />
                </span>
              )}

              {/* আজকের কলামে খাড়া সাদা ছেঁড়া-দাগ। */}
              {day.isToday && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white/85"
                />
              )}
            </button>

            <span
              className={`font-sora text-[12px] ${
                day.isToday ? "font-semibold text-[#121212]" : "text-gray-500"
              }`}
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}