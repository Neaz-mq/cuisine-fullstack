"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DELIVERY_BRANDS, type DeliveryBrand } from "@/lib/landing-content";

/**
 * src/components/landing/BrandStrip.tsx
 *
 * "Trusted Equipment From Industry Leaders" — Hero-র ঠিক নিচের সরু
 * সারি, একই cream পটভূমিতে।
 *
 * ── Figma Frame 2147234280 (1440px) — এই pass-এ হুবহু মেলানো ─────────
 *
 *   section : padding 0 80 60 · gap 40 · BG #F9F6F3
 *   শিরোনাম  : Sora 400, 18px, line-height 160% (= 29px), Black/70
 *   logo-সারি: row, center, gap 80, উচ্চতা 40
 *   প্রতিটা logo-র নিজের বাক্স (চওড়া × উচ্চ):
 *     foodpanda 160×35 · foodi 88×35 · deliveroo 119×40 ·
 *     swiggy 136×40 · Wolt 103×35 · talabat 162×35
 *
 * ⚠️ বাক্সের মাপ `DELIVERY_BRANDS`-এ (`width`/`height`), এখানে নয় —
 * নতুন logo যোগ করলে শুধু ওখানে সংখ্যাটা বসালেই হয়।
 *
 * ⚠️ ছোট পর্দায় বাক্স আনুপাতিক ছোট হয় (মোবাইলে ×0.6, md-তে ×0.8,
 * xl-এ Figma-র পুরো মাপ)। `--bw`/`--bh` CSS variable-এ মাপটা রাখা
 * হয়েছে, যাতে প্রতিটা breakpoint-এ আলাদা করে সংখ্যা লিখতে না হয়।
 *
 * ⚠️ যে ব্র্যান্ডের `logo` URL আছে তার আসল ছবি বাক্স ভরে বসে
 * (`object-contain` — টেনে-চ্যাপ্টা হয় না); যেটার নেই সেটার নাম
 * নিজের ব্র্যান্ড-রঙে লেখা থাকে। ছবি লোড না হলেও (যেমন URL ভুল)
 * লেখাটাই ফিরে আসে, তাই সারিতে ভাঙা আইকন দেখা যায় না।
 */
export default function BrandStrip({
  brands = DELIVERY_BRANDS,
}: {
  brands?: DeliveryBrand[];
}) {
  const reduceMotion = useReducedMotion();

  /** যাদের ছবি লোড হয়নি — তারা লেখায় ফিরে যায়। */
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const markFailed = (name: string) =>
    setFailed((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });

  return (
    <section className="bg-[#F9F6F3] px-4 pb-10 md:px-10 xl:px-20 xl:pb-[60px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 xl:gap-10">
        <h2 className="text-center font-sora text-[12px] font-normal leading-[1.6] text-black/70 md:text-[14px] xl:text-[18px]">
          Trusted Equipment From Industry Leaders
        </h2>

        {/**
         * ⚠️ `flex-wrap` + `justify-center`, একটামাত্র সারি নয়। Figma-তে
         * ছটা logo এক সারিতে (মোট ~১১৬৮px), কিন্তু ৩২০px-এ ছটা
         * পাশাপাশি রাখা যায় না। ভাঁজ হয়ে দুই-তিন সারিতে নামলে চেহারাটা
         * বজায় থাকে, শুধু উচ্চতা বাড়ে। xl-এ gap ঠিক Figma-র ৮০px।
         */}
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-14 xl:min-h-[40px] xl:gap-x-20">
          {brands.map((brand, index) => {
            const showLogo = Boolean(brand.logo) && !failed.has(brand.name);

            /** logo থাকলে Figma-র বাক্স; না থাকলে লেখার স্বাভাবিক মাপ। */
            const style = showLogo
              ? ({
                  "--bw": `${brand.width}px`,
                  "--bh": `${brand.height}px`,
                } as CSSProperties)
              : { color: brand.color };

            return (
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
                 * Figma-তে ওগুলো রঙিন।
                 */
                className={
                  showLogo
                    ? "relative h-[calc(var(--bh)*0.6)] w-[calc(var(--bw)*0.6)] md:h-[calc(var(--bh)*0.8)] md:w-[calc(var(--bw)*0.8)] xl:h-[var(--bh)] xl:w-[var(--bw)]"
                    : `font-sora text-[18px] font-bold leading-none md:text-[22px] xl:text-[26px] ${
                        brand.italic ? "italic" : ""
                      }`
                }
                style={style}
              >
                {showLogo ? (
                  <Image
                    src={brand.logo!}
                    alt={brand.name}
                    fill
                    sizes={`${brand.width}px`}
                    className="object-contain"
                    onError={() => markFailed(brand.name)}
                  />
                ) : (
                  brand.name
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}