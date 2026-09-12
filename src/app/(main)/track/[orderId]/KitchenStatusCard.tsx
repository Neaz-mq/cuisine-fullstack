"use client";

import Image from "next/image";
import { CHEFS, JOURNEY_IMAGE } from "@/lib/chefs-content";
import type { TrackedOrder } from "@/lib/track-order";

/**
 * src/app/(main)/track/[orderId]/KitchenStatusCard.tsx
 *
 * Figma "Web/Order Tracking — Preparing": অর্ডার যতক্ষণ রান্নাঘরে, ততক্ষণ
 * বাঁ কলামে map বা Order Information নয়, এই কার্ডটা।
 *
 *   সাদা কার্ড (padding 30, radius 20)
 *     ├ "Preparing" — 36px Frank Ruhl
 *     ├ উপশিরোনাম — 12px Sora, black/70
 *     └ cream ভেতরের কার্ড (radius 20)
 *         ├ ছবি + "Live Kitchen" সাদা pill
 *         ├ "Your Food is Being Prepared" — 24px
 *         ├ বিবরণ
 *         ├ শেফ (avatar · নাম · পদ)  |  "8 min · Left to preparing"
 *         └ "2 items: Beef Pizza, Chic Burger"
 *
 * ⚠️ PLACED আর PREPARING — দুটোতেই এই কার্ড, কিন্তু লেখা আলাদা। Figma-তে
 * কেবল PREPARING-এর নকশা আছে; PLACED-এ "Your Food is Being Prepared"
 * লেখা মিথ্যা হতো, কারণ রান্নাঘর তখনো অর্ডারটা ধরেইনি। একই খোলস, সৎ কথা।
 *
 * ⚠️ ছবিটা "Live Kitchen" নামে একটা লাইভ ফিড নয় — নামটা Figma-র, কিন্তু
 * আমাদের কোনো রান্নাঘরের ক্যামেরা নেই। তাই Our Chefs পাতার একই
 * রান্নাঘরের ছবিটাই (JOURNEY_IMAGE) ব্যবহার করা হয়েছে; একটা নকল লাইভ
 * ব্যাজ বসানোর চেয়ে একই ব্র্যান্ডের ছবি দেখানো সৎ।
 */

// Figma-তে এই কার্ডে Antoine Rousseau, Executive Chef — CHEFS তালিকার
// প্রথম জন। id দিয়ে খোঁজা হয় যাতে তালিকার ক্রম বদলালেও ঠিক থাকে।
const KITCHEN_CHEF = CHEFS.find((chef) => chef.id === "antoine-rousseau") ?? CHEFS[0];

const COPY = {
  PLACED: {
    heading: "Order Placed",
    subheading: "We've received your order — the kitchen is picking it up next.",
    title: "Your Order Is In the Queue",
    body: "Our chefs will start cooking your order shortly. We'll update this page the moment it hits the pan.",
    timerLabel: "Left to start",
  },
  PREPARING: {
    heading: "Preparing",
    subheading: "Your order is being freshly prepared by our chefs.",
    title: "Your Food is Being Prepared",
    body: "Our chefs just started cooking your order fresh — it'll be ready to head out shortly.",
    timerLabel: "Left to preparing",
  },
} as const;

export default function KitchenStatusCard({
  status,
  items,
  itemCount,
  prepMinutesLeft,
}: {
  status: "PLACED" | "PREPARING";
  items: TrackedOrder["items"];
  itemCount: number;
  prepMinutesLeft: number | null;
}) {
  const copy = COPY[status];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 md:p-6 xl:gap-10 xl:p-[30px]">
      <div className="flex flex-col gap-2">
        <h2 className="font-frank-ruhl text-[24px] font-medium leading-[1.3] text-black md:text-[30px] xl:text-[36px]">
          {copy.heading}
        </h2>
        <p className="font-sora text-[12px] leading-[1.6] text-black/70">{copy.subheading}</p>
      </div>

      <div className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-3 md:p-4 xl:gap-6">
        <div className="relative isolate overflow-hidden rounded-[16px]">
          <Image
            src={JOURNEY_IMAGE}
            alt=""
            width={744}
            height={496}
            /* ⚠️ সাজসজ্জার ছবি, তাই alt ফাঁকা আর aria-hidden — screen
               reader-এ "রান্নাঘরের ছবি" বলার কোনো তথ্যমূল্য নেই, পাশের
               লেখাগুলোই পুরো খবরটা দেয়। */
            aria-hidden="true"
            className="h-[180px] w-full object-cover md:h-[220px] xl:h-[260px]"
          />
          <span className="absolute right-3 top-3 rounded-full bg-white px-4 py-2 font-sora text-[12px] font-medium leading-none text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] md:right-4 md:top-4">
            Live Kitchen
          </span>
        </div>

        <div className="flex flex-col gap-3 xl:gap-4">
          <h3 className="font-frank-ruhl text-[20px] font-semibold leading-[1.3] text-black md:text-[24px]">
            {copy.title}
          </h3>
          <p className="font-sora text-[13px] leading-[1.6] text-black/70 md:text-[14px]">
            {copy.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={KITCHEN_CHEF.image}
              alt=""
              width={56}
              height={56}
              aria-hidden="true"
              className="h-12 w-12 shrink-0 rounded-full object-cover md:h-14 md:w-14"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-frank-ruhl text-[15px] font-semibold leading-none text-black md:text-[16px]">
                {KITCHEN_CHEF.name}
              </span>
              <span className="truncate font-sora text-[12px] leading-none text-black/70">
                {KITCHEN_CHEF.role}
              </span>
            </div>
          </div>

          {/**
            * ⚠️ `prepMinutesLeft` null হলে পুরো ব্লকটাই থাকে না।
            *
            * server সংখ্যাটা পাঠাতে না পারলে (যেমন কোনো অজানা status)
            * "0 min" দেখানো মানে বলা "এক্ষুনি তৈরি" — একটা প্রতিশ্রুতি
            * যার কোনো ভিত্তি নেই। চুপ থাকাই ভালো।
            */}
          {prepMinutesLeft !== null && (
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="font-frank-ruhl text-[15px] font-semibold leading-none text-black md:text-[16px]">
                {prepMinutesLeft > 0 ? `${prepMinutesLeft} min` : "Almost ready"}
              </span>
              <span className="font-sora text-[12px] leading-none text-black/70">
                {prepMinutesLeft > 0 ? copy.timerLabel : "Any moment now"}
              </span>
            </div>
          )}
        </div>

        {/**
          * "2 items: Beef Pizza, Chic Burger"
          *
          * ⚠️ সংখ্যাটা পরিমাণের যোগফল (itemCount), লাইনের সংখ্যা নয় —
          * তিনটে বার্গারের একটা লাইন মানে "৩ items", "১ item" নয়। ডান
          * কলামের "Total Price(n)"-ও একই সংখ্যা, তাই দুটো কখনো আলাদা
          * হয় না।
          *
          * ⚠️ Figma-তে নামগুলোর মাঝে শুধু ফাঁকা জায়গা ("Beef Pizza Chic
          * Burger") — কমা বসানো হয়েছে, কারণ ফাঁকা জায়গায় "Chic Burger
          * Beef Pizza" একটাই পদের নাম বলে পড়া যায়।
          */}
        <p className="font-frank-ruhl text-[15px] font-semibold leading-[1.4] text-black md:text-[16px]">
          {itemCount} {itemCount === 1 ? "item" : "items"}:{" "}
          <span className="font-sora font-normal text-black/70">
            {items.map((item) => item.title).join(", ")}
          </span>
        </p>
      </div>
    </div>
  );
}
