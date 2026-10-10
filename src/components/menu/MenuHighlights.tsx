"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Dumbbell, Star, Timer, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { HighlightGroup, HighlightKey } from "@/lib/menu-highlights";
import { menuImageProps } from "@/lib/menu-image";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** তিনটে তালিকার শিরোনাম, উপশিরোনাম আর আইকন — লেখা এখানেই, ডেটা lib থেকে। */
const GROUP_COPY: Record<
  HighlightKey,
  { title: string; subtitle: string; Icon: LucideIcon }
> = {
  favorites: {
    title: "Guest Favorites",
    subtitle: "Top-rated by guests who ordered them.",
    Icon: Star,
  },
  quick: {
    title: "Ready in a Flash",
    subtitle: "The fastest dishes out of our kitchen.",
    Icon: Timer,
  },
  protein: {
    title: "Protein Packed",
    subtitle: "The most protein per plate on our menu.",
    Icon: Dumbbell,
  },
};

/**
 * ⚠️ `lg:grid-cols-${n}` লেখা যায় না — Tailwind পুরো class-নাম আক্ষরিক না
 * দেখলে CSS বানায় না। তাই তিনটে অবস্থাই স্পষ্ট লেখা: কোনো তালিকা খালি
 * হয়ে বাদ পড়লে বাকিগুলো মাঝখানে সুন্দরভাবে বসে, পাশে ফাঁকা কলাম থাকে না।
 */
const GRID_BY_COUNT: Record<number, string> = {
  1: "md:grid-cols-1 md:max-w-[440px]",
  2: "md:grid-cols-2 md:max-w-[880px]",
  3: "md:grid-cols-2 lg:grid-cols-3 md:max-w-none",
};

/**
 * src/components/menu/MenuHighlights.tsx
 *
 * /menu-র চার নম্বর section — "Chef's Picks"। আগে এখানে হোমপেজের
 * `SignatureSection` বসানো ছিল (একই তিনটে কার্ড, একই banner), এখন
 * মেনু-পাতার নিজস্ব কাজের জিনিস: তিনটে তালিকা, তিন মাপকাঠিতে —
 * রেটিং, রান্নার সময়, প্রোটিন। প্রতিটা সারি পদের নিজের পাতায় যায়।
 *
 * পটভূমি হোমপেজের Signature-এর সেই gradient-ই (Figma 93.36deg,
 * গোলাপিটা পর্দার বাইরে 145.78%-এ) — তাই `bg-gradient-to-r` নয়,
 * পুরো মান আক্ষরিক লেখা। শিরোনাম সাদা, কার্ড সাদা।
 *
 * ডেটা: lib/menu-highlights.ts (কোনো নতুন query নেই)। `groups` খালি হলে
 * section-ই render হয় না — ফাঁকা gradient ব্লক দেখানোর মানে নেই।
 */
