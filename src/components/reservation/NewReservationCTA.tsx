"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/reservation/NewReservationCTA.tsx
 *
 * Figma Frame 2147236006 — "Ready to Reserve Another Table for Your
 * Next Visit?"
 *
 * ⚠️ `DeliveryCTA`-র সাথে গড়নটা হুবহু এক, শুধু লেখা আর গন্তব্য আলাদা।
 * একটা component-এ prop দিয়ে দুটো চালানো যেত, কিন্তু তাতে চার-পাঁচটা
 * prop (শিরোনাম, বর্ণনা, বোতামের লেখা, href) — অর্থাৎ call site-এ
 * পড়লে আর বোঝা যেত না কোন পাতায় কী দেখায়। এই আকারে নকলটা সস্তা।
 */
export default function NewReservationCTA() {
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
          <h2 className="max-w-[942px] text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
            Ready to Reserve Another Table for Your Next Visit?
          </h2>

          <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
            Browse available tables, choose your preferred date and time, and book your next
            unforgettable dining experience in just a few clicks.
          </p>
        </div>

        {/* ⚠️ অসম padding (`pl-6 pr-2`) — Figma-র 14px 6px 14px 24px।
            ডানে সাদা গোলটা নিজেই একটা কিনারা তৈরি করে; সমান padding
            দিলে বোতামটা ফোলা দেখাত। MenuCTA/DeliveryCTA-তেও একই। */}
        <Link
          href="/reservation"
          className="flex items-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-2 pl-6 pr-2 transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:4px]"
        >
          <span className="font-sora text-[14px] font-semibold leading-[1.6] text-white md:text-[16px]">
            Make a New Reservation
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
