"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import {
  SIGNATURE_BANNER,
  SIGNATURE_DISHES,
  type SignatureDish,
} from "@/lib/landing-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/SignatureSection.tsx
 *
 * Figma Frame 2147236005 — "Our Signature": column, padding 100px 80px,
 * gap 60, পটভূমি সেই gradient।
 *
 * ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে ঠিক
 * 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো গোলাপি।
 * Figma-তে কোণ 93.36deg আর গোলাপিটা 145.78%-এ — অর্থাৎ **পর্দার
 * বাইরে**। তাই পুরো মানটা আক্ষরিকভাবে লেখা।
 */
export default function SignatureSection({
  dishes = SIGNATURE_DISHES,
  banner = SIGNATURE_BANNER,
}: {
  dishes?: SignatureDish[];
  banner?: { title: string; image: string };
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/* Frame 2147235253: column, align center, gap 16। */}
        <div className="flex flex-col items-center gap-4">
          {/* Level Button: 146×38, padding 10px 16px, gap 6, radius 100,
              সাদা, বিন্দু 8px #FF9540। */}
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Our Signature
          </motion.span>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="flex max-w-[1008px] flex-col items-center gap-4 xl:gap-5"
          >
            {/**
             * ⚠️ লেখা সাদা, কালো নয় — পটভূমিটা কমলা-গোলাপি gradient।
             * বাকি section-গুলোয় শিরোনাম কালো, এখানে নয়; একই
             * component copy করতে গিয়ে এটা ভুলে যাওয়া সহজ।
             */}
            <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-white md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Discover Our Signature Dishes, Crafted with Fresh Ingredients
            </h2>

            <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-white/80 md:text-[16px]">
              Explore our chef-crafted specialities, prepared with premium ingredients and
              authentic recipes to deliver unforgettable flavor in every bite.
            </p>
          </motion.div>
        </div>

        {/* Frame 2147236012: column, gap 40। */}
        <div className="flex flex-col gap-8 xl:gap-10">
          {/* Frame 2147235270: row, gap 16 — তিনটে কার্ড। */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dishes.map((dish, index) => (
              <motion.article
                key={dish.name}
                initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, ease: EASE, delay: index * 0.1 }}
                /* Food Card: column, padding 12px 12px 20px, gap 16,
                   radius 30, সাদা। */
                className="flex flex-col gap-4 rounded-[30px] bg-white p-3 pb-5"
              >
                {/* Frame 2147225236: ছবির ঘর, radius 24, BG #F9F6F3। */}
                <div className="relative aspect-[392/240] w-full overflow-hidden rounded-[24px] bg-[#F9F6F3]">
                  <Image
                    src={dish.image}
                    alt={dish.name}
                    fill
                    sizes="(min-width: 1024px) 392px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />

                  {/* Rectangle 34628975: উপর থেকে কালোর দিকে gradient —
                      সাদা pill-টা ছবির উপরে পড়ার জন্য। */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-24"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)",
                    }}
                    aria-hidden="true"
                  />

                  {/* Frame 2147235205: 114×30, padding 8px 12px, radius 100। */}
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
                        {dish.name}
                      </h3>

                      <span className="flex shrink-0 items-center gap-1 font-sora text-[14px] font-normal leading-none text-black xl:text-[16px]">
                        {/* ⚠️ `fill` আর `stroke` দুটোই #FF9540 — শুধু
                            `text-[#FF9540]` দিলে lucide-এর তারাটা ফাঁপা
                            থাকত, Figma-তে ভরাট। */}
                        <Star
                          className="h-4 w-4 fill-[#FF9540] text-[#FF9540]"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        {dish.rating}
                      </span>
                    </div>

                    {/**
                     * Frame 2147225242: row, gap 6 — চারটে chip
                     * (padding 4px 8px, radius 30, BG #F9F6F3, 12px)।
                     *
                     * ⚠️ `flex-wrap` — Figma-তে চারটে এক সারিতে ধরে
                     * (368px জায়গায়), কিন্তু কার্ড সরু হলে ধরে না।
                     * ভাঁজ না দিলে chip-গুলো চেপে গিয়ে লেখা কাটা যেত।
                     */}
                    <ul className="flex flex-wrap gap-1.5">
                      {dish.chips.map((chip) => (
                        <li
                          key={chip}
                          className="whitespace-nowrap rounded-[30px] bg-[#F9F6F3] px-2 py-1 font-sora text-[11px] font-normal leading-[1.5] text-black/70 xl:text-[12px]"
                        >
                          {chip}
                        </li>
                      ))}
                    </ul>

                    <p className="font-sora text-[13px] font-normal leading-[1.7] text-black/70 xl:text-[14px]">
                      {dish.description}
                    </p>
                  </div>

                  {/* Button: padding 14px 20px, radius 1000, কালো,
                      লেখা Sora 600 16px সাদা। */}
                  <Link
                    href={dish.href}
                    className="flex h-[46px] w-fit items-center justify-center rounded-full bg-black px-5 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] xl:h-[52px] xl:text-[16px]"
                  >
                    Explore More
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>

          {/**
           * Frame 2147236020: row, gap 114 — বাঁয়ে বড় লেখা, ডানে
           * চওড়া ছবি (847px, radius 30)।
           *
           * ⚠️ ছোট পর্দায় খাড়া — ৩২০px-এ ৩১৪px চওড়া শিরোনাম আর
           * ৮৪৭px ছবি পাশাপাশি বসানোর কোনো উপায় নেই।
           */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex flex-col items-center gap-8 lg:flex-row lg:gap-[114px]"
          >
            <h3 className="max-w-[314px] text-center font-frank-ruhl text-[32px] font-semibold leading-[1.14] tracking-[-0.01em] text-white lg:text-left xl:text-[64px]">
              {banner.title}
            </h3>

            <div className="relative aspect-[847/300] w-full overflow-hidden rounded-[30px] bg-white lg:flex-1">
              <Image
                src={banner.image}
                alt={banner.title}
                fill
                sizes="(min-width: 1024px) 847px, 100vw"
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
