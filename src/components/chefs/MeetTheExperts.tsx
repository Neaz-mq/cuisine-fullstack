"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { CHEFS, EXPERTS_HEADING, type Chef } from "@/lib/chefs-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/chefs/MeetTheExperts.tsx
 *
 * Figma — "Meet the Experts Behind Every Dish": ব্র্যান্ড gradient-এর
 * উপরে ছটা শেফ কার্ড, তিন কলামে দুই সারি।
 *
 * প্রতিটা কার্ড: ছবি, নিচ থেকে কালো gradient, তার উপরে ভূমিকা (ছোট),
 * নাম (Frank Ruhl), আর দুটো ট্যাগ — বিশেষত্ব আর অভিজ্ঞতা।
 *
 * ⚠️ gradient-টা `93.36deg, #FF9540 0%, #FF70C6 145.78%` — হুবহু সেই
 * একই মান যা logo, Sign Up বোতাম আর admin-এর PRIMARY_BUTTON-এ চলে।
 * নতুন করে লেখা হয়নি, কারণ কোণ বা stop সামান্য এদিক-ওদিক হলে পাশাপাশি
 * রাখলে দুটো আলাদা কমলা দেখাত।
 */
export default function MeetTheExperts({
  heading = EXPERTS_HEADING,
  chefs = CHEFS,
}: {
  heading?: string;
  chefs?: Chef[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-[30px]">
        <motion.h2
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-white md:text-[32px] xl:text-[40px]"
        >
          {heading}
        </motion.h2>

        {/**
          * ⚠️ ৩২০px-এ এক কলাম, ৬৪০-এ দুই, ১০২৪-এ তিন।
          *
          * শেফের ছবিগুলো portrait; সরু পর্দায় দুই কলামে ফেললে প্রতিটা
          * ~১৪০px চওড়া হতো আর মুখগুলো চেনাই যেত না — অথচ এই অংশটার
          * পুরো উদ্দেশ্যই মানুষগুলোকে দেখানো।
          */}
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 lg:grid-cols-3">
          {chefs.map((chef, index) => (
            <motion.article
              key={chef.id}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 * index }}
              /* Figma "Feedback tablet/Chef": 416×340, radius 24। aspect আগে 4/3
                 (1.33) ছিল — Figma-র 416/340 (1.22)-এর চেয়ে বেশি চওড়া, ফলে
                 object-cover উপর-নিচ থেকে বেশি কাটত আর মাথা কাটা পড়ত। */
              className="group relative aspect-[416/340] overflow-hidden rounded-[24px] bg-black/10"
            >
              <Image
                src={chef.image}
                alt={`${chef.name}, ${chef.role}`}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                /* ⚠️ object-position 50% 20%: ছবি যতটুকু কাটতেই হয়, তার বেশিরভাগ
                   নিচ থেকে কাটে — উপরে মাথার জায়গা থাকে। নিচের অংশ তো
                   gradient আর লেখার তলায় ঢাকাই পড়ে। default (50% 50%)
                   উপর-নিচ সমান কাটত, তাই কপাল/মাথা কেটে যেত। */
                className="object-cover object-[50%_20%] transition-transform duration-500 group-hover:scale-105"
              />

              {/* Figma Rectangle 34628975: উপরে 63px, কালো → স্বচ্ছ। */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[63px] bg-gradient-to-b from-black to-transparent"
              />

              {/* Figma Rectangle 34628976: নিচে 176px (340-র ~52%), স্বচ্ছ → কালো।
                  % দিয়ে লেখা যাতে কার্ড ছোট-বড় হলেও অনুপাত থাকে। */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-b from-transparent to-black"
              />

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4">
                <div className="flex flex-col">
                  <span className="font-sora text-[14px] font-normal leading-[1.7] text-white/70">
                    {chef.role}
                  </span>
                  <h3 className="font-frank-ruhl text-[24px] font-medium leading-[1.3] text-white">
                    {chef.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Tag>{chef.specialty}</Tag>
                  <Tag>{chef.yearsExperience} years Exp</Tag>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * কার্ডের নিচের ছোট ট্যাগ — Figma: padding 4px 8px, radius 30,
 * BG white/20, Sora 400 12px, line-height 160%।
 *
 * ⚠️ আগে `bg-white/15` + `backdrop-blur` আর 10–11px ছিল; Figma-তে blur
 * নেই, আর লেখা 12px — তাই হুবহু সেটাই। নিচের কালো gradient-ই
 * contrast দেয়, blur-এর দরকার পড়ে না।
 */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[30px] bg-white/20 px-2 py-1 font-sora text-[12px] font-normal leading-[1.6] text-white">
      {children}
    </span>
  );
}