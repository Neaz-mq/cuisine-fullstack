"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { WHY_US, WHY_US_IMAGE, type WhyUsCard } from "@/lib/chefs-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/chefs/WhyGuestsChooseUs.tsx
 *
 * Figma Frame 2147236011 — "Why Guests Choose Us":
 * column, padding 100px 80px, gap 60, BG #F9F6F3।
 *
 *   Frame 2147236171   দুই কলাম, gap 60, align-items **flex-end**
 *     বাঁয়ে 731px       pill + শিরোনাম (64px) + বর্ণনা, নিচে ২×২ কার্ড
 *     ডানে 489×599      ছবি, radius 30, উপরে কালো gradient +
 *                       "World famous chefs" সাদা pill
 *
 * ⚠️ Figma-র `align-items: flex-end` অনুসরণ করা হয়েছে (`lg:items-end`)
 * — অর্থাৎ দুই কলামের **নিচের** কিনারা মেলে, উপরেরটা নয়। বাঁ পাশের
 * লেখা ছবির চেয়ে খাটো, তাই উপরে মেলালে নিচে একটা বেখাপ্পা ফাঁক
 * থাকত।
 */
export default function WhyGuestsChooseUs({
  cards = WHY_US.cards,
}: {
  cards?: WhyUsCard[];
}) {
  const reduceMotion = useReducedMotion();

  const rise = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.6, ease: EASE, delay },
  });

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 lg:flex-row lg:items-end xl:gap-[60px]">
        {/* ── বাঁ দিক ─────────────────────────────────────────────── */}
        <div className="flex w-full flex-col gap-8 lg:w-[58%] xl:gap-[60px]">
          <motion.div {...rise()} className="flex flex-col gap-4 xl:gap-5">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              {WHY_US.badge}
            </span>

            <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[48px] xl:text-[64px]">
              {WHY_US.title}
            </h2>

            <p className="max-w-[686px] font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
              {WHY_US.description}
            </p>
          </motion.div>

          {/* Services Card ×4 — সাদা, radius 20, padding 28। */}
          <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
            {cards.map((card, index) => (
              <motion.div
                key={card.title}
                {...rise(0.05 * index)}
                className="flex flex-col gap-4 rounded-[20px] bg-white p-5 xl:gap-5 xl:p-7"
              >
                {/* ⚠️ শিরোনামে `min-h` দেওয়া আছে যাতে "Authentic Recipes"
                    (এক লাইন) আর "Outstanding Customer Service" (দুই লাইন)
                    পাশাপাশি বসলে ওদের নিচের রেখাটা এক সমতলে থাকে। */}
                <h3 className="font-frank-ruhl text-[16px] font-medium leading-[1.3] text-black min-[560px]:min-h-[52px] xl:text-[20px]">
                  {card.title}
                </h3>

                {/* Line 235: 1.5px, রঙ #F9F6F3 — সাদা কার্ডের ভেতরে
                    section-এর নিজের পটভূমির রঙেই একটা বিভাজক। */}
                <span className="h-[1.5px] w-full shrink-0 bg-[#F9F6F3]" aria-hidden="true" />

                <p className="font-sora text-[12px] font-normal leading-[1.7] text-black/70">
                  {card.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── ডান দিক: ছবি ────────────────────────────────────────── */}
        <motion.div
          {...rise(0.15)}
          className="relative aspect-[489/420] w-full overflow-hidden rounded-[20px] bg-black/5 lg:aspect-[489/599] lg:w-[42%] xl:rounded-[30px]"
        >
          <Image
            src={WHY_US_IMAGE}
            alt="Our chefs serving a buffet"
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
          />

          {/* Rectangle 34628975: উপর থেকে কালো gradient, উচ্চতা 63 —
              সাদা pill-টা যেকোনো ছবির উপরেই দেখা যায় এর কারণে। */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent"
          />

          <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 font-sora text-[11px] font-normal leading-[1.2] text-black xl:text-[12px]">
            {WHY_US.imageBadge}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
