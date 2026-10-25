"use client";

import Image from "next/image";
import { CHEFS } from "@/lib/chefs-content";
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
 *     └ cream ভেতরের কার্ড ("Food Card 3": padding 12/12/20, radius 30, gap 16)
 *         ├ ছবি (৫৮৮×২০৩, radius 24) + উপরে কালো gradient + "Live Kitchen" pill
 *         └ ভেতরের অংশ (padding 0 12, gap 20)
 *             ├ "Your Food is Being Prepared" — 24px · বিবরণ — 14px
 *             ├ সাদা pill (radius 90, ৭২px): শেফ | "8 min · Left to preparing"
 *             └ "2 items: Beef Pizza, Chic Burger" — 20px
 *
 * ⚠️ PLACED আর PREPARING — দুটোতেই এই কার্ড, কিন্তু লেখা আলাদা। Figma-তে
 * কেবল PREPARING-এর নকশা আছে; PLACED-এ "Your Food is Being Prepared"
 * লেখা মিথ্যা হতো, কারণ রান্নাঘর তখনো অর্ডারটা ধরেইনি। একই খোলস, সৎ কথা।
 *
 * ⚠️ ছবিটা "Live Kitchen" নামে একটা লাইভ ফিড নয় — নামটা Figma-র, কিন্তু
 * আমাদের কোনো রান্নাঘরের ক্যামেরা নেই। তাই Figma-র নিজের রান্নাঘরের ছবিটাই
 * (KITCHEN_IMAGE) বসানো; একটা নকল লাইভ ব্যাজ বসানোর চেয়ে ব্র্যান্ডের ছবি
 * দেখানো সৎ।
 *
 * ⚠️ Figma-তে Role আর timer label-এর font Poppins — ওটা এই প্রকল্পে body-র
 * default (globals.css), আলাদা `.font-poppins` class নেই। তাই ওই দুই লেখায়
 * কোনো font class বসানো হয়নি; বসালে (যেমন font-sora) ভুল font আসত।
 */

/**
 * Figma-র ছবি। Cloudinary cloud `dzi3u164c` — next.config.ts-এর
 * remotePatterns আর CSP img-src-এ আগে থেকেই অনুমোদিত (OurJourney-র ছবিও
 * একই cloud-এর), তাই config বদলানোর দরকার নেই।
 */
const KITCHEN_IMAGE =
  "https://res.cloudinary.com/dzi3u164c/image/upload/v1792920520/0f7f1121dc38412f2694a493ba95f3d2d978991b_jhuzpv.jpg";

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
  READY: {
    heading: "Ready",
    subheading: "Your order is cooked and packed — we're getting a rider for it.",
    title: "Your Food Is Ready",
    body: "Your order is ready and waiting for a rider to pick it up. We'll update this page the moment it's on its way.",
    timerLabel: "Left to preparing",
  },
} as const;

export default function KitchenStatusCard({
  status,
  items,
  itemCount,
  prepMinutesLeft,
}: {
  status: "PLACED" | "PREPARING" | "READY";
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

      {/* Figma "Food Card 3": padding 12 12 20, gap 16, radius 30, BG #F9F6F3 */}
      <div className="flex flex-col gap-4 rounded-[30px] bg-[#F9F6F3] px-3 pb-5 pt-3">
        {/**
          * Figma "Frame 2147225236": ৫৮৮×২০৩, radius 24, BG #F8F8F8।
          *
          * ⚠️ `fill` + object-cover: ছবিটা প্রায় চৌকো, আর ফ্রেম ~২.৯:১ চওড়া —
          * মাঝখান থেকে কাটলে শেফের মাথা আর ধোঁয়া দুটোই আসত না যা Figma-র
          * ক্রপে নেই। Figma-র ক্রপে দেখা যায় হাত, কাটিং বোর্ড আর হাঁড়ি, অর্থাৎ
          * ছবির নিচের দিক — তাই `object-position` নিচের দিকে (82%) টানা। ক্রপ
          * ওপরে/নিচে সরাতে চাইলে শুধু ওই একটা সংখ্যা বদলালেই হবে।
          */}
        <div className="relative isolate h-[170px] overflow-hidden rounded-[24px] bg-[#F8F8F8] md:h-[203px]">
          <Image
            src={KITCHEN_IMAGE}
            alt=""
            fill
            sizes="(min-width: 1280px) 588px, (min-width: 768px) 60vw, 100vw"
            priority
            /* ⚠️ সাজসজ্জার ছবি, তাই alt ফাঁকা আর aria-hidden — screen
               reader-এ "রান্নাঘরের ছবি" বলার কোনো তথ্যমূল্য নেই, পাশের
               লেখাগুলোই পুরো খবরটা দেয়। */
            aria-hidden="true"
            className="object-cover object-[center_82%]"
          />
          {/* Figma "Rectangle 34628975": ৬৩px, #000 → স্বচ্ছ, ছবির মাথায় */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[63px] bg-gradient-to-b from-black to-transparent"
          />
          {/* Figma "Frame 2147235205": padding 8/12, সাদা, radius 100, ডানে-উপরে ১৬ */}
          <span className="absolute right-4 top-4 flex items-center justify-center rounded-full bg-white px-3 py-2 font-sora text-[12px] font-normal leading-[1.2] text-black">
            Live Kitchen
          </span>
        </div>

        {/* Figma "Frame 2147235266": padding 0 12, gap 20 */}
        <div className="flex flex-col gap-5 px-3">
          {/* Figma "Frame 2147236027": শিরোনাম আর বিবরণের মাঝে gap 16 */}
          <div className="flex flex-col gap-4">
            <h3 className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-[#141921] md:text-[24px]">
              {copy.title}
            </h3>
            <p className="font-sora text-[13px] leading-[1.7] text-black/70 md:text-[14px]">
              {copy.body}
            </p>
          </div>

          {/**
            * Figma "Frame 2147225649": সাদা pill, radius 90, padding
            * 12/24/12/12, উচ্চতা ৭২ (৪৮px avatar + ২৪ padding)।
            */}
          <div className="flex items-center justify-between gap-4 rounded-[90px] bg-white py-3 pl-3 pr-4 md:gap-[46px] md:pr-6">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src={KITCHEN_CHEF.image}
                alt=""
                width={48}
                height={48}
                aria-hidden="true"
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
                  {KITCHEN_CHEF.name}
                </span>
                {/* Poppins — body-র default, তাই কোনো font class নেই */}
                <span className="truncate text-[12px] font-normal leading-[1.2] text-black/70">
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
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                <span className="font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
                  {prepMinutesLeft > 0 ? `${prepMinutesLeft} min` : "Almost ready"}
                </span>
                <span className="text-[12px] font-normal leading-[1.2] text-black/70">
                  {prepMinutesLeft > 0 ? copy.timerLabel : "Any moment now"}
                </span>
              </div>
            )}
          </div>

          {/**
            * "2 items: Beef Pizza, Chic Burger" — Figma: Frank Ruhl 500, 20px,
            * line-height 130%।
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
          <p className="font-frank-ruhl text-[17px] font-medium leading-[1.3] text-black md:text-[20px]">
            <span className="font-semibold">
              {itemCount} {itemCount === 1 ? "item" : "items"}:
            </span>{" "}
            <span className="font-normal text-black/70">
              {items.map((item) => item.title).join(", ")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}