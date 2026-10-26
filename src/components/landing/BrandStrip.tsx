"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
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
 *
 * ── MARQUEE ─────────────────────────────────────────────────────────
 *
 * Logo-গুলো এখন বাম থেকে ডানে অনবরত চলে (CSS animation, transform-only —
 * JS চলে না, তাই মসৃণ)। ছাঁদ:
 *
 *   • একই তালিকার ৪টা কপি পাশাপাশি; animation -50% থেকে শুরু হয়ে ডানে ঠিক ২ কপি
 *     সরে 0-তে পৌঁছয়, তারপর আবার -50%-এ ফেরে — কপিগুলো হুবহু এক, তাই লাফ বোঝা
 *     যায় না (seamless loop)। ৪টা কপি, কারণ বড় পর্দায় ১২৮০px-এর
 *     ঘরটা যেন কখনো ফাঁকা না দেখায়।
 *   • দুই পাশে ফিকে হয়ে মিলিয়ে যায় (mask-image) — reference video-র মতো।
 *   • mouse রাখলে থামে (hover pause)।
 *   • prefers-reduced-motion চালু থাকলে কিছু চলে না, আগের মতো স্থির
 *     সারি দেখায়।
 *   • প্রথম কপি বাদে বাকিগুলো aria-hidden — screen reader একবারই পড়ে।
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

  /** দুই ধরনের সারি: স্থির (reduced-motion) আর চলন্ত (marquee) — item একই। */
  const renderItem = (brand: DeliveryBrand, keyPrefix: string) => {
    const showLogo = Boolean(brand.logo) && !failed.has(brand.name);

    /** logo থাকলে Figma-র মাপ; না থাকলে রঙিন লেখা */
    const style = showLogo
      ? ({
          "--bw": `${brand.width}px`,
          "--bh": `${brand.height}px`,
        } as CSSProperties)
      : { color: brand.color };

    return (
      <li
        key={`${keyPrefix}-${brand.name}`}
        className={
          showLogo
            ? "relative h-[calc(var(--bh)*0.6)] w-[calc(var(--bw)*0.6)] shrink-0 transition-transform duration-300 hover:-translate-y-[3px] md:h-[calc(var(--bh)*0.8)] md:w-[calc(var(--bw)*0.8)] xl:h-[var(--bh)] xl:w-[var(--bw)]"
            : `shrink-0 whitespace-nowrap font-sora text-[18px] font-bold leading-none md:text-[22px] xl:text-[26px] ${
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
            // marquee-র ভেতরের কপিগুলো পর্দার বাইরে থাকে; lazy হলে চলতে চলতে
            // খালি জায়গা দেখা দিত। logo ছোট, তাই eager-ই ঠিক।
            loading="eager"
            className="object-contain"
            onError={() => markFailed(brand.name)}
          />
        ) : (
          brand.name
        )}
      </li>
    );
  };

  /**
   * প্রতিটা কপির ডানে gap-এর সমান padding (`pr-*`) — নাহলে কপির শেষ logo
   * আর পরের কপির প্রথম logo-র মাঝে gap থাকত না, আর -50% লুপে ঠিক
   * ততটুকু লাফ দেখা যেত।
   */
  const GROUP =
    "flex shrink-0 items-center gap-x-8 pr-8 md:gap-x-14 md:pr-14 xl:gap-x-20 xl:pr-20";

  return (
    <section className="bg-[#F9F6F3] px-4 pb-10 md:px-10 xl:px-20 xl:pb-[60px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 xl:gap-10">
        <h2 className="text-center font-sora text-[12px] font-normal leading-[1.6] text-black/70 md:text-[14px] xl:text-[18px]">
          Trusted Equipment From Industry Leaders
        </h2>

        {reduceMotion ? (
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-14 xl:min-h-[40px] xl:gap-x-20">
            {brands.map((brand) => renderItem(brand, "static"))}
          </ul>
        ) : (
          <div
            className="brand-marquee w-full overflow-hidden py-2"
            // দুই পাশে ফিকে হয়ে মিলিয়ে যাওয়া
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)",
            }}
          >
            <div className="brand-marquee-track flex w-max items-center">
              {[0, 1, 2, 3].map((copy) => (
                <ul key={copy} className={GROUP} aria-hidden={copy === 0 ? undefined : true}>
                  {brands.map((brand) => renderItem(brand, `c${copy}`))}
                </ul>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* keyframes এই ফাইলেই — globals.css ছুঁতে হয় না */}
      <style>{`
        @keyframes brand-marquee {
          from { transform: translate3d(-50%, 0, 0); }
          to   { transform: translate3d(0, 0, 0); }
        }
        .brand-marquee-track {
          animation: brand-marquee 30s linear infinite;
          will-change: transform;
        }
        @media (min-width: 768px)  { .brand-marquee-track { animation-duration: 40s; } }
        @media (min-width: 1280px) { .brand-marquee-track { animation-duration: 50s; } }
        .brand-marquee:hover .brand-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .brand-marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}