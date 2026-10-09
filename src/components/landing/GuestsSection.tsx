"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Play } from "lucide-react";
import {
  GUEST_STORIES,
  GUEST_VIDEO,
  type GuestStory,
} from "@/lib/landing-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/GuestsSection.tsx
 *
 * Figma Frame 2147235871 — "Our Guests": column, padding 100px 80px,
 * gap 60, সাদা। নিচে row (gap 26): প্রশংসাপত্র · ছবি · প্রশংসাপত্র।
 */
function StoryCard({ story }: { story: GuestStory }) {
  return (
    /* Feedback: column, space-between, padding 30px 18px, radius 30,
       BG #F9F6F3, উচ্চতা 479। */
    <div className="flex flex-col justify-between gap-8 rounded-[30px] bg-[#F9F6F3] px-5 py-7 lg:h-[479px] xl:px-[18px] xl:py-[30px]">
      <div className="flex flex-col gap-6 xl:gap-9">
        {/* Frame 2147235973: column, gap 8। */}
        <div className="flex flex-col gap-2">
          <p className="font-frank-ruhl text-[44px] font-medium leading-[1.14] tracking-[-0.01em] text-black xl:text-[64px]">
            {story.stat}
          </p>
          <p className="font-sora text-[13px] font-normal leading-[1.6] text-black/70 xl:text-[14px]">
            {story.statLabel}
          </p>
        </div>

        {/**
         * ⚠️ `<blockquote>`, সাধারণ `<p>` নয় — এটা সত্যিই কারও উদ্ধৃতি,
         * আর screen reader-এ সেটা আলাদা করে বোঝা গেলে নিচের নামটার
         * সাথে সম্পর্কটা পরিষ্কার হয়।
         */}
        <blockquote className="font-sora text-[15px] font-normal leading-[1.6] text-black xl:text-[18px]">
          &ldquo;{story.quote}&rdquo;
        </blockquote>
      </div>

      {/* Frame 2147235976: row, gap 12 — ছবি + নাম/পরিচয়। */}
      <figcaption className="flex items-center gap-3">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white">
          {/* ⚠️ `unoptimized` — avatar এখন আলাদা Cloudinary account (dzi3u164c)-এ;
              next/image-এর remotePatterns-এ সেটা না থাকলেও যেন ছবি আসে
              (Signature/Combo কার্ডেও একই কারণে `unoptimized`)। */}
          <Image
            src={story.avatar}
            alt={story.name}
            fill
            unoptimized
            sizes="48px"
            className="object-cover"
          />
        </span>

        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate font-frank-ruhl text-[18px] font-medium leading-[1.3] text-black xl:text-[20px]">
            {story.name}
          </span>
          <span className="truncate font-sora text-[13px] font-normal leading-none text-black/70 xl:text-[14px]">
            {story.role}
          </span>
        </span>
      </figcaption>
    </div>
  );
}

/**
 * মাঝের ভিডিও — একই 488×479 ঘরের ভেতরেই চলে, কোনো modal/redirect নেই।
 *
 * তিনটে অবস্থা: idle (thumbnail + play) → loading (বোতামে spinner) →
 * playing (cover fade-out, controls আসে)।
 *
 * ⚠️ cover সরে `onPlaying` event-এ, ক্লিকের মুহূর্তে নয়। আগে ক্লিকেই cover
 * সরে যেত, তাই ভিডিও লোড না হলে (duration 0:00) ব্যবহারকারী দেখত শুধু
 * মরা controls। এখন ভিডিও সত্যিই চালু হলে তবেই cover সরে; না হলে
 * thumbnail-এ থেকে যায় আর কারণ দেখায়।
 *
 * ⚠️ শুধু আসল `src` — আগের `vc_h264` সংস্করণ বাদ। Cloudinary বড় ভিডিওর
 * নতুন transformation প্রথমবার বানাতে সময় নেয় (অনুরোধ ঝুলে থাকে বা
 * 423 দেয়), আর সেই সময় `<video>` আটকে থাকত।
 *
 * মসৃণতা: `<video>` শুরু থেকেই DOM-এ (`preload="auto"`), তাই ক্লিকে
 * mount-এর খরচ নেই; fade শুধু opacity/transform।
 */
