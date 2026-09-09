"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/reservation/DeliveryCTA.tsx
 *
 * Figma Frame 2147236006 — পাতার শেষ ডাক:
 * column, padding 100px 80px, gap 60, BG #F9F6F3, সব মাঝবরাবর।
 *
 *   শিরোনাম   Frank Ruhl 600, 64px, চওড়া 1008
 *   বর্ণনা     Sora 400, 16px, চওড়া 636
 *   বোতাম      gradient pill — padding 14px 6px 14px 24px, gap 12,
 *              ভেতরে সাদা গোল 44px + তীর
 *
 * ⚠️ বোতামের ডান দিকের padding মোটে 6px, বাঁয়ে 24 — অসম, আর সেটা
 * ইচ্ছাকৃত: ডানে সাদা গোলটা নিজেই একটা দৃশ্যমান কিনারা তৈরি করে।
 * সমান padding দিলে গোলটা ভেতরে ঢুকে গিয়ে বোতামটা ফোলা দেখাত।
 * "Our Chefs" পাতার MenuCTA-তেও হুবহু একই বোতাম।
 */
export default function DeliveryCTA() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 xl:gap-9"
      >
        <div className="flex flex-col items-center gap-4 xl:gap-5">
          <h2 className="max-w-[1008px] text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
            Prefer Delivery Instead? Get Your Favorite Meals Delivered Fresh
          </h2>

          <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
            Enjoy restaurant-quality dishes delivered straight to your doorstep with fast,
            reliable service and fresh ingredients in every order.
          </p>
        </div>

        <Link
          href="/menu"
          className="flex items-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-2 pl-6 pr-2 transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:4px]"
        >
          <span className="font-sora text-[14px] font-semibold leading-[1.6] text-white md:text-[16px]">
            Order Now
          </span>

          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white xl:h-11 xl:w-11"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
            </svg>
          </span>
        </Link>
      </motion.div>
    </section>
  );
}
