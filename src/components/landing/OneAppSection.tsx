"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { MouseEvent } from "react";
import { FaApple, FaCheck, FaGooglePlay, FaMotorcycle, FaStar } from "react-icons/fa";

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

/**
 * হালকা speed streak — শুধু transform/opacity (GPU)। Bike বাঁ দিকে যাচ্ছে,
 * তাই streak ডান দিকে ধীরে সরে মিলিয়ে যায়। pointer-events-none + aria-hidden।
 * ⚠️ আগের রাস্তার dash ও ধুলো সরানো হয়েছে — ছবিতে চাকা নেই, তাই ওগুলো
 * বিচ্ছিন্ন দেখাচ্ছিল।
 */
function RideEffects() {
  const streaks = [
    { top: "30%", right: "4%", w: 48, delay: 0 },
    { top: "46%", right: "3%", w: 64, delay: 0.9 },
    { top: "60%", right: "5%", w: 40, delay: 1.7 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true">
      {streaks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: [0, 70], opacity: [0, 0.45, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
          style={{ top: s.top, right: s.right, width: s.w }}
          className="absolute h-[2px] transform-gpu rounded-full bg-gradient-to-l from-[#FF9540]/60 to-transparent will-change-transform"
        />
      ))}
    </div>
  );
}

export default function OneAppSection() {
  const reduceMotion = useReducedMotion();

  // Rider ছবির mouse-parallax — শুধু transform (x/y), তাই GPU-তে চলে, repaint হয় না।
  // spring নরম রাখা হয়েছে (বেশি stiffness = কাঁপুনি)। Touch-এ mousemove আসে না।
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 20, mass: 0.8 });
  const sy = useSpring(py, { stiffness: 50, damping: 20, mass: 0.8 });
  const riderX = useTransform(sx, [-0.5, 0.5], [-10, 10]);
  const riderY = useTransform(sy, [-0.5, 0.5], [-6, 6]);

  const handleRiderMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleRiderLeave = () => {
    px.set(0);
    py.set(0);
  };

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
          className="relative z-10 flex w-full max-w-[526px] flex-col items-center gap-9 text-center lg:items-start lg:text-left"
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

        {/* Right: rider ছবি.
            ⚠️ ছবি এখন in-flow (fill নয়): lg-তে `h-full w-auto` — বাম কনটেন্টের ঠিক
            সমান উচ্চতা, নিজের aspect ধরে width নেয়, তাই উপরে-নিচে কোনো ফাঁকা gap থাকে না।
            ⚠️ ছবির আসল aspect বেশি চওড়া হলে ডান কলামে পুরো উচ্চতার জন্য জায়গা কম পড়ে
            (তখন object-contain ছবিকে ছোট করে উপরে-নিচে gap রাখত)। তাই wrapper-টা
            বাঁ দিকে সর্বোচ্চ 160px বাড়তে পারে (lg:max-w-[calc(100%+160px)] + lg:justify-end)।
            ছবির নিজের বাঁ দিকটা সাদা, আর বাম কনটেন্ট z-10 তে — লেখা ঢাকা পড়ে না।
            ⚠️ ছবির নিজস্ব সাদা পটভূমি আছে, তাই পেছনে glow/shadow দেওয়া হয়নি —
            দিলে সাদা আয়তক্ষেত্রটা স্পষ্ট দেখা যায়।
            ⚠️ Smooth রাখতে: শুধু transform/opacity animate, কোনো blur/backdrop-filter
            বা background-position animation নেই, engine-jitter সরানো হয়েছে। */}
        <motion.div
          {...fromRight}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          onMouseMove={handleRiderMove}
          onMouseLeave={handleRiderLeave}
          className="relative w-full max-w-[604px] lg:flex lg:min-h-[320px] lg:min-w-0 lg:max-w-none lg:flex-1 lg:justify-end"
        >
          <div className="relative mx-auto w-full lg:mx-0 lg:h-full lg:w-fit lg:max-w-[calc(100%+160px)] lg:shrink-0">
            {/* parallax (mouse) → float (idle) — দুটো আলাদা layer, দুটোই GPU transform */}
            <motion.div
              style={reduceMotion ? undefined : { x: riderX, y: riderY }}
              className="h-full transform-gpu will-change-transform"
            >
              {/* Riding feel — একটাই ধীর, মসৃণ layer (GPU transform): হালকা ভেসে চলা +
                  সামান্য সামনে ঝোঁক। ⚠️ আগে দ্রুত engine-কাঁপুনি layer ছিল — সেটা
                  shaking মনে হচ্ছিল, তাই সরানো হয়েছে। ছবিটা flat webp, তাই চাকা
                  আলাদা ঘোরানো যায় না। */}
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -5, 0], x: [0, -3, 0], rotate: [0, -0.35, 0] }
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformOrigin: "75% 100%" }}
                className="h-full transform-gpu will-change-transform"
              >
                {/* ⚠️ ছবির ভেতরেই উপরে-নিচে সাদা padding আছে, তাই দৃশ্যমান rider বাম কলামের
                    চেয়ে ~১২% ছোট দেখাত। lg-তে সামান্য scale করে উচ্চতা মেলানো হয়েছে
                    (শুধু transform, ডান-কেন্দ্র থেকে)। মিলছে না মনে হলে 1.13 বদলান। */}
                <div className="h-full lg:origin-[85%_50%] lg:scale-[1.13]">
                  <Image
                    src="https://res.cloudinary.com/dzi3u164c/image/upload/v1791560604/riders_odpldl.webp"
                    alt="Delivery rider with a Cuisine order"
                    width={1208}
                    height={936}
                    sizes="(min-width: 1280px) 714px, (min-width: 1024px) 55vw, 90vw"
                    priority
                    className="block h-auto w-full object-contain object-right lg:h-full lg:w-auto lg:max-w-full"
                  />
                </div>
                </motion.div>
            </motion.div>

            {/* হালকা speed streak — ছবির ডান দিকের ফাঁকা জায়গায় */}
            {!reduceMotion && <RideEffects />}

            {/* Floating chip ১: live ETA */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.7 }}
              className="absolute left-0 top-[8%] z-10 lg:top-5"
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
                className="flex transform-gpu items-center gap-2.5 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] will-change-transform md:px-4 md:py-2.5"
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#FF9540] text-white md:h-9 md:w-9">
                  <FaMotorcycle className="h-4 w-4" aria-hidden="true" />
                  {!reduceMotion && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#FF9540]/40" />
                  )}
                </span>
                <span className="flex flex-col font-sora leading-tight">
                  <span className="text-[11px] text-black/60 md:text-[12px]">Order on the way</span>
                  <span className="text-[13px] font-semibold text-black md:text-[14px]">Arriving in 8 min</span>
                </span>
              </motion.div>
            </motion.div>

            {/* Floating chip ২: delivered (ছোট স্ক্রিনে লুকানো) */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: 1 }}
              className="absolute bottom-[14%] left-0 z-10 hidden sm:block"
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                className="flex transform-gpu items-center gap-2 rounded-full bg-white px-3.5 py-2 font-sora text-[12px] font-semibold text-black shadow-[0_8px_30px_rgba(0,0,0,0.12)] will-change-transform md:text-[13px]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
                Hot &amp; fresh delivered
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}