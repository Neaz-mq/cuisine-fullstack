"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
/**
 * ⚠️ `UtensilsCrossed` নয়, `ChefHat` আর `Calendar` — ওই দুটো প্রজেক্টে
 * আগে থেকেই ব্যবহৃত, অর্থাৎ এই lucide সংস্করণে আছে তা প্রমাণিত।
 */
import { ArrowRight, Calendar, ChefHat } from "lucide-react";
import {
  HERO_DISHES,
  HERO_NUTRIENTS,
  type HeroDish,
  type HeroNutrient,
} from "@/lib/landing-content";

/**
 * src/components/landing/Hero.tsx
 *
 * Figma Frame 2147236004 — ব্যাজ → শিরোনাম → বর্ণনা → দুটো বোতাম →
 * খাবারের সারি। Section: padding 0 80px 60px, gap 60, BG #F9F6F3।
 *
 * ⚠️ `"use client"` — framer-motion-এর জন্য। ডেটা এখনো prop হিসেবেই
 * আসে, তাই পরে backend যুক্ত হলে server component থেকে prop পাঠালেই
 * চলবে; এই ফাইলটা ছুঁতে হবে না।
 *
 * ⚠️ ছবি `next/image` দিয়ে, `<img>` দিয়ে নয় — Cloudinary host
 * `next.config.ts`-এ আগে থেকেই অনুমোদিত (Buffet/Signature ওখান থেকেই
 * ছবি আনে), তাই optimization বিনামূল্যে পাওয়া যায়।
 */

/**
 * ── animation-এর নিয়ম ─────────────────────────────────────────────
 *
 * সবকিছু একসাথে ভেসে উঠলে সেটা animation নয়, ঝাঁকুনি। তাই উপর থেকে
 * নিচে একটা ক্রম: ব্যাজ → শিরোনাম → বর্ণনা → বোতাম → ছবি। প্রতিটা
 * ধাপ আগেরটার ০.১ সেকেন্ড পরে, আর ওঠে মাত্র ২০px — বড় লাফ চোখে
 * লাগে, ছোট সরণ মসৃণ লাগে।
 *
 * `ease` হিসেবে cubic-bezier `[0.22, 1, 0.36, 1]` — শুরুতে দ্রুত,
 * শেষে ধীরে থেমে আসে। রৈখিক গতি যান্ত্রিক লাগে; এটা স্বাভাবিক।
 */
