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
    <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#FF9540] to-[#FF70C6] p-6 md:p-8">
      {/* ডান পাশের সিঁড়ি-নকশা। aria-hidden — এটা কোনো তথ্য বহন করে না,
          screen reader-এ ২০টা খালি div পড়ে শোনানোর কোনো মানে নেই। */}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-6 right-6 hidden gap-1.5 md:flex">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="flex flex-col-reverse gap-1.5">
            {Array.from({ length: col }).map((_, row) => (
              <div
                key={row}
                className="h-6 w-6 rounded-md bg-white"
                // উপরের ঘরগুলো বেশি অস্বচ্ছ — Figma-র সিঁড়িটা নিচ থেকে
                // উপরে গাঢ় হয়।
                style={{ opacity: 0.25 + row * 0.18 }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
          <CircleDollarSign className="h-6 w-6 text-[#121212]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="font-frank-ruhl text-[20px] font-semibold text-white">
          Total Revenue
        </span>
      </div>

      <div className="relative mt-10 flex items-center gap-4">
        <p className="font-frank-ruhl text-[36px] font-bold leading-none text-white md:text-[44px]">
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

      <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
        {deltaPercent === null ? (
          <span className="font-sora text-[12px] text-[#121212]">
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
              className={`font-sora text-[12px] font-semibold ${
                up ? "text-green-600" : "text-red-500"
              }`}
            >
              {up ? "+" : ""}
              {deltaPercent}%
            </span>
            <span className="font-sora text-[12px] text-[#121212]">
              {up ? "balance increase, good progress" : "down versus last week"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}