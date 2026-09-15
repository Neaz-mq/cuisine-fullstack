"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
 * FIX (navbar↔hero gap): Figma-র বাইরের frame-এ navbar আর hero-র মাঝে
 * 60px gap, তাই section-এ উপরে padding (xl-এ পুরো 60px)।
 *
 * ── FIX (এই pass): ছবি বদলানোর সময় ফাঁকা জায়গা ─────────────────────
 *
 * সমস্যাটা ছবি লোড হওয়া ছিল না — video-র frame দেখে নিশ্চিত হওয়া
 * গেছে: প্রতি ঘূর্ণনে মাঝের তিনটে কার্ড পুরো গায়েব হয়ে যেত, শুধু
 * কিনারার কার্ড থাকত, তারপর ~১ সেকেন্ড পরে আবার ভেসে উঠত।
 *
 * আসল কারণ: সারিটা তিনটে আলাদা `<div>`-এ ভাগ ছিল (বাঁ দল · নায়ক ·
 * ডান দল)। `key` কেবল **একই parent-এর ভেতরে** কাজ করে। তাই কোনো
 * খাবার ডান দল থেকে নায়কের ঘরে গেলে React পুরনো কার্ডটা মুছে একদম
 * নতুন একটা বানাত। নতুন কার্ড `initial={{ opacity: 0 }}` থেকে শুরু
 * হতো, আর তার উপর প্রথম-লোডের `delay` (0.45s+) আবার খাটত — ফলে
 * প্রায় এক সেকেন্ড মাঝখানটা ফাঁকা।
 *
 * সমাধান, চার ধাপে:
 *
 * (১) সব কার্ড এখন **একটাই** flex সারিতে, stable key সহ। কার্ড আর
 *     কখনো unmount হয় না — শুধু তার class (মাপ) বদলায়, আর
 *     framer-motion-এর `layout` তাকে মসৃণভাবে নতুন জায়গায় নেয়।
 *     একই `<Image>` element থেকে যায়, তাই ছবি আবার লোড হয় না।
 *
 * (২) সব কার্ডে একই `sizes`। আগে পাশের কার্ড ছোট ছবি (264px) আনত,
 *     নায়ক হলে বড়টা (645px) লাগত — নতুন download, আর ততক্ষণ ফাঁকা।
 *     এখন সবাই শুরু থেকেই বড় ছবিটা নেয়।
 *
 * (৩) সব খাবারের ছবি একটা লুকোনো preloader-এ আগেই লোড হয়। সবগুলো
 *     লোড না হওয়া পর্যন্ত ঘোরা শুরু হয় না (সর্বোচ্চ ৬ সেকেন্ড অপেক্ষা,
 *     যাতে কোনো ছবি ভাঙলেও slider আটকে না থাকে)।
 *
 * (৪) ছোট পর্দায় পাশের কার্ড `hidden` (display:none) নয়, বরং
 *     অদৃশ্য (opacity 0) কিন্তু জায়গায় আছে। display:none থাকলে
 *     framer-motion তার আগের অবস্থান মাপতে পারে না, আর কার্ডটা পর্দার
 *     কোণা থেকে উড়ে আসত। এখন সেটা পাশ থেকে সরে আসতে আসতে ফুটে ওঠে।
 *     বাড়তি কার্ডগুলো section-এর `overflow-hidden`-এ কাটা পড়ে।
 */