/**
 * ⚠️ `as const` **নয়** — ওটা array-টাকে `readonly` করে দেয়, আর
 * framer-motion-এর `ease` চায় সাধারণ `[number, number, number, number]`।
 * Kitchen-এর Prisma `in`-এ ঠিক এই ভুলেই একবার build ভেঙেছিল, তাই
 * এখানে ধরনটা সরাসরি লিখে দেওয়া।
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const riseUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export default function Hero({
  dishes = HERO_DISHES,
  nutrients = HERO_NUTRIENTS,
}: {
  dishes?: HeroDish[];
  nutrients?: HeroNutrient[];
}) {
  /**
   * ⚠️ যিনি system-এ "কম নড়াচড়া" চালু রেখেছেন, তাঁর জন্য সব animation
   * বন্ধ। এটা রুচির প্রশ্ন নয় — vestibular সমস্যা থাকলে ভাসমান জিনিস
   * সত্যিকারের অস্বস্তি (মাথা ঘোরা, বমিভাব) তৈরি করে। তখন জিনিসগুলো
   * কেবল জায়গামতো বসে থাকে, কিছুই হারায় না।
   */
  const reduceMotion = useReducedMotion();

  /**
   * ── slider কীভাবে কাজ করে ─────────────────────────────────────────
   *
   * ⚠️ সারিটাকে বাঁয়ে সরানো (`translateX`) হয়নি, আর কারণটা জ্যামিতিক:
   * কার্ডগুলোর প্রস্থ সমান নয় (645 · 264 · 236)। সমান হলে "এক কার্ড
   * সমান সরাও" বলা যেত; অসমান বলে প্রতিবার আলাদা দূরত্ব হিসাব করতে
   * হতো, আর একটুও ভুল হলে সারিটা মাঝ থেকে সরে যেত।
   *
   * তার বদলে **জায়গাগুলো স্থির, খাবারগুলো ঘোরে**। প্রতি ৪ সেকেন্ডে
   * তালিকাটা এক ঘর ঘুরে যায়, তাই মাঝের বড় ঘরে নতুন একটা খাবার আসে।
   * প্রতিটা `<figure>`-এ `layout` আর `layoutId` থাকায় framer-motion
   * নিজেই পুরনো জায়গা-মাপ থেকে নতুনটায় মসৃণভাবে নিয়ে যায় — কার্ড
   * বড় হয়, পাশেরটা ছোট হয়, সবই একসাথে।
   *
   * ফল: "স্লাইড" নয়, বরং একটা morph — এতে Figma-র বিন্যাসটা এক
   * পিক্সেলও নড়ে না, শুধু ভেতরের খাবার বদলায়।
   */
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // কম-নড়াচড়া চাইলে, বা মাউস উপরে থাকলে, ঘোরা বন্ধ।
    if (reduceMotion || paused || dishes.length < 2) return;
    const timer = setInterval(() => setOffset((prev) => prev + 1), 4000);
    return () => clearInterval(timer);
  }, [reduceMotion, paused, dishes.length]);

  /**
   * ⚠️ `offset` বাড়তেই থাকে, কখনো শূন্যে ফেরে না — `% dishes.length`
   * এখানেই করা হয়। ফেরত আনলে (যেমন `setOffset((p+1) % n)`) কোনো
   * সমস্যা হতো না, কিন্তু এভাবে ঘোরার সংখ্যাটাও জানা থাকে, আর
   * ভবিষ্যতে "কতবার ঘুরল" দরকার হলে হাতের কাছেই।
   */
  const ordered = dishes.map(
    (_, index) => dishes[(index + offset) % dishes.length]
  );

  const heroIndex = Math.floor(dishes.length / 2);

  const sizeFor = (index: number) => {
    const distance = Math.abs(index - heroIndex);
    if (distance === 0) return "hero";
    return distance === 1 ? "near" : "far";
  };

  /**
   * একটা কার্ড আঁকে। আগে এটা `map`-এর ভেতরে বেনামে ছিল; তিন
   * ভাগে ভাঙার পরে তিন জায়গা থেকেই ডাকতে হয়, তাই আলাদা।
   * `index` **অবস্থানের** নম্বর (0…4) — মাপ আর দেরি দুটোই
   * ওটা থেকেই ঠিক হয়, খাবারটা কে সেটা থেকে নয়।
   */
  const renderCard = (dish: HeroDish, index: number) => {
              const size = sizeFor(index);

              /**
               * ⚠️ ক্রমটা মাঝ থেকে বাইরের দিকে, বাঁ থেকে ডানে নয় —
               * `Math.abs(index - heroIndex)`। মাঝের বড় ছবিটা আগে আসে,
               * তারপর দুপাশে ছড়িয়ে পড়ে। বাঁ-থেকে-ডান ক্রমে নায়কটা
               * তিন নম্বরে আসত, আর চোখ প্রথমে কোথায় যাবে সেটা ঠিক
               * করা যেত না।
               */
              const delay = 0.45 + Math.abs(index - heroIndex) * 0.12;

              if (size === "hero") {
                return (
                  <motion.figure
                    /**
                     * ⚠️ `key` খাবারের id, অবস্থানের নম্বর নয় — এটাই
                     * পুরো slider-টা কাজ করার শর্ত। id দিলে React
                     * বোঝে "এই কার্ডটা আগেও ছিল, শুধু জায়গা বদলেছে",
                     * আর framer-motion তখন পুরনো মাপ থেকে নতুন মাপে
                     * নিয়ে যেতে পারে। `key={index}` দিলে React ভাবত
                     * প্রতিটা ঘরে নতুন কার্ড এসেছে, আর animation-এর
                     * বদলে হঠাৎ ঝিলিক দিত।
                     */
                    key={dish.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.7,
                      ease: EASE,
                      delay,
                      // মাপ/জায়গা বদলের জন্য আলাদা, একটু ধীর গতি —
                      // spring নয়, কারণ spring-এ কার্ডটা থেমে গিয়ে
                      // সামান্য দুলত, আর ৬৪৫px চওড়া জিনিসে সেটা চোখে লাগে।
                      layout: { duration: 0.85, ease: EASE },
                    }}
                    className="relative h-[240px] w-[280px] shrink-0 overflow-hidden rounded-[30px] bg-white md:h-[320px] md:w-[480px] xl:h-[399px] xl:w-[645px]"
                  >
                    <Image
                      src={dish.image}
                      alt={dish.name}
                      fill
                      priority
                      sizes="(min-width: 1280px) 645px, (min-width: 768px) 480px, 280px"
                      className="object-cover"
                    />

                    {/* Rectangle 34628974: নিচ থেকে কালোর দিকে gradient,
                        যাতে সাদা ঘরগুলো ছবির উপরে পড়া যায়। */}
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px]"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
                      }}
                      aria-hidden="true"
                    />

                    {/* Frame 2147225264: row, gap 12, ছবির নিচে ভাসা। */}
                    {/**
                     * ⚠️ ঘরগুলোর দেরি ছোট আর স্থির (0.12 + i×0.06),
                     * কার্ডের `delay`-এর সাথে যুক্ত নয়।
                     *
                     * কারণ: মাঝের ঘরে নতুন খাবার এলে এই ঘরগুলো নতুন
                     * করে mount হয়, আর তখন প্রথম-লোডের দেরিটা (০.৮s)
                     * আবার খাটত — ছবিটার নিচের অংশ প্রায় এক সেকেন্ড
                     * খালি পড়ে থাকত, প্রতি ৪ সেকেন্ডে একবার। ছোট
                     * দেরিতে ঘোরাটা মসৃণ থাকে, আর প্রথম লোডেও ঘরগুলো
                     * ছবির ঠিক পরেই আসে।
                     */}
                    <figcaption className="absolute inset-x-2 bottom-3 flex flex-wrap justify-center gap-1.5 md:inset-x-4 md:bottom-4 md:gap-3">
                      {nutrients.map((nutrient, i) => (
                        <motion.span
                          key={nutrient.label}
                          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          /* ছবিটা বসার পরে ঘরগুলো একটা একটা করে — ছবির
                             আগে এলে ওগুলো শূন্যে ভাসত। */
                          transition={{ duration: 0.4, ease: EASE, delay: 0.12 + i * 0.06 }}
                          className="flex min-w-[64px] flex-col items-center gap-1 rounded-[14px] px-3 py-2 md:min-w-[100px] md:px-6 xl:min-w-[133px]"
                          style={{ backgroundColor: nutrient.tint }}
                        >
                          <span className="font-sora text-[10px] font-normal leading-none text-black/70 md:text-[12px]">
                            {nutrient.label}
                          </span>
                          <span className="font-sora text-[12px] font-semibold leading-none text-black md:text-[16px]">
                            {nutrient.value}
                          </span>
                        </motion.span>
                      ))}
                    </figcaption>
                  </motion.figure>
                );
              }

              /**
               * ⚠️ পাশের কার্ডগুলো ছোট পর্দায় লুকোনো। ৩২০px-এ মাঝেরটাই
               * ২৮০px জোড়ে — পাশে জায়গা নেই, আর জোর করে রাখলে সবগুলোই
               * এত সরু হতো যে খাবার চেনা যেত না।
               */
              return (
                <motion.figure
                  key={dish.id}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.7,
                    ease: EASE,
                    delay,
                    layout: { duration: 0.85, ease: EASE },
                  }}
                  /* hover-এ সামান্য উঠে আসে — ছবিগুলো যে জীবন্ত, সেটুকুই। */
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                  /**
                   * ⚠️ base-এ আর `md:block` নেই — দেখানো/লুকানোর নিয়ম
                   * এখন পুরোটাই নিচের শাখা দুটোয়। আগে base-এ
                   * `md:block` আর "far" শাখায় `md:hidden` দুটোই ছিল,
                   * অর্থাৎ একই media query-তে দুটো বিপরীত নিয়ম — কে
                   * জিতবে তা Tailwind-এর CSS-ক্রম ঠিক করত, আর সেটাই
                   * সারিটা এক পাশে হেলিয়ে দিচ্ছিল।
                   */
                  className={`relative shrink-0 overflow-hidden rounded-[30px] bg-[#F3F3F3] ${
                    size === "near"
                      ? "hidden md:block md:h-[280px] md:w-[200px] xl:h-[352px] xl:w-[264px]"
                      : "hidden xl:block xl:h-[313px] xl:w-[236px]"
                  }`}
                >
                  <Image
                    src={dish.image}
                    alt={dish.name}
                    fill
                    sizes="(min-width: 1280px) 264px, 200px"
                    className="object-cover"
                  />
                </motion.figure>
              );
  };

  return (
    <section className="overflow-hidden bg-[#F9F6F3] pb-10 xl:pb-[60px]">
      <motion.div
        className="mx-auto flex max-w-[1280px] flex-col items-center gap-9 px-4 md:px-10 xl:px-20"
        variants={container}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Level Button: 303×38, padding 10, gap 6, radius 100, সাদা। */}
          <motion.span
            variants={riseUp}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <ChefHat className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Fresh Flavors, Right at Your Doorstep
          </motion.span>

          {/**
           * Figma: Frank Ruhl Libre 500, 72px, মাঝবরাবর, চওড়া 1108।
           *
           * ⚠️ ছোট পর্দায় ৭২px অসম্ভব — ৩২০px-এ একটা শব্দও আঁটে না।
           * তাই ধাপে ধাপে: 32 → 44 → 56 → 72, line-height সব ধাপেই ১.১।
           */}
          <motion.h1
            variants={riseUp}
            className="max-w-[1108px] text-center font-frank-ruhl text-[32px] font-medium leading-[1.1] tracking-[-0.01em] text-black md:text-[44px] lg:text-[56px] xl:text-[72px]"
          >
            Savor Every Flavor, Relish Every Bite, and Create Delicious Memories
          </motion.h1>

          <motion.p
            variants={riseUp}
            className="max-w-[882px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px] xl:text-[18px]"
          >
            Enjoy chef-crafted meals made with fresh, locally sourced ingredients and delivered
            hot to your doorstep. Every bite is prepared with passion, quality, and unforgettable
            flavor.
          </motion.p>

          {/* Frame 2147235232: row, gap 12। */}
          <motion.div
            variants={riseUp}
            className="mt-2 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/dine-in"
              className="flex h-[50px] items-center justify-center gap-1.5 rounded-[90px] border border-black px-6 font-sora text-[14px] font-semibold leading-[1.6] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-14 xl:text-[16px]"
            >
              Book a Table
              <Calendar className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            </Link>

            {/**
             * Figma: padding `14px 6px 14px 24px` — ডান দিকটা মাত্র 6,
             * কারণ ভেতরের সাদা গোল বোতামটাই (44px) ডান কিনারা ভরায়।
             *
             * ⚠️ `group` + তীরের `group-hover:translate-x-0.5` — hover-এ
             * তীরটা এক চুল ডানে সরে। ছোট, কিন্তু এতেই বোতামটা "চাপার
             * মতো" লাগে; বড় কিছু করলে চটক লাগত।
             */}
            <Link
              href="/menu"
              className="group flex h-[50px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-3.5 pl-6 pr-1.5 font-sora text-[14px] font-semibold leading-[1.6] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-14 xl:text-[16px]"
            >
              Order Now
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white xl:h-11 xl:w-11">
                <ArrowRight
                  className="h-4 w-4 text-black transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </span>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/**
       * ⚠️ এই ব্লকটা এখন `motion.div`-এর **বাইরে**, section-এর সরাসরি
       * সন্তান — আর সেটাই কেন্দ্রীকরণের আসল সংশোধন।
       *
       * আগে মোড়কটা ছিল `w-screen` (= 100vw), আর 100vw-এর ভেতরে
       * উল্লম্ব scrollbar-এর প্রস্থও ধরা থাকে। পাতার দৃশ্যমান অংশ
       * কিন্তু (100vw − scrollbar)। ফলে বাক্সটা কেন্দ্রে বসলেও তার
       * ডান কিনারা scrollbar-এর নিচে ঢুকে যেত, আর ডান দিকের কার্ডটা
       * বাঁয়েরটার চেয়ে ~৮px বেশি কাটা পড়ত। ঠিক ওটাই আপনি দেখছিলেন।
       *
       * এখন section-এর আড়াআড়ি padding সরিয়ে লেখার মোড়কে দেওয়া হয়েছে,
       * তাই এই ব্লকটা `w-full` — অর্থাৎ পাতার **দৃশ্যমান** প্রস্থ,
       * scrollbar বাদে। কোনো viewport-একক নেই, তাই কাটাও দুপাশে সমান।
       */}
      <div className="mt-9 flex w-full justify-center overflow-x-hidden overflow-y-hidden xl:mt-[60px]">

        {/**
         * Frame 2147235994 — খাবারের সারি: row, gap 24, মোট চওড়া 1741।
         *
         * ⚠️ ১৭৪১ > ১২৮০, অর্থাৎ Figma-তে সারিটা **ইচ্ছাকৃতভাবে দুপাশে
         * উপচে পড়ে** — কিনারার কার্ডদুটো অর্ধেক কাটা থাকে, যেন মনে হয়
         * সারিটা পর্দার বাইরেও চলে গেছে।
         *
         * সেটা করতে মোড়কটা section-এর পুরো প্রস্থ জোড়ে (`w-full`) আর
         * ভেতরে `justify-center`। আগে এখানে `w-screen` + `left-1/2` +
         * `-translate-x-1/2` ছিল — ওটাই scrollbar-এর সমস্যা তৈরি
         * করছিল, বিস্তারিত উপরের মন্তব্যে।
         */}
        {/**
         * ⚠️ `flex justify-center`, `mx-auto` নয় — আর এই পার্থক্যটাই
         * আসল ভুল ছিল।
         *
         * ভেতরের সারিটা (1741px) মোড়কের চেয়ে চওড়া। block layout-এ
         * উপচে পড়া সন্তানের `margin-left: auto` **0-তে নেমে আসে**
         * (CSS-এর over-constrained নিয়ম), তাই `mx-auto` কিছুই কেন্দ্রে
         * আনে না — সারিটা বাঁ কিনারা ধরে বসে থাকে, ফলে বাঁ দিকের
         * কার্ডটা প্রায় পুরো কাটা পড়ে আর ডানেরটা সামান্য।
         *
         * flexbox-এ `justify-content: center` উপচে পড়া অবস্থাতেও
         * দুপাশে **সমান** ছড়ায় — ঠিক যেটা Figma করেছে
         * (`left: calc(50% - 1741px/2)`)। তাই দুই কিনারার কার্ড
         * সমানভাবে কাটে, আর দেখতে ইচ্ছাকৃত লাগে।
         */}
          {/* ⚠️ মাউস উপরে থাকলে ঘোরা থামে — কেউ একটা ছবি দেখছেন
              মানে ওটা সরে যাওয়া উচিত নয়। `onFocus`/`onBlur`-ও আছে,
              যাতে keyboard-এ চলাফেরা করলেও একই আচরণ হয়। */}
          <div
            /* ⚠️ `w-full`, `w-max` নয় — দুই পাশের দল `flex-1 basis-0` দিয়ে
               জায়গা ভাগ করে নেয়, আর সেটা তখনই সম্ভব যখন সারিটার
               নিজের একটা প্রস্থ আছে। `w-max` মানে "যত লাগে তত", তাতে
               ভাগ করার মতো কিছুই থাকত না।

               `px-4`-ও সরানো — ওটা থাকলে ছোট পর্দায় নায়কের কেন্দ্র
               ১৬px সরে যেত। */
            className="flex w-full items-center gap-3 md:gap-6"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            {/**
             * ⚠️ সারিটা তিন ভাগে: বাঁ দল · নায়ক · ডান দল — একটামাত্র
             * `map` নয়। কারণটাই এই সংশোধনের মূল কথা।
             *
             * আগে পাঁচটা কার্ড একটা `justify-center` সারিতে ছিল, আর
             * নায়ক কেন্দ্রে পড়ত **কেবল যদি** দুপাশের প্রস্থ হুবহু সমান
             * হয়। কিন্তু পাশের কার্ডগুলো breakpoint অনুযায়ী লুকোয়
             * (`md:hidden xl:block`), আর base ক্লাসেও একটা `md:block`
             * থাকায় ওই দুটো নিয়ম একই media query-তে সংঘর্ষে যেত —
             * কে জিতবে তা Tailwind-এর তৈরি CSS-এর ক্রম ঠিক করত।
             * ফলে কোনো মাপে বাঁ দিকে একটা কার্ড কম পড়ত, আর গোটা
             * সারিটা ডানে সরে যেত।
             *
             * এখন প্রস্থের উপর কিছুই নির্ভর করে না। দুই দল
             * `flex-1 basis-0`, অর্থাৎ **সমান** জায়গা পায়, আর নায়ক
             * তাদের মাঝখানে — যত কার্ডই লুকোক বা দেখাক, কেন্দ্র
             * কেন্দ্রেই থাকে। দলদুটোর ভেতরের কার্ড জায়গার চেয়ে চওড়া
             * বলে বাইরের দিকে উপচে পড়ে (`justify-end` বাঁয়ে,
             * `justify-start` ডানে), আর মোড়কের `overflow-hidden`
             * দুপাশে সমানভাবে কেটে দেয় — Figma-র মতোই।
             *
             * ⚠️ `min-w-0` — এই একটা ক্লাস ছাড়া উপরের পুরো যুক্তিটা
             * খাটে না, আর ঠিক এখানেই একবার আটকেছিলাম।
             *
             * flex item-এর ডিফল্ট `min-width: auto`, অর্থাৎ একটা দল
             * নিজের ভেতরের কার্ডের চেয়ে **সরু হতে পারে না**। ফলে
             * `flex-1 basis-0` লেখা সত্ত্বেও দুই দল 524px করে দখল
             * করে রাখত, তিনটে মিলিয়ে 1741px — সারির নিজের প্রস্থের
             * (`w-full`) চেয়ে বেশি। তখন বাড়তিটুকু পুরোটাই ডান দিকে
             * উপচে পড়ত (flex-এর ডিফল্ট `flex-start`), আর নায়ক
             * ~100px ডানে সরে যেত।
             *
             * `min-w-0` দিলে দল দুটো সত্যিই ফাঁকা জায়গা সমান ভাগ
             * করে নেয়, আর ভেতরের কার্ডগুলো (`shrink-0`) দলের সীমানা
             * ছাড়িয়ে বাইরের দিকে বেরিয়ে যায় — যেটাই আমরা চাই।
             */}
            <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-3 md:gap-6">
              {ordered.slice(0, heroIndex).map((dish, index) => renderCard(dish, index))}
            </div>

            {renderCard(ordered[heroIndex], heroIndex)}

            <div className="flex min-w-0 flex-1 basis-0 items-center justify-start gap-3 md:gap-6">
              {ordered
                .slice(heroIndex + 1)
                .map((dish, i) => renderCard(dish, heroIndex + 1 + i))}
            </div>
          </div>
        </div>
    </section>
  );
}