export default function MenuHighlights({ groups }: { groups: HighlightGroup[] }) {
  const reduceMotion = useReducedMotion();

  if (groups.length === 0) return null;

  return (
    <section className="bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        <div className="flex flex-col items-center gap-4">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Chef&apos;s Picks
          </motion.span>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="flex max-w-[1008px] flex-col items-center gap-4 xl:gap-5"
          >
            <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-white md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Not Sure What to Order? Start with Our Top Picks
            </h2>
            <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-white/80 md:text-[16px]">
              A quick shortlist from our own menu — the dishes guests rate highest, the ones
              ready fastest, and the most protein-packed plates.
            </p>
          </motion.div>
        </div>

        <div
          className={`mx-auto grid w-full gap-4 ${GRID_BY_COUNT[Math.min(groups.length, 3)]}`}
        >
          {groups.map((group, index) => {
            const { title, subtitle, Icon } = GROUP_COPY[group.key];

            return (
              <motion.article
                key={group.key}
                initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, ease: EASE, delay: index * 0.1 }}
                /* ⚠️ `row-span-2 grid-rows-subgrid` — কার্ডগুলো parent grid-এর দুটো সারি
                   (header, তালিকা) ভাগ করে নেয়। তাই একটার subtitle দুই লাইনে ভাঙলেও
                   তিন কার্ডের তালিকা একই উচ্চতা থেকে শুরু হয়; কোনো fixed min-height
                   অনুমান নেই, লেখা যত লম্বাই হোক মিলে যায়। ভেতরের ফাঁক `gap-y-5`
                   (subgrid নিজের row-gap আলাদা করে দিতে পারে)।

                   ⚠️ `grid-cols-[minmax(0,1fr)]` বাধ্যতামূলক: কলাম না বলে দিলে grid-এর
                   একমাত্র কলামটা `auto` হয়ে সবচেয়ে লম্বা সারির (নাম + chip + দাম)
                   পুরো প্রস্থ নেয় — তখন `truncate` কাজ করে না আর সারিগুলো কার্ডের
                   ডান কিনারা ছাড়িয়ে বেরিয়ে যায়। `minmax(0,1fr)` কলামকে কার্ডের ভেতরেই
                   আটকে রাখে, লম্বা নাম `…` হয়ে কাটে। */
                className="row-span-2 grid grid-cols-[minmax(0,1fr)] grid-rows-subgrid gap-y-5 rounded-[30px] bg-white p-5 md:p-6"
              >
                <header className="flex items-start gap-3.5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-frank-ruhl text-[22px] font-medium leading-[1.3] text-black xl:text-[26px]">
                      {title}
                    </h3>
                    <p className="font-sora text-[13px] font-normal leading-[1.5] text-black/60">
                      {subtitle}
                    </p>
                  </div>
                </header>

                <ol className="flex flex-col gap-2.5">
                  {group.dishes.map((dish, rank) => (
                    <li key={dish.id}>
                      <Link
                        href={dish.href}
                        className={`group flex items-center gap-3 rounded-[20px] bg-[#F9F6F3] p-2.5 pr-4 transition-colors duration-200 hover:bg-[#F3ECE6] ${FOCUS_RING}`}
                      >
                        <span
                          className="w-4 shrink-0 text-center font-frank-ruhl text-[20px] font-semibold leading-none text-black/25"
                          aria-hidden="true"
                        >
                          {rank + 1}
                        </span>

                        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] bg-white">
                          {dish.imageUrl ? (
                            /* ৬৪px থাম্বনেইলের জন্য ২০০KB-র আসল ছবি নামানো অপচয় — optimizer
                               ছোট করে দেয়; অচেনা host হলে `unoptimized` (lib/menu-image.ts)। */
                            <Image
                              src={dish.imageUrl}
                              alt=""
                              fill
                              {...menuImageProps(dish.imageUrl)}
                              sizes="64px"
                              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <UtensilsCrossed
                                className="h-6 w-6 text-black/15"
                                strokeWidth={1.2}
                                aria-hidden="true"
                              />
                            </span>
                          )}
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="truncate font-frank-ruhl text-[17px] font-medium leading-[1.25] text-black xl:text-[19px]">
                            {dish.name}
                          </span>
                          <span className="flex w-fit items-center gap-1 rounded-full bg-white px-2 py-1 font-sora text-[11px] font-normal leading-none text-black/70 xl:text-[12px]">
                            <Icon
                              className={`h-3 w-3 text-[#FF9540] ${group.key === "favorites" ? "fill-[#FF9540]" : ""}`}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            {dish.metric}
                          </span>
                        </span>

                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          {dish.oldPriceLabel && (
                            <s className="font-frank-ruhl text-[12px] font-normal leading-none text-black/50">
                              <span className="sr-only">Was </span>
                              {dish.oldPriceLabel}
                            </s>
                          )}
                          <span className="font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
                            {dish.oldPriceLabel && <span className="sr-only">Now </span>}
                            {dish.priceLabel}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}