function GuestVideo({
  src,
  poster,
  alt,
}: {
  src: string;
  poster: string;
  alt: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const el = videoRef.current;
    if (!el || state === "loading") return;
    setError(null);
    setState("loading");
    // play() একটা Promise — reject হলে (autoplay নীতি, লোড-ব্যর্থতা) cover ফিরিয়ে দিই।
    el.play().catch(() => {
      setState("idle");
      setError((prev) => prev ?? "Couldn't start the video. Please try again.");
    });
  };

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-[20px] bg-black lg:h-[479px]">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        aria-label={alt}
        preload="auto"
        playsInline
        controls={state === "playing"}
        onPlaying={() => setState("playing")}
        onEnded={() => {
          setState("idle");
          if (videoRef.current) videoRef.current.currentTime = 0;
        }}
        onError={() => {
          setState("idle");
          setError("Video couldn't be loaded.");
        }}
        className="h-full w-full object-cover"
      />

      {/* Cover: thumbnail + হালকা আভা + 80×80 play বোতাম
          (Frame 2147235980: BG rgba(0,0,0,0.2), radius 100, 44px আইকন)।
          ⚠️ `cursor-pointer` — Tailwind v4-এ <button>-এর ডিফল্ট cursor
          এখন `default`, তাই স্পষ্ট করে দিতে হয়। */}
      <button
        type="button"
        onClick={start}
        aria-label="Play guest video"
        tabIndex={state === "playing" ? -1 : 0}
        className={`group isolate absolute inset-0 flex cursor-pointer items-center justify-center bg-black/10 transition-opacity duration-500 ease-out focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-4px] ${
          state === "playing" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {/* `unoptimized` — আলাদা Cloudinary account, remotePatterns-এ না থাকলেও চলবে। */}
        <Image
          src={poster}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 488px, 100vw"
          className="-z-10 object-cover"
        />
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-black/20 backdrop-blur-[2px] transition-transform duration-300 ease-out will-change-transform group-hover:scale-110 xl:h-20 xl:w-20"
        >
          {state === "loading" ? (
            <Loader2 className="h-7 w-7 animate-spin text-white xl:h-9 xl:w-9" strokeWidth={1.5} />
          ) : (
            <Play className="h-7 w-7 fill-white text-white xl:h-9 xl:w-9" strokeWidth={1.5} />
          )}
        </span>

        {error && (
          <span
            role="alert"
            className="absolute inset-x-4 bottom-4 rounded-full bg-white/90 px-4 py-2 text-center font-sora text-[12px] leading-none text-black"
          >
            {error}
          </span>
        )}
      </button>
    </div>
  );
}

export default function GuestsSection({
  stories = GUEST_STORIES,
  video = GUEST_VIDEO,
}: {
  stories?: GuestStory[];
  video?: { src: string; poster: string; alt: string };
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/* Frame 2147235253: column, align center, gap 16। */}
        <div className="flex flex-col items-center gap-4">
          {/* Level Button: 126×38, BG #F9F6F3, বিন্দু 8px #FF9540। */}
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-1.5 rounded-full bg-[#F9F6F3] px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Our Guests
          </motion.span>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="flex max-w-[838px] flex-col items-center gap-4 xl:gap-5"
          >
            <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Real Flavors, Unforgettable Experiences Every Time
            </h2>

            <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
              Don&apos;t just take our word for it. Explore stories from food lovers who have
              shared unforgettable moments around our tables.
            </p>
          </motion.div>
        </div>

        {/**
         * Frame 2147235980: row, gap 26 — 370 · 488 · 370।
         *
         * ⚠️ অনুপাতটা `lg:grid-cols-[370fr_488fr_370fr]` দিয়ে, সমান
         * তিন ভাগে নয় — মাঝেরটা Figma-তে চওড়া, আর সমান করলে ওটার
         * ছবিটা চেপে গিয়ে মুখগুলো কাটা পড়ত।
         *
         * ছোট পর্দায় এক কলাম, আর তখন ছবিটা **প্রথমে** (`order-first`)
         * — দুটো লম্বা উদ্ধৃতির পরে ছবি এলে ওটা এত নিচে পড়ত যে
         * কেউ পৌঁছাত না।
         */}
        <div className="grid gap-4 lg:grid-cols-[370fr_488fr_370fr] lg:gap-[26px]">
          <motion.figure
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="order-first lg:order-none"
          >
            <GuestVideo src={video.src} poster={video.poster} alt={video.alt} />
          </motion.figure>

          {stories.map((story, index) => (
            <motion.div
              key={story.name}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
              /* ⚠️ DOM-ক্রমে ছবিটা প্রথম, কিন্তু বড় পর্দায় ওটা মাঝে
                 থাকতে হয় — তাই প্রথম উদ্ধৃতিটা `lg:order-first`. */
              className={index === 0 ? "lg:order-first" : ""}
            >
              <StoryCard story={story} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}