"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  JOURNEY,
  JOURNEY_IMAGE,
  JOURNEY_STATS,
  type JourneyStat,
} from "@/lib/chefs-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/chefs/OurJourney.tsx
 *
 * Figma Frame 2147235253 — "From a Small Kitchen to Your Doorstep":
 * column, padding 100px 80px, gap 60, BG সাদা।
 *
 *   Details card   দুই কলাম, gap 60
 *     বাঁয়ে         ছবি 626×531, radius 30, নিচে কালো gradient,
 *                   তার উপরে সাদা "2016 / Since" কার্ড (radius 14)
 *     ডানে          cream কার্ড, radius 20, padding 30 — pill +
 *                   শিরোনাম (Frank Ruhl 46px) + দুই অনুচ্ছেদ
 *   Frame 2147236071  চারটে পরিসংখ্যান কার্ড, gap 30, উচ্চতা 120
 */
export default function OurJourney({ stats = JOURNEY_STATS }: { stats?: JourneyStat[] }) {
  const reduceMotion = useReducedMotion();

  const rise = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.6, ease: EASE, delay },
  });

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/**
          * ⚠️ `lg:` breakpoint-এ দুই কলাম, `md:`-তে নয়।
          *
          * ডান কার্ডে ৪৬px শিরোনাম আর ২৭০ শব্দের লেখা — ট্যাবলেটে
          * অর্ধেক চওড়ায় ফেললে ওটা লম্বা সরু একটা স্তম্ভ হয়ে যেত আর
          * বাঁ পাশের ছবির চেয়ে অনেক বেশি উঁচু হতো।
          */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch xl:gap-[60px]">
          {/* ── বাঁ দিক: ছবি ─────────────────────────────────────── */}
          <motion.div
            {...rise()}
            className="relative aspect-[626/440] w-full shrink-0 overflow-hidden rounded-[20px] bg-[#F9F6F3] lg:aspect-auto lg:min-h-[440px] lg:w-1/2 xl:min-h-[531px] xl:rounded-[30px]"
          >
            <Image
              src={JOURNEY_IMAGE}
              alt="Our chefs at work in the kitchen"
              fill
              // ⚠️ `sizes` না দিলে next/image প্রতিটা পর্দার জন্য
              // ১০০vw ধরে সবচেয়ে বড় ফাইলটাই নামায় — মোবাইলে
              // অকারণে কয়েকশো কিলোবাইট।
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority={false}
            />

            {/* Rectangle 34628974: নিচ থেকে কালো gradient, উচ্চতা 140।
                সাদা কার্ডটা পড়ার মতো contrast পায় এখান থেকেই। */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[140px] bg-gradient-to-b from-transparent to-black"
            />

            {/* Inner Card: বাঁ-নিচে, padding 20px 30px, radius 14। */}
            <div className="absolute bottom-5 left-5 flex flex-col items-center gap-2 rounded-[14px] bg-white px-6 py-4 xl:bottom-[30px] xl:left-[30px] xl:px-[30px] xl:py-5">
              <span className="font-sora text-[14px] font-semibold leading-[1.2] text-black">
                {JOURNEY.since.value}
              </span>
              <span className="font-sora text-[12px] font-normal leading-[1.2] text-black/70">
                {JOURNEY.since.label}
              </span>
            </div>
          </motion.div>

          {/* ── ডান দিক: cream লেখার কার্ড ────────────────────────── */}
          <motion.div
            {...rise(0.1)}
            className="flex w-full flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-5 md:p-8 lg:w-1/2 xl:gap-4 xl:p-[30px]"
          >
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              {JOURNEY.badge}
            </span>

            <h2 className="font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[34px] xl:text-[46px]">
              {JOURNEY.title}
            </h2>

            {/* ⚠️ প্রতিটা অনুচ্ছেদ নিজের <p>-তে — কেন, তার ব্যাখ্যা
                lib/chefs-content.ts-এর `paragraphs`-এ। */}
            <div className="flex flex-col gap-4">
              {JOURNEY.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="font-sora text-[14px] font-normal leading-[1.5] text-black/70 md:text-[16px] xl:text-[18px]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        </div>

        {/**
          * ── পরিসংখ্যান ─────────────────────────────────────────────
          *
          * ⚠️ ৩২০px-এ দুই কলাম, চারটে নয়। চারটে পাশাপাশি রাখলে
          * প্রতিটা কার্ড ~৬০px চওড়া হতো, আর "Years Serving Guests"
          * সেখানে অক্ষরে অক্ষরে ভেঙে পড়ত।
          */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 xl:gap-[30px]">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              {...rise(0.05 * index)}
              className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-[14px] bg-[#F9F6F3] px-4 text-center xl:min-h-[120px] xl:px-[30px]"
            >
              <span className="font-sora text-[20px] font-semibold leading-[1.2] text-black xl:text-[24px]">
                {stat.value}
              </span>
              <span className="font-sora text-[12px] font-normal leading-[1.2] text-black/70 xl:text-[14px]">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
