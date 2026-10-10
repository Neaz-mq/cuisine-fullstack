"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
/* Figma: the round white button holds an arrow (vuesax arrow-right). */
import { ChevronRight } from "lucide-react";
import LiveKitchenModal from "./LiveKitchenModal";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/AboutUs.tsx
 *
 * Figma Frame 2147236007 — সাদা পটভূমিতে একটাই বড় বাক্য, উপরে ব্যাজ,
 * নিচে দুটো বোতাম। Section: column, align center, padding 100px 80px,
 * gap 80, BG #FFFFFF।
 */

/**
 * বাক্যের ভেতরের "দাগ দেওয়া" অংশ।
 *
 * ⚠️ Figma-তে দাগগুলো আলাদা আয়তক্ষেত্র (Rectangle 34628910), যার
 * নির্দিষ্ট স্থানাঙ্ক দেওয়া — `left: 101px; top: 204.2px`। ওভাবে
 * বসানো যেত না: ওই সংখ্যাগুলো ঠিক তখনই খাটে যখন লেখাটা হুবহু ওই
 * তিন লাইনে ভাঙে। পর্দা সরু হলে, ফন্ট দেরিতে লোড হলে, বা লেখাটা
 * একদিন বদলালে দাগগুলো লেখার সাথে সম্পর্কহীন জায়গায় ভেসে থাকত।
 *
 * তাই দাগটা লেখারই অংশ — একটা `<mark>`। লাইন ভাঙলে দাগও ভাঙে,
 * লেখা বদলালে দাগও সরে। কমলা খাড়া দাগ আর বিন্দুটা `::before`-এর
 * বদলে একটা `<span>`, কারণ ওটাকে দাগের বাইরে (উপরে) বসাতে হয়।
 */
function Mark({
  children,
  side = "start",
}: {
  children: React.ReactNode;
  /** কমলা কাঁটাটা দাগের কোন প্রান্তে — Figma-তে প্রথমটায় শুরুতে,
      দ্বিতীয়টায় শেষে। */
  side?: "start" | "end";
}) {
  return (
    <mark className="relative bg-[#F9F6F3] px-1 text-black">
      {children}
      <span
        aria-hidden="true"
        /* 74px at Figma's 56px text = 1.32em — in `em` so the marker
           grows and shrinks with the heading at every screen size. */
        /* Figma: the first marker hangs down from a dot at the top (before
           "ingredients"); the second rises to a dot at the bottom (after
           "love"), like a text cursor at each end of the highlight. */
        className={`pointer-events-none absolute hidden h-[1.32em] w-px bg-[#FB7000] md:block ${
          side === "start" ? "bottom-0 left-0" : "right-0 top-0"
        }`}
      >
        {/* Ellipse 13328: 10px round dot at the marker's outer end. */}
        <span
          className={`absolute -left-[4.5px] h-2.5 w-2.5 rounded-full bg-[#FB7000] ${
            side === "start" ? "-top-[10px]" : "-bottom-[10px]"
          }`}
        />
      </span>
    </mark>
  );
}

export default function AboutUs() {
  const reduceMotion = useReducedMotion();
  const [kitchenOpen, setKitchenOpen] = useState(false);

  /**
   * ⚠️ `whileInView`, `animate` নয় — এই section পাতার অনেক নিচে।
   * `animate` দিলে animation-টা কেউ না দেখতেই শেষ হয়ে যেত।
   * `once: true` — বারবার scroll করলে প্রতিবার নতুন করে ভেসে ওঠা
   * বিরক্তিকর।
   */
  const rise = {
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
  };

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      {/* Gaps follow Figma: badge → heading 24px; heading → buttons 36px
          (Frame 2147236024 gap 36 = 24 + the buttons' mt-3). It used to be
          80px everywhere, which left big empty bands. */}
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-5 xl:gap-6">
        {/* Level Button: 113×38, padding 10px 16px, gap 6, radius 100,
            BG #F9F6F3, বিন্দু 8px #FF9540, লেখা Sora 400 14px। */}
        <motion.span
          {...rise}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-center gap-1.5 rounded-full bg-[#F9F6F3] px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
          About Us
        </motion.span>

        {/**
         * Figma: Frank Ruhl Libre 500, 56px, line-height 150%,
         * letter-spacing -0.01em, মাঝবরাবর, চওড়া 1280।
         *
         * ⚠️ ছোট পর্দায় ৫৬px-এ একেকটা শব্দ পুরো লাইন খেয়ে ফেলত,
         * তাই ধাপে ধাপে 24 → 32 → 44 → 56। line-height ১৫০% সব
         * ধাপেই — ওটাই দাগগুলোকে শ্বাস নেওয়ার জায়গা দেয়; আঁটসাঁট
         * করলে দাগদুটো একটার গায়ে আরেকটা লেগে যেত।
         */}
        <motion.h2
          {...rise}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          /* Figma: 3 lines at 56px Frank Ruhl Libre 500, line-height 150%.
             The breaks are FIXED like Figma (<br> from 1024px up), so screen
             width or zoom can't re-wrap it into 2 or 4 lines. Sizes step
             down only as far as needed for the longest line to fit:
               2xl (1440+)  56px → 1248 of 1280 (Figma exact)
               xl  (1280+)  48px → 1071 of 1120
               lg  (1024+)  40px →  894 of 944
             Phones/tablets wrap naturally; `text-balance` keeps it even. */
          className="max-w-[1280px] text-balance text-center font-frank-ruhl text-[24px] font-medium leading-[1.5] tracking-[-0.01em] text-black md:text-[32px] lg:text-[40px] xl:text-[48px] 2xl:text-[56px]"
        >
          Great food brings people together. Our chefs craft
          <br className="hidden lg:inline" /> every dish with fresh{" "}
          <Mark side="start">ingredients, bold flavors, and</Mark>
          <br className="hidden lg:inline" />{" "}
          <Mark side="end">passion to create meals you&apos;ll love</Mark> to share.
        </motion.h2>

        {/* Frame 2147235232: row, gap 12। */}
        <motion.div
          {...rise}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          className="mt-3 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/chefs"
            className="flex h-[50px] items-center justify-center rounded-[90px] border border-black px-6 font-sora text-[14px] font-semibold leading-[1.6] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-14 xl:px-6 xl:text-[16px]"
          >
            Read More
          </Link>

          {/* Figma: padding `14px 6px 14px 24px` — ডান দিকটা মাত্র 6,
              কারণ ভেতরের সাদা গোল বোতামটাই (44px) ডান কিনারা ভরায়।

              ⚠️ এটা <Link> নয়, <button>: "Live Kitchen" কোনো পাতা নয়,
              একটা action (ভিডিও দেখা)। Read More আর এটা আগে দুটোই
              /chefs-এ যেত — দুই বোতামের একই গন্তব্য মানে একটা বাড়তি।
              এখন ভিডিও modal-এ খোলে, ব্যবহারকারী পাতা ছেড়ে যায় না। */}
          <button
            type="button"
            onClick={() => setKitchenOpen(true)}
            aria-haspopup="dialog"
            className="group flex h-[50px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-3.5 pl-6 pr-1.5 font-sora text-[14px] font-semibold leading-[1.6] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-14 xl:text-[16px]"
          >
            Live Kitchen
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white xl:h-11 xl:w-11">
              <ChevronRight
                className="h-[18px] w-[18px] text-black transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
          </button>
        </motion.div>
      </div>

      <LiveKitchenModal open={kitchenOpen} onClose={() => setKitchenOpen(false)} />
    </section>
  );
}