/**
 * ── animation-এর নিয়ম ─────────────────────────────────────────────
 *
 * উপর থেকে নিচে একটা ক্রম: ব্যাজ → শিরোনাম → বর্ণনা → বোতাম → ছবি।
 * প্রতিটা ধাপ আগেরটার ০.১ সেকেন্ড পরে, আর ওঠে মাত্র ২০px।
 *
 * ⚠️ `as const` **নয়** — ওটা array-টাকে `readonly` করে দেয়, আর
 * framer-motion-এর `ease` চায় সাধারণ `[number, number, number, number]`।
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** কার্ডের জায়গা/মাপ বদলের জন্য shared transition — সব কার্ডে একই। */
const LAYOUT_TRANSITION = {
  type: "tween" as const,
  duration: 1.2,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/** প্রতি কত মিলিসেকেন্ডে এক ঘর ঘোরে। */
const ROTATE_EVERY_MS = 5200;

/** সব ছবি লোড না হলেও এতক্ষণ পরে ঘোরা শুরু হবে। */
const MAX_WAIT_FOR_IMAGES_MS = 6000;

/**
 * ⚠️ সব কার্ডে (আর preloader-এ) হুবহু এই একই `sizes` — তাহলে ব্রাউজার
 * সবখানে একই ছবির URL বেছে নেয়, আর একবার লোড হলেই cache থেকে আসে।
 */
const CARD_SIZES = "(min-width: 1280px) 645px, (min-width: 768px) 480px, 280px";

type Slot = "hero" | "near" | "far";

/**
 * প্রতিটা ঘরের মাপ। Figma-র মাপ অপরিবর্তিত (xl: 645×399 · 264×352 ·
 * 236×313)। ছোট পর্দার জন্য near/far-এরও মাপ দেওয়া হয়েছে, কারণ
 * ওগুলো এখন অদৃশ্য হলেও জায়গা নেয় (উপরের (৪) দেখুন)।
 */
const SLOT_SIZE: Record<Slot, string> = {
  hero: "h-[240px] w-[280px] md:h-[320px] md:w-[480px] xl:h-[399px] xl:w-[645px]",
  near: "h-[200px] w-[150px] md:h-[280px] md:w-[200px] xl:h-[352px] xl:w-[264px]",
  far: "h-[170px] w-[130px] md:h-[240px] md:w-[180px] xl:h-[313px] xl:w-[236px]",
};

/**
 * কোন পর্দায় কোন ঘর দেখা যায় — আগের মতোই:
 * মোবাইলে শুধু নায়ক, md-তে নায়ক + near, xl-এ সবগুলো।
 */
const SLOT_VISIBILITY: Record<Slot, string> = {
  hero: "opacity-100",
  near: "opacity-0 md:opacity-100",
  far: "opacity-0 xl:opacity-100",
};

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
   * আর ঘোরা বন্ধ — vestibular সমস্যায় ভাসমান জিনিস অস্বস্তি তৈরি করে।
   */
  const reduceMotion = useReducedMotion();

  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);

  /**
   * ── ছবি আগে লোড, তারপর ঘোরা ────────────────────────────────────
   * preloader-এর প্রতিটা ছবি লোড (বা ব্যর্থ) হলে তার id এখানে যোগ হয়।
   */
  const [settledIds, setSettledIds] = useState<Set<string>>(() => new Set());
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  const markSettled = (id: string) =>
    setSettledIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  useEffect(() => {
    const timer = setTimeout(() => setWaitedTooLong(true), MAX_WAIT_FOR_IMAGES_MS);
    return () => clearTimeout(timer);
  }, []);

  const imagesReady =
    waitedTooLong || dishes.every((dish) => settledIds.has(String(dish.id)));

  const total = dishes.length;

  useEffect(() => {
    // কম-নড়াচড়া চাইলে, মাউস উপরে থাকলে, বা ছবি তৈরি না হলে ঘোরা বন্ধ।
    if (reduceMotion || paused || !imagesReady || total < 2) return;
    const timer = setInterval(() => setOffset((prev) => prev + 1), ROTATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, paused, imagesReady, total]);

  /**
   * ── কতগুলো ঘর আঁকা হবে ──────────────────────────────────────────
   * ⚠️ ঘরের সংখ্যা সবসময় বিজোড় — তাহলে নায়কের দুপাশে সমান সংখ্যক
   * কার্ড থাকে, আর এক সারিতেই নায়ক ঠিক কেন্দ্রে বসে। খাবার জোড়
   * সংখ্যক হলে একটা খাবার পালা করে মঞ্চের বাইরে থাকে; পরের ঘূর্ণনে
   * সে ডান কিনারা দিয়ে ঢোকে, তাই সবাই একবার করে নায়ক হয়।
   */
  const slotCount = total % 2 === 0 ? total - 1 : total;
  const heroIndex = Math.floor(slotCount / 2);

  /**
   * ── slider কীভাবে কাজ করে ─────────────────────────────────────────
   * জায়গাগুলো স্থির, খাবারগুলো ঘোরে। `position` = ঘরের নম্বর।
   *
   * ⚠️ `lap` — এই খাবারটা কততম পাক দিচ্ছে। একটা কার্ড বাঁ কিনারা থেকে
   * বেরিয়ে ডান কিনারায় ফিরলে `lap` এক বাড়ে, ফলে key বদলায়। তাই
   * সে নায়কের পেছন দিয়ে পুরো সারি পার হয়ে উড়ে যায় না — বাঁয়েরটা
   * ধীরে মিলিয়ে যায়, আর ডানে নতুনটা ধীরে ফুটে ওঠে। বাকি সবার
   * `lap` এক ঘূর্ণন থেকে পরেরটায় একই থাকে, তাই তারা একই element।
   */
  const slots = Array.from({ length: Math.max(slotCount, 0) }, (_, position) => ({
    dish: dishes[(position + offset) % total],
    position,
    lap: Math.floor((position + offset) / total),
  }));

  const slotFor = (position: number): Slot => {
    const distance = Math.abs(position - heroIndex);
    if (distance === 0) return "hero";
    return distance === 1 ? "near" : "far";
  };

  /** প্রথম ঘূর্ণনের পরে যে কার্ড নতুন আসে, তার জন্য কোনো দেরি নয়। */
  const hasRotated = offset > 0;

  const renderCard = (dish: HeroDish, position: number, lap: number) => {
    const slot = slotFor(position);
    const isHero = slot === "hero";

    /**
     * প্রথম লোডে মাঝ থেকে বাইরের দিকে ক্রম — নায়ক আগে, তারপর দুপাশ।
     * ঘোরা শুরু হওয়ার পরে এই দেরি আর খাটে না।
     */
    const delay = hasRotated ? 0 : 0.45 + Math.abs(position - heroIndex) * 0.12;

    return (
      <motion.figure
        /**
         * ⚠️ key = খাবারের id + পাক — অবস্থানের নম্বর নয়। এতে React
         * বোঝে "এই কার্ডটা আগেও ছিল, শুধু জায়গা বদলেছে"।
         */
        key={`${dish.id}-${lap}`}
        layout
        initial={
          reduceMotion
            ? false
            : hasRotated
              ? { opacity: 0, scale: 0.96 }
              : { opacity: 0, y: 40, scale: 0.94 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          reduceMotion
            ? undefined
            : { opacity: 0, scale: 0.96, transition: { duration: 0.6, ease: EASE } }
        }
        transition={{
          opacity: { duration: 0.7, ease: EASE, delay },
          y: { duration: 0.7, ease: EASE, delay },
          scale: { duration: 0.7, ease: EASE, delay },
          layout: LAYOUT_TRANSITION,
        }}
        /* hover-এ পাশের কার্ড সামান্য উঠে আসে। */
        whileHover={reduceMotion || isHero ? undefined : { y: -6 }}
        /**
         * ⚠️ borderRadius `style`-এ, class-এ নয় — framer-motion শুধু
         * style-এ দেওয়া radius-কেই মাপ বদলের সময় ঠিক রাখে। class-এ
         * থাকলে বড়-ছোট হওয়ার সময় কোণাগুলো চ্যাপ্টা দেখাত।
         */
        style={{ borderRadius: 30 }}
        className={`relative shrink-0 overflow-hidden will-change-transform ${SLOT_SIZE[slot]}`}
      >
        {/**
         * ⚠️ দেখানো/লুকানো এই ভেতরের div-এ, CSS transition দিয়ে।
         * figure-এর opacity framer-motion নিয়ন্ত্রণ করে; একই জিনিসে
         * দুজন হাত দিলে একজন আরেকজনকে মুছে দিত।
         */}
        <div
          className={`absolute inset-0 bg-[#EFE9E3] transition-opacity duration-700 ease-out ${SLOT_VISIBILITY[slot]}`}
        >
          <Image
            src={dish.image}
            alt={dish.name}
            fill
            priority
            sizes={CARD_SIZES}
            className="object-cover"
          />
        </div>

        {isHero && (
          <>
            {/* Rectangle 34628974: নিচ থেকে কালোর দিকে gradient,
                যাতে সাদা ঘরগুলো ছবির উপরে পড়া যায়। */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: hasRotated ? 0.3 : 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
              }}
              aria-hidden="true"
            />

            {/**
             * Frame 2147225264: row, gap 12, ছবির নিচে ভাসা।
             *
             * ⚠️ ঘোরার সময় ঘরগুলো একটু দেরিতে (0.45s) আসে — কার্ডটা
             * ততক্ষণে প্রায় পুরো বড় হয়ে যায়, তাই ঘরগুলো টানা/চ্যাপ্টা
             * অবস্থায় দেখা যায় না।
             */}
            <figcaption className="absolute inset-x-2 bottom-3 flex flex-wrap justify-center gap-1.5 md:inset-x-4 md:bottom-4 md:gap-3">
              {nutrients.map((nutrient, i) => (
                <motion.span
                  key={nutrient.label}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: EASE,
                    delay: (hasRotated ? 0.45 : 0.12) + i * 0.06,
                  }}
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
          </>
        )}
      </motion.figure>
    );
  };

  return (
    <section className="relative overflow-hidden bg-[#F9F6F3] pt-6 pb-10 md:pt-10 xl:pt-[60px] xl:pb-[60px]">
      {/**
       * ⚠️ লুকোনো preloader — সব খাবারের ছবি, কার্ডের মতো একই `sizes`
       * দিয়ে। জোড় সংখ্যক খাবার হলে একটা খাবার মঞ্চের বাইরে থাকে; এটা
       * না থাকলে তার ছবি ঢোকার মুহূর্তে লোড হতো। ব্রাউজার একই URL
       * একবারই আনে, তাই কার্ডগুলো সরাসরি cache থেকে পায়।
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
      >
        {dishes.map((dish) => (
          <div key={`preload-${dish.id}`} className="relative h-px w-px">
            <Image
              src={dish.image}
              alt=""
              fill
              loading="eager"
              sizes={CARD_SIZES}
              onLoad={() => markSettled(String(dish.id))}
              onError={() => markSettled(String(dish.id))}
            />
          </div>
        ))}
      </div>

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

          {/* Figma: Frank Ruhl Libre 500, 72px। ছোট পর্দায় 32 → 44 → 56 → 72। */}
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

            {/* Figma: padding `14px 6px 14px 24px` — ডানের সাদা গোল বোতামটাই কিনারা ভরায়। */}
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
       * Frame 2147235994 — খাবারের সারি: row, gap 24, মোট চওড়া 1741।
       *
       * ⚠️ ১৭৪১ > ১২৮০ — Figma-তে সারিটা ইচ্ছা করে দুপাশে উপচে পড়ে।
       * মোড়ক `w-full` (100vw নয়, তাই scrollbar-এর সমস্যা নেই), আর
       * সারিতে `justify-center`। flexbox-এ `justify-content: center`
       * উপচে পড়া অবস্থাতেও দুপাশে **সমান** ছড়ায়, আর ঘরের সংখ্যা
       * বিজোড় ও দুপাশের মাপ একই বলে নায়ক ঠিক কেন্দ্রে থাকে।
       */}
      <div className="mt-9 flex w-full justify-center overflow-hidden xl:mt-[60px]">
        {/**
         * ⚠️ `relative` জরুরি — `AnimatePresence mode="popLayout"`
         * বেরিয়ে যাওয়া কার্ডটাকে এই সারির সাপেক্ষে absolute করে
         * রাখে, যাতে সে মিলিয়ে যাওয়ার সময় বাকিদের জায়গা আটকে না রাখে।
         *
         * মাউস উপরে থাকলে ঘোরা থামে; keyboard focus-এও একই আচরণ।
         */}
        <div
          className="relative flex w-full items-center justify-center gap-3 md:gap-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <AnimatePresence mode="popLayout">
            {total > 0 &&
              slots.map(({ dish, position, lap }) => renderCard(dish, position, lap))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}