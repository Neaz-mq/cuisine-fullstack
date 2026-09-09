"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/reservation/ReservationHero.tsx
 *
 * Figma "Web/Menu" → Frame 2147235230 — পাতার প্রথম পর্দা:
 * column, align center, gap 16, BG #F9F6F3, নিচে padding 60।
 *
 *   Level Button   সাদা pill, radius 100, padding 10, gap 6 — "Book a Table"
 *   শিরোনাম        Frank Ruhl Libre 500, 72px, line-height 100%, মাঝবরাবর
 *   বর্ণনা          Sora 400, 18px, line-height 160%, Black/70, চওড়া 678
 *
 * ⚠️ Topbar, navbar আর footer এখানে নেই — ওরা `app/(main)/layout.tsx`-এ,
 * প্রতিটা পাতায় ভাগ করা। Figma-র frame-এ ওগুলো ধরা আছে বলে এখানেও
 * বসিয়ে দিলে পাতায় দুটো করে navbar থাকত।
 *
 * ⚠️ ৭২px ছোট পর্দায় ধাপে ধাপে নামে (32 → 44 → 56 → 72)। ৩২০px-এ ৭২
 * রাখলে "Occasion" শব্দটাই পর্দার চেয়ে চওড়া হতো।
 */
export default function ReservationHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#F9F6F3] px-4 pb-12 pt-8 md:px-10 md:pb-16 md:pt-10 xl:px-20 xl:pb-[60px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4">
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
        >
          {/* Figma-তে fluent:food-20-regular; একই ওজনের inline SVG, যাতে
              এই একটা আইকনের জন্য নতুন package না লাগে। */}
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6 2.5a.5.5 0 0 0-1 0v3a1.5 1.5 0 0 0 1 1.415V17.5a.5.5 0 0 0 1 0V6.915A1.5 1.5 0 0 0 8 5.5v-3a.5.5 0 0 0-1 0v3a.5.5 0 0 1-1 0v-3ZM13.5 2a2.5 2.5 0 0 0-2.5 2.5v5A1.5 1.5 0 0 0 12.5 11h.5v6.5a.5.5 0 0 0 1 0v-15a.5.5 0 0 0-.5-.5Z" />
          </svg>
          Book a Table
        </motion.span>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="flex max-w-[1082px] flex-col items-center gap-4 xl:gap-6"
        >
          <h1 className="text-center font-frank-ruhl text-[32px] font-medium leading-[1.1] tracking-[-0.01em] text-black md:text-[44px] lg:text-[56px] xl:text-[72px] xl:leading-none">
            Reserve Your Perfect Table for Every Special Occasion
          </h1>

          <p className="max-w-[678px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px] xl:text-[18px]">
            Celebrate life&apos;s special moments with exceptional food, warm hospitality, and a
            memorable dining experience.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
