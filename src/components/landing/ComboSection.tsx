"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { CircleCheck, Star } from "lucide-react";
import { COMBO_DEALS, type ComboDeal } from "@/lib/landing-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/ComboSection.tsx
 *
 * Figma Frame 2147236006 — "Combo Deals": column, padding 100px 80px,
 * gap 60, BG #F9F6F3।
 *
 * কার্ডের গড়ন Signature-এর কার্ডের প্রায় হুবহু (একই 416×, padding
 * 12/12/20, radius 30), তিনটে জিনিস বাড়তি:
 *   • ছবির বাঁ-উপরে ছাড়ের ব্যাজ
 *   • কমলা টিক সহ "কী কী থাকছে" তালিকা
 *   • দামের সারি — নতুন দাম, কাটা পুরনো দাম, gradient বোতাম
 *
 * ⚠️ তবু দুটো আলাদা component, একটা শেয়ার্ড কার্ড নয়। কারণ
 * ভেতরের পার্থক্য তিনটে **ঐচ্ছিক অংশ** নয়, গঠনগত: Signature-এর
 * বোতাম কালো আর কার্ডের নিচে একা, এখানে gradient আর দামের পাশে।
 * একটা component-এ দুটোই ধরাতে গেলে prop দিয়ে শাখা বানাতে হতো,
 * আর তখন কোনটা কোথায় বদলাচ্ছে সেটা পড়ে বোঝা কঠিন হতো।
 */
export default function ComboSection({ deals = COMBO_DEALS }: { deals?: ComboDeal[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/* Frame 2147235253: column, align center, gap 16। */}
        <div className="flex flex-col items-center gap-4">
          {/* Level Button: 142×38, padding 10px 16px, gap 6, radius 100, সাদা। */}
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Combo Deals
          </motion.span>

          {/* Frame 2147235271: column, gap 20, চওড়া 872। */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="flex max-w-[872px] flex-col items-center gap-4 xl:gap-5"
          >
            <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Meet Our Perfect Matches: Curated Combo Meals
            </h2>

            <p className="max-w-[672px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
              Why choose just one? We&apos;ve paired our chef-crafted favorites together so you can
              get the best flavors, the best variety, and the best value all in one go.
            </p>
          </motion.div>
        </div>

        {/* Frame 2147235270: row, gap 16। */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal, index) => (
            <motion.article
              key={deal.name}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: EASE, delay: index * 0.1 }}
              /* Food Card 2: column, padding 12px 12px 20px, gap 16,
                 radius 30, সাদা। */
              className="flex flex-col gap-4 rounded-[30px] bg-white p-3 pb-5"
            >
              {/* Frame 2147225236: ছবির ঘর, radius 24, BG #F9F6F3। */}
              <div className="relative aspect-[392/240] w-full overflow-hidden rounded-[24px] bg-[#F9F6F3]">
                <Image
                  src={deal.image}
                  alt={deal.name}
                  fill
                  sizes="(min-width: 1024px) 392px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />

                {/* Rectangle 34628975: উপরে হালকা কালো gradient, যাতে
                    দুটো সাদা pill ছবির উপরে পড়া যায়। */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)",
                  }}
                  aria-hidden="true"
                />

                {/* Frame 2147235206: 51×30 — ছাড়ের ব্যাজ, বাঁ-উপরে। */}
                <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] font-normal leading-none text-black">
                  {deal.discount}
                </span>

                {/* Frame 2147235205: 114×30 — ডান-উপরে। */}
                <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] font-normal leading-none text-black">
                  Food Available
                </span>
              </div>

              {/* Frame 2147235266: column, padding 0 12px, gap 20। */}
              <div className="flex flex-col gap-5 px-3">
                <div className="flex flex-col gap-3">
                  {/* Frame 2147236014: row, gap 20 — নাম + রেটিং। */}
                  <div className="flex items-center justify-between gap-5">
                    <h3 className="min-w-0 font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
                      {deal.name}
                    </h3>

                    <span className="flex shrink-0 items-center gap-1 font-sora text-[14px] font-normal leading-none text-black xl:text-[16px]">
                      {/* ⚠️ `fill` আর `stroke` দুটোই #FF9540 — শুধু
                          `text-` দিলে lucide-এর তারা ফাঁপা থাকত। */}
                      <Star
                        className="h-4 w-4 fill-[#FF9540] text-[#FF9540]"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      {deal.rating}
                    </span>
                  </div>

                  {/* Frame 2147225242: row, gap 6 — চারটে chip। */}
                  <ul className="flex flex-wrap gap-1.5">
                    {deal.chips.map((chip) => (
                      <li
                        key={chip}
                        className="whitespace-nowrap rounded-[30px] bg-[#F9F6F3] px-2 py-1 font-sora text-[11px] font-normal leading-[1.5] text-black/70 xl:text-[12px]"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/**
                 * Frame 2147236027 — "কী কী থাকছে": প্রতিটা সারিতে
                 * কমলা টিক + লেখা (Sora 400 14px), মাঝে gap 6।
                 *
                 * ⚠️ `<ul>` দিয়ে, সাজানো `<div>` দিয়ে নয় — এটা
                 * সত্যিকারের তালিকা, আর screen reader-এ "৩টি জিনিসের
                 * তালিকা" শোনা গেলে combo-টায় কী আছে সেটা বোঝা যায়।
                 * টিকগুলো `aria-hidden`, নাহলে প্রতিটা লাইনের আগে
                 * "image" বলে পড়ত।
                 */}
                <ul className="flex flex-col gap-2">
                  {deal.includes.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-1.5 font-sora text-[13px] font-normal leading-[1.5] text-black xl:text-[14px]"
                    >
                      <CircleCheck
                        className="h-4 w-4 shrink-0 text-[#FF9540]"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="font-sora text-[13px] font-normal leading-[1.7] text-black/70 xl:text-[14px]">
                  {deal.description}
                </p>

                {/**
                 * Frame 2147236028: row, gap 20 — বাঁয়ে দাম, ডানে বোতাম।
                 *
                 * ⚠️ `flex-wrap` — Figma-তে দুটো এক সারিতে ধরে (368px),
                 * কিন্তু কার্ড সরু হলে "$19.89 $16.99" আর ১৩৯px বোতাম
                 * একসাথে আঁটে না; ভাঁজ না দিলে বোতামটা চেপে গিয়ে
                 * লেখা কাটা যেত।
                 */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Frame 2147236152: row, gap 12। */}
                  <p className="flex items-baseline gap-3">
                    <span className="font-frank-ruhl text-[20px] font-medium leading-none text-black xl:text-[24px]">
                      {deal.price}
                    </span>
                    {/* ⚠️ `line-through` কেবল দেখতে; screen reader-এ
                        "আগের দাম" কথাটা না থাকলে দুটো দাম পাশাপাশি
                        শুনে বিভ্রান্তি হতো। */}
                    <span className="font-frank-ruhl text-[14px] font-medium leading-none text-black/40 line-through xl:text-[16px]">
                      <span className="sr-only">Was </span>
                      {deal.wasPrice}
                    </span>
                  </p>

                  {/* Button: padding 14px 24px, radius 100, gradient,
                      লেখা Sora 600 16px সাদা। */}
                  <Link
                    href={deal.href}
                    className="flex h-[46px] items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-6 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-[52px] xl:text-[16px]"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
