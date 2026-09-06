"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, UtensilsCrossed } from "lucide-react";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** Figma-র ছোট তথ্য-chip: padding 4px 8px, radius 30, BG #F9F6F3, Sora 12। */
const FACT_CHIP =
  "flex shrink-0 items-center rounded-[30px] bg-[#F9F6F3] px-2 py-1 font-sora text-[12px] font-normal leading-[1.6] text-black";

/**
 * src/components/menu/FoodCard.tsx
 *
 * Figma "Food Card 2" — column, padding 12/12/20, gap 16, radius 30,
 * 416×455।
 *
 * ⚠️ এটা আগে `MenuBrowser.tsx`-এর ভেতরে ছিল। আলাদা করা হলো কারণ
 * পদের detail পাতার "Check Out More Yummy Options" অংশেও হুবহু এই
 * কার্ডটাই লাগে (Figma-তে frame-টার নামও এক)। কপি করলে একটায় বদল করে
 * অন্যটা ভুলে যাওয়া কেবল সময়ের ব্যাপার।
 *
 * ⚠️ তিনটে জিনিস নকশার সাথে আলাদা, আর প্রতিটার কারণ আছে:
 *
 * ১. কাটা পুরনো দাম নেই — `MenuItem`-এ "আগের দাম" বলে কোনো মাঠ নেই।
 * ২. ছাড়ের ব্যাজটা আসে চালু কুপন থেকে, কেবল সেগুলো থেকে যেগুলো এই
 *    পদটার বা এর শ্রেণির জন্য নির্দিষ্ট (page.tsx-এ বিস্তারিত)।
 * ৩. তথ্য-chip গুলো যেগুলোর মান আছে কেবল সেগুলোই দেখায় — "0 kcal"
 *    লেখা মানে "এই খাবারে ক্যালরি নেই" দাবি করা।
 */

export type MenuCardItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  priceLabel: string;
  imageUrl: string | null;
  isAvailable: boolean;
  calories: number | null;
  fatGrams: number | null;
  proteinGrams: number | null;
  prepTimeMinutes: number | null;
  /** অনুমোদিত review-এর গড়, না থাকলে null। */
  rating: number | null;
  /**
   * ছবির বাঁ কোণে যে ছাড়ের ব্যাজ বসবে ("20%", "$5 Off"), না থাকলে
   * null। কোথা থেকে আসে তা page.tsx-এ — সংক্ষেপে: এই পদটার বা এর
   * শ্রেণির জন্য নির্দিষ্ট করা চালু কুপন।
   */
  discountLabel: string | null;
};

