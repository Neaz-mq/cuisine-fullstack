"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DELIVERY_BRANDS, type DeliveryBrand } from "@/lib/landing-content";

/**
 * src/components/landing/BrandStrip.tsx
 *
 * "Trusted Equipment From Industry Leaders" — Hero-র ঠিক নিচের সরু
 * সারি, একই cream পটভূমিতে।
 *
 * ⚠️ এই অংশটার CSS export আসেনি (আপনার পাঠানো ফাইলগুলোতে 2nd নেই),
 * তাই মাপগুলো screenshot থেকে মেপে নেওয়া — শিরোনাম Sora 14px
 * Black/70, নিচে logo-র সারি, মাঝে ~60px ফাঁক। export পেলে মিলিয়ে
 * নেব; এখনকার অনুপাত ছবির সাথে মেলে।
 *
 * ⚠️ আসল logo বসানো হয়নি — কারণ `lib/landing-content.ts`-এ
 * `DELIVERY_BRANDS`-এর মাথায় লেখা (অন্য কোম্পানির ট্রেডমার্ক, আর
 * ফাইলও নেই)। আপাতত প্রতিটা নাম তার নিজের ব্র্যান্ড-রঙে।
 */
export default function BrandStrip({
  brands = DELIVERY_BRANDS,
}: {
  brands?: DeliveryBrand[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#F9F6F3] px-4 pb-10 md:px-10 xl:px-20 xl:pb-[60px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 xl:gap-10">
        <h2 className="text-center font-sora text-[12px] font-normal leading-[1.6] text-black/70 md:text-[14px]">
          Trusted Equipment From Industry Leaders
        </h2>

        {/**
         * ⚠️ `flex-wrap` + `justify-center`, একটামাত্র সারি নয়। Figma-তে
         * ছটা নাম এক সারিতে ছড়ানো, কিন্তু ৩২০px-এ ছটা পাশাপাশি মানে
         * প্রতিটার ভাগে ~৪৫px — নাম পড়াই যেত না। ভাঁজ হয়ে দুই-তিন
         * সারিতে নামলে চেহারাটা বজায় থাকে, শুধু উচ্চতা বাড়ে।
         */}
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-14 xl:gap-x-[72px]">
          {brands.map((brand, index) => (
            <motion.li
              key={brand.name}
              /**
               * ⚠️ `whileInView`, `animate` নয় — এই সারিটা Hero-র নিচে,
               * অর্থাৎ প্রথম পর্দায় প্রায়ই দেখাই যায় না। `animate`
               * দিলে animation-টা কেউ না দেখতেই শেষ হয়ে যেত, আর
               * ব্যবহারকারী scroll করে এসে একটা স্থির সারি পেতেন।
               *
               * `once: true` — একবারই। বারবার scroll করলে প্রতিবার
               * নতুন করে ভেসে ওঠা বিরক্তিকর।
               */
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              /**
               * ⚠️ ধূসর-করে-রাখা (grayscale) নয়, ব্র্যান্ডের নিজের রঙেই —
               * screenshot-এ ওগুলো রঙিন। অনেক সাইটে এই সারিটা ফিকে
               * রাখা হয়, কিন্তু এখানে designer রঙ চেয়েছেন।
               */
              className={`font-sora text-[18px] font-bold leading-none md:text-[22px] xl:text-[26px] ${
                brand.italic ? "italic" : ""
              }`}
              style={{ color: brand.color }}
            >
              {brand.name}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
