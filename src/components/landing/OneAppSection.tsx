"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { FaApple, FaGooglePlay, FaStar } from "react-icons/fa";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/OneAppSection.tsx
 *
 * Figma "One App. Endless Delicious Choices." section — সাদা পটভূমি,
 * row layout (mobile-এ column), padding 100px 80px, gap ~49px।
 * বাম দিকে heading + subtext + QR/rating row + store বোতাম, ডান
 * দিকে rounded (30px) ছবি-কার্ড।
 *
 * ⚠️ ডান দিকের কার্ডে কোনো bg-white বা shadow নেই — Figma-তে কার্ডটা
 * শুধু radius 30px দিয়ে ছবি কেটে রাখে, আলাদা কোনো বাক্স/ছায়া নয়।
 *
 * ⚠️ QR কোড আসে public/qr.png থেকে (আগের FaQrcode আইকন সরানো হয়েছে)।
 * আসল app link বদলালে ছবিটা নতুন QR দিয়ে replace করুন।
 *
 * ⚠️ এটা পুরনো `Deliver.tsx`-এর জায়গা নিচ্ছে (page.tsx-এ import
 * বদলানো হয়েছে)। `Deliver.tsx` ফাইলটা মোছা হয়নি — অন্য কোথাও
 * ব্যবহার হচ্ছে কিনা যাচাই করে নিজে মুছবেন:
 *
 *     grep -rn "components/Deliver\"" src/
 */

/** Figma-তে স্টোর বোতাম দুটোই pill-shape, gap 6px, radius 90px। */
function StoreButton({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant: "apple" | "play";
}) {
  return (
    <a
      // ⚠️ App Store / Play Store এখনো publish হয়নি, তাই href="#"।
      // App publish হলে আসল লিংক এখানে বসাবেন।
      href="#"
      aria-label={label}
      className={`flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 font-sora text-[13px] font-semibold leading-[1.6] transition-opacity min-[400px]:px-5 hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:h-14 md:px-6 md:text-[16px] ${
        variant === "apple" ? "bg-[#FF9540] text-white" : "bg-black text-white"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

export default function OneAppSection() {
  const reduceMotion = useReducedMotion();

  const fromLeft = {
    initial: reduceMotion ? false : { opacity: 0, x: -24 },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, amount: 0.3 },
  };

  const fromRight = {
    initial: reduceMotion ? false : { opacity: 0, x: 24 },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, amount: 0.3 },
  };

  return (
    <section
      // overflow-hidden: the slide-in (x ±24px) must not widen the page on phones
      className="overflow-hidden bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]"
      aria-label="Get the Cuisine app"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-12 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
        {/* Left: copy + QR/rating + store buttons */}
        <motion.div
          {...fromLeft}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex w-full max-w-[526px] flex-col items-center gap-9 text-center lg:items-start lg:text-left"
        >
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] text-black md:text-[40px] xl:text-[64px]">
              One App. Endless
              <br className="hidden lg:block" /> Delicious Choices.
            </h2>
            <p className="max-w-[438px] font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
              Browse thousands of freshly prepared meals from your favorite
              restaurants and enjoy fast, reliable delivery right to your
              doorstep.
            </p>
          </div>

          {/* QR block + divider + rating */}
          <div className="flex flex-wrap items-center justify-center gap-5 lg:justify-start">
            <div className="flex items-center gap-2.5">
              {/* public/qr.png — Figma-তে QR-এর পেছনে কোনো বক্স নেই */}
              <Image
                src="/qr.png"
                alt="QR code to download the Cuisine app"
                width={88}
                height={88}
                className="h-[70px] w-[70px] shrink-0 md:h-[88px] md:w-[88px]"
              />
              <span className="max-w-[134px] text-left font-sora text-[13px] leading-[1.6] text-black/70 md:text-[16px]">
                Scan to download the Cuisine app
              </span>
            </div>

            <span
              className="hidden h-[56px] w-[1.5px] bg-black/20 min-[400px]:block md:h-[69px]"
              aria-hidden="true"
            />

            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1">
                <span className="font-sora text-[26px] font-medium leading-none text-black md:text-[30px]">
                  4.8
                </span>
                <span
                  className="flex items-center gap-0.5"
                  aria-hidden="true"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FaStar key={i} className="h-4 w-4 text-black" />
                  ))}
                </span>
              </div>
              <span className="max-w-[185px] text-left font-sora text-[13px] leading-[1.6] text-black/70 md:text-[16px]">
                Join 78+ million of shoppers worldwide
              </span>
            </div>
          </div>

          {/* Store buttons */}
          <div className="flex w-full flex-wrap items-center justify-center gap-3 min-[400px]:gap-4 lg:justify-start">
            <StoreButton
              icon={<FaApple className="h-5 w-5" aria-hidden="true" />}
              label="Apple Store"
              variant="apple"
            />
            <StoreButton
              icon={<FaGooglePlay className="h-5 w-5" aria-hidden="true" />}
              label="Play store"
              variant="play"
            />
          </div>
        </motion.div>

        {/* Right: rider ছবি — desktop-এ বাম কনটেন্টের সমান উচ্চতা (lg:items-stretch + lg:aspect-auto)।
            ⚠️ object-contain: ছবির হাত/শরীর কখনো কাটা পড়ে না (object-cover আর overflow-hidden সরানো হয়েছে)। */}
        <motion.div
          {...fromRight}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="relative aspect-[604/468] w-full max-w-[604px] lg:aspect-auto lg:min-h-[320px]"
        >
          <Image
            src="https://res.cloudinary.com/dzi3u164c/image/upload/v1791560604/riders_odpldl.webp"
            alt="Delivery rider with a Cuisine order"
            fill
            sizes="(min-width: 1024px) 604px, 90vw"
            className="object-contain object-right"
          />
        </motion.div>
      </div>
    </section>
  );
}