/** Figma "Food Card 2" — column, padding 12/12/20, gap 16, radius 30। */
export default function FoodCard({ item }: { item: MenuCardItem }) {
  const facts = [
    item.prepTimeMinutes !== null ? `${item.prepTimeMinutes} min` : null,
    item.calories !== null ? `${item.calories} kcal` : null,
    item.fatGrams !== null ? `${item.fatGrams} Fats` : null,
    item.proteinGrams !== null ? `${item.proteinGrams} Protein` : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <article className="flex flex-col gap-4 rounded-[30px] bg-white p-3 pb-5">
      {/* Frame 2147225236: ছবির ঘর, 392×203, radius 24, BG #F9F6F3। */}
      <div className="relative h-[203px] w-full overflow-hidden rounded-[24px] bg-[#F9F6F3]">
        {item.imageUrl ? (
          /**
           * ⚠️ `unoptimized` — ছবি Supabase Storage বা Cloudinary
           * যেকোনোটা থেকে আসতে পারে, আর পুরনো সারিতে অন্য host-ও থেকে
           * যেতে পারে; optimizer-এ গেলে remotePatterns-এ না থাকা host
           * পুরো পাতাটাই 400 দিয়ে ভাঙে।
           */
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 392px, (min-width: 768px) 45vw, 90vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed
              className="h-10 w-10 text-black/15"
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </span>
        )}

        {/**
         * Rectangle 34628975 — ছবির উপরের ৬৩px জুড়ে কালো থেকে
         * স্বচ্ছের দিকে gradient।
         *
         * ⚠️ এটা সাজসজ্জা নয়, ব্যাজদুটো পড়ার শর্ত। সাদা pill সাদা
         * লেখার উপরে নয়, **সাদা ছবির** উপরে বসে — french fries বা
         * mozzarella-র মতো হালকা ছবিতে ওটা প্রায় মিলিয়ে যেত। কালো
         * ছবিতে (burger) দেখা যেত, তাই সমস্যাটা ছবিভেদে বদলাত, আর
         * সেটাই এটাকে ধরা কঠিন করত।
         *
         * ⚠️ `pointer-events-none` — নাহলে অদৃশ্য এই স্তরটা ছবির
         * উপরের অংশে মাউস আটকে দিত।
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[63px]"
          style={{
            background: "linear-gradient(180deg, #000000 0%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/**
         * Frame 2147235205 — ছবির উপরে সাদা pill।
         *
         * ⚠️ অবস্থার ব্যাজটা **ডানে**, ছাড়েরটা বাঁয়ে — Figma-তে ঠিক
         * এভাবেই। আগে অবস্থারটা বাঁয়ে বসানো ছিল, ফলে ছাড় যোগ হলে
         * দুটো একই কোণে চাপাচাপি করত।
         */}
        {item.discountLabel && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] font-semibold leading-[1.2] text-black">
            {item.discountLabel}
          </span>
        )}

        <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-black">
          {item.isAvailable ? "Food Available" : "Unavailable"}
        </span>
      </div>

      {/* Frame 2147235266: column, padding 0 12px, gap 20। */}
      <div className="flex flex-1 flex-col justify-between gap-5 px-3">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {/* Frame 2147236014: row, space-between — নাম আর রেটিং। */}
            <div className="flex items-start justify-between gap-5">
              <h4 className="min-w-0 font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
                {item.title}
              </h4>

              {/**
               * ⚠️ রেটিংটা কেবল তখনই, যখন অন্তত একটা অনুমোদিত review
               * আছে। নাহলে Figma-র মতো "4.7" বসিয়ে রাখা মানে একটা
               * সংখ্যা বানিয়ে লেখা, আর খদ্দের সেটার উপর ভরসা করেন।
               */}
              {item.rating !== null && (
                <span className="flex shrink-0 items-center gap-1">
                  <Star
                    className="h-4 w-4 fill-[#FF9540] text-[#FF9540]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="font-frank-ruhl text-[16px] font-normal leading-none text-black">
                    {item.rating.toFixed(1)}
                  </span>
                </span>
              )}
            </div>

            {facts.length > 0 && (
              /* Frame 2147225242: row, gap 6 — `flex-wrap`, কারণ চারটে
                 chip সরু পর্দায় এক সারিতে ধরে না। */
              <div className="flex flex-wrap gap-1.5">
                {facts.map((fact) => (
                  <span key={fact} className={FACT_CHIP}>
                    {fact}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* নকশায় ঘরটা 48px উঁচু = ঠিক দুই লাইন (14px × 170%)। */}
          <p className="line-clamp-2 font-sora text-[14px] font-normal leading-[1.7] text-black/70">
            {item.description}
          </p>
        </div>

        {/* Frame 2147236028: row, space-between — দাম আর বোতাম। */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
            {item.priceLabel}
          </span>

          {/**
           * ⚠️ বোতাম নয়, `<Link>` — "Order Now" এখন সরাসরি cart-এ যোগ
           * করে না, পদটার নিজের পাতায় নিয়ে যায় (Figma-র detail পাতা)।
           * ওখানে ছবির slider, উপকরণ, পুষ্টি, সংখ্যা বাছাই আর তারপর
           * "Add to Cart" / "Buy Now"।
           *
           * এক ক্লিকে cart-এ ফেলাটা দ্রুত, কিন্তু খদ্দের তখন জানেন না
           * কী কিনছেন — ছবি আর দুই লাইনের বিবরণই সব। খাবারের ক্ষেত্রে
           * উপকরণ দেখে নেওয়াটা প্রায়ই জরুরি (অ্যালার্জি, নিরামিষ)।
           */}
          <Link
            href={`/menu/${item.id}`}
            aria-label={`See ${item.title}`}
            className={`flex h-[46px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-6 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 ${FOCUS_RING}`}
          >
            Order Now
          </Link>
        </div>
      </div>
    </article>
  );
}
