"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SERVICES, type ServiceItem } from "@/lib/landing-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/ServicesSection.tsx
 *
 * Figma Frame 2147235252 — "Our Services": column, padding 100px 80px,
 * gap 60, BG #F9F6F3। উপরে ব্যাজ + শিরোনাম + বর্ণনা, নিচে ছটা কার্ড
 * (দুই সারিতে তিনটে করে, gap 16)।
 *
 * ⚠️ নামটা `ServicesSection`, `Services` নয় — প্রজেক্টে আগে থেকেই
 * `src/components/Services.tsx` আছে (পুরনো নকশার)। একই নামে দুটো
 * ফাইল থাকলে import-এ কোনটা আসছে তা এক নজরে বোঝা যেত না, আর এই
 * সেশনেই মৃত `staff-modal-ui.tsx`-এ কাজ করে একবার ঘণ্টা নষ্ট হয়েছে।
 */
export default function ServicesSection({
  services = SERVICES,
}: {
  services?: ServiceItem[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/* Frame 2147235253: column, align center, gap 16। */}
        <div className="flex flex-col items-center gap-4">
          {/* Level Button: 137×38, padding 10px 16px, gap 6, radius 100,
              সাদা, বিন্দু 8px #FF9540, লেখা Sora 400 14px। */}
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Our Services
          </motion.span>

          {/* Frame 2147235271: column, gap 20, চওড়া 980। */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="flex max-w-[980px] flex-col items-center gap-4 xl:gap-5"
          >
            {/* Figma: Frank Ruhl Libre 600, 64px, মাঝবরাবর।
                ছোট পর্দায় ধাপে ধাপে 28 → 40 → 52 → 64। */}
            <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Delicious Food and Exceptional Service for Every Occasion
            </h2>

            <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
              Enjoy freshly prepared meals made with premium ingredients, authentic recipes, and a
              passion for exceptional flavor.
            </p>
          </motion.div>
        </div>

        {/**
         * Frame 2147236012 — ছটা কার্ড।
         *
         * ⚠️ Figma-তে এটা দুটো আলাদা সারি (Frame 2147235270), প্রতিটায়
         * তিনটে করে। এখানে একটাই grid, `lg:grid-cols-3` — ফল একই,
         * কিন্তু সংখ্যা বদলালে (৫ বা ৯টা service) নিজে থেকেই সামলে
         * নেয়। দুটো স্থির সারি লিখলে সাতটা service-এ সপ্তমটা কোথাও
         * যেত না।
         */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <motion.article
              key={service.index}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              /* ⚠️ দেরিটা `index % 3` দিয়ে, `index` দিয়ে নয় — নাহলে
                 ষষ্ঠ কার্ডের দেরি হতো ০.৫s, আর দ্বিতীয় সারিটা
                 আসতে আসতে প্রথম সারি অনেকক্ষণ একা দাঁড়িয়ে থাকত।
                 সারি ধরে গোনায় প্রতিটা সারি নিজের মতো ভেসে ওঠে। */
              transition={{ duration: 0.55, ease: EASE, delay: (index % 3) * 0.1 }}
              /* Services Card: column, 416×359, padding 28, gap 100,
                 radius 30, সাদা। উচ্চতাটা স্থির নয় — লেখা লম্বা হলে
                 কার্ড বাড়ুক, কাটা না যাক; তাই `justify-between` আর
                 একটা সর্বনিম্ন উচ্চতা। */
              className="relative flex min-h-[280px] flex-col justify-between gap-10 overflow-hidden rounded-[30px] bg-white p-6 xl:min-h-[359px] xl:p-7"
            >
              {/**
               * Vector 7957 — কার্ডের গা বেয়ে চলে যাওয়া ঢেউ।
               *
               * ⚠️ আকৃতিটা Figma-র মতো **এক পূর্ণ তরঙ্গ**: বাঁ অর্ধে
               * একটা চূড়া, ডান অর্ধে একটা খাদ। মাঝখানে একটামাত্র
               * চূড়া রেখে আগে সরল করেছিলাম — সেটা জোড়া লাগত ঠিকই,
               * কিন্তু নকশাটা আর Figma-র থাকত না।
               *
               * জোড়া লাগার শর্ত দুটো, আর এই পথ দুটোই মানে:
               *
               *   উচ্চতা : বাঁয়ে y=69, ডানে y=69        → সমান
               *   ঢাল    : দুই প্রান্তেই দিক (45, −41)   → হুবহু এক
               *
               * ঢালটা মেলানো হয়েছে `S` (smooth cubic) দিয়ে: দ্বিতীয়
               * বাঁকের প্রথম control বিন্দুটা SVG নিজেই প্রথম বাঁকের
               * প্রতিফলন হিসেবে বসায়, তাই তরঙ্গটা মাঝখানে ভাঙে না,
               * আর শেষ control (371,110) থেকে শেষ বিন্দু (416,69)
               * পর্যন্ত দিকটা শুরুর দিকের সমান হয়।
               *
               * ফল: এক কার্ডের ডান কিনারা আর পরের কার্ডের বাঁ কিনারা
               * একই উচ্চতায়, একই কোণে — মাঝের ১৬px ফাঁক পেরিয়েও
               * রেখাটা একটানা দেখায়।
               *
               * ⚠️ Figma-র `rotate(-0.81deg)` বসাইনি। ঘোরালে বাঁ
               * কিনারা নিচে আর ডান কিনারা উপরে সরে যায় — ৪১৬px
               * কার্ডে পার্থক্য ৫.৯px, অর্থাৎ প্রতিটা জোড়ায় ছয়
               * পিক্সেলের একটা ধাপ। Figma-তে ধাপটা দেখা যায় না,
               * কারণ ওখানে তিনটে কার্ড **একই** ঘোরানো frame-এর
               * ভেতরে; আমাদের কার্ডগুলো আলাদা, তাই প্রত্যেকে আলাদা
               * করে ঘোরে। এক ডিগ্রির কম হেলানোর জন্য জোড়া ভাঙার
               * দাম দেওয়া যায় না।
               *
               * ⚠️ `left: -49.38px` / `width: 539.43px`-ও বসাইনি।
               * ওগুলোর কাজ ছিল ঢেউয়ের প্রান্ত কার্ডের বাইরে ফেলে
               * দেওয়া, কিন্তু সেটা খাটে কেবল ৪১৬px চওড়া কার্ডে —
               * আমাদের কার্ড পর্দা অনুযায়ী বদলায়, তাই কাটা-পড়ার
               * বিন্দু সরে গিয়ে উপরের দুটো শর্তই নষ্ট হতো।
               */}
              <svg
                aria-hidden="true"
                viewBox="0 0 416 138"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 top-[19%] h-[38%] w-full"
              >
                <path
                  d="M0 104 C 78 104, 112 22, 208 22 C 304 22, 338 104, 416 104"
                  fill="none"
                  stroke="#F9F6F3"
                  strokeWidth="20"
                  /* গোল মাথা কিনারায় সামান্য বেরিয়ে গিয়ে জোড়ায়
                     একটা ফোলা তৈরি করত, তাই `butt`। */
                  strokeLinecap="butt"
                />
              </svg>

              {/* Frame 2147235265: row, space-between। */}
              <div className="relative z-10 flex items-center justify-between gap-4">
                {/**
                 * ⚠️ "Services" কালো, সংখ্যাটা ফিকে — Figma-র ছবিতে
                 * দুটোর রঙ আলাদা, যদিও CSS export-এ একটাই text node
                 * (`Feature 01`, #000000)। export একটা node-এর ভেতরের
                 * আংশিক রঙ দেখাতে পারে না, তাই ওখানে পার্থক্যটা
                 * হারিয়ে গেছে; ছবিতে স্পষ্ট।
                 */}
                <span className="font-frank-ruhl text-[20px] font-normal leading-[1.3] text-black xl:text-[24px]">
                  Services <span className="text-black/30">{service.index}</span>
                </span>

                {/* Frame 2147235205: 97×30, padding 8px 12px, radius 100,
                    BG #F9F6F3, লেখা 12px। */}
                <Link
                  href={service.href}
                  className="shrink-0 whitespace-nowrap rounded-full bg-[#F9F6F3] px-3 py-2 font-sora text-[12px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                >
                  Explore More
                </Link>
              </div>

              {/* Frame 2147235266: column, gap 20। */}
              <div className="relative z-10 flex flex-col gap-4 xl:gap-5">
                <h3 className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
                  {service.title}
                </h3>

                {/* Line 235: 1.5px, #F9F6F3, পুরো প্রস্থ — শিরোনাম আর
                    বর্ণনার মাঝে। `border-t` দিয়ে, `<hr>` দিয়ে নয়:
                    `<hr>`-এর নিজস্ব margin আছে যা gap-এর সাথে যোগ
                    হয়ে ফাঁকটা অসম করে দিত। */}
                <span
                  className="block h-0 w-full border-t-[1.5px] border-[#F9F6F3]"
                  aria-hidden="true"
                />
                <p className="font-sora text-[13px] font-normal leading-[1.7] text-black/70 xl:text-[14px]">
                  {service.description}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
