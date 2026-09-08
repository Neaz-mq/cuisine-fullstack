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
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-10">
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
              className="group relative aspect-[4/3] overflow-hidden rounded-[20px] bg-black/10"
            >
              <Image
                src={chef.image}
                alt={`${chef.name}, ${chef.role}`}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/**
                * ⚠️ gradient-টা `to-black/85` পর্যন্ত, পুরো কালো নয়।
                *
                * নিচের অংশে চার লাইন লেখা বসে (ভূমিকা, নাম, দুটো ট্যাগ),
                * তাই contrast লাগেই — কিন্তু পুরো কালো করলে ছবির নিচের
                * অর্ধেকটা হারিয়ে যেত, আর অনেক ছবিতে শেফের হাত/থালা
                * ওখানেই থাকে।
                */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-transparent via-black/50 to-black/85"
              />

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 xl:p-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-sora text-[11px] font-normal leading-[1.3] text-white/70 xl:text-[12px]">
                    {chef.role}
                  </span>
                  <h3 className="font-frank-ruhl text-[18px] font-semibold leading-[1.2] text-white xl:text-[20px]">
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
 * কার্ডের নিচের ছোট ট্যাগ।
 *
 * ⚠️ `bg-white/15` + `backdrop-blur` — একরঙা কোনো পটভূমি নয়, কারণ
 * ট্যাগগুলো ছবির উপরে বসে আর প্রতিটা ছবির রঙ আলাদা। স্বচ্ছ রাখলে
 * ট্যাগটা যে ছবির উপরেই ভাসছে সেটা বোঝা যায়, আর যেকোনো ছবিতেই
 * পড়া যায়।
 */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/15 px-2.5 py-1 font-sora text-[10px] font-normal leading-[1.3] text-white backdrop-blur-sm xl:text-[11px]">
      {children}
    </span>
  );
}
