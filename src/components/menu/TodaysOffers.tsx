"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * src/components/menu/TodaysOffers.tsx
 *
 * Figma "Today's Offers" — তিনটে মাপে তিনটে frame, আর তিনটেই এখানে:
 *
 *   ৩২০px   Frame 2147236011 — padding 48/16, কার্ড 288 চওড়া, radius 20
 *   ৭৬৮px   Frame 2147236007 — padding 100/50, কার্ড 416 চওড়া, radius 30
 *   ১২৮০px  Frame 2147236007 — padding 100/80, তিনটে কার্ড পাশাপাশি
 *
 *   Offer Card    column, space-between, padding 28, 269 উঁচু;
 *                 রঙ তিনটে: #FF9540 · #6DCB66 · #AE80FF
 *     উপরের সারি  নাম (Frank Ruhl 400 24px সাদা) + কোড-pill
 *                 (1px dashed সাদা, radius 100, padding 8/12)
 *     নিচের অংশ   শিরোনাম (Frank Ruhl 500 24px সাদা) + বিবরণ
 *                 (Sora 400 14px/170%, White/70)
 *
 * ── ১২৮০-এর নিচে এটা slider, grid নয় ────────────────────────────────
 *
 * ⚠️ আগে সব মাপেই grid ছিল (`md:grid-cols-2 xl:grid-cols-3`), তাই
 * ৭৬৮px-এ দুটো কার্ড পাশাপাশি আর তৃতীয়টা একা নিচে — একটা ফাঁকা ঘর
 * নিয়ে। Figma-তে ওখানে একটাই সারি, ডান দিকে উপচে পড়া, নিচে দুটো
 * তীর। ৩২০px-এও তাই, শুধু একটা কার্ড পুরো দেখা যায়।
 *
 * ⚠️ slider-টা `scrollBy` দিয়ে, কোনো `translateX` state দিয়ে নয়।
 * কারণ তাতে **আঙুলের swipe বিনামূল্যে পাওয়া যায়** — native scroll,
 * momentum সহ। transform দিয়ে করলে touch, mouse-drag, keyboard
 * তিনটেই হাতে লিখতে হতো, আর মোবাইলে সেটাই আসল ব্যবহার।
 *
 * `snap-x snap-mandatory` — আঙুল ছাড়লে কার্ডটা নিজে থেকে জায়গামতো
 * বসে, মাঝখানে আটকে থাকে না।
 */
export type MenuOffer = {
  id: string;
  code: string;
  /** "20% Off Your Order" — ছাড় থেকে বানানো। */
  headline: string;
  /** কার্ডের উপরের ছোট নাম — কীসের উপরে ছাড়। */
  eyebrow: string;
  /** "Use code X at checkout…" — শর্তগুলো থেকে বানানো। */
  detail: string;
};

/**
 * ── লেখাগুলো কোথা থেকে আসে ─────────────────────────────────────────
 *
 * ⚠️ Figma-তে কার্ডের লেখা marketing copy ("New Here", "Free Delivery
 * Over $25")। `Coupon` model-এ ওরকম কোনো মাঠ নেই — কোড, ছাড়ের ধরন,
 * সর্বনিম্ন অর্ডার আর মেয়াদ, এটুকুই।
 *
 * দুটো পথ ছিল: `title`/`description` কলাম যোগ করা, নাকি যা আছে তা
 * থেকেই বাক্য বানানো। দ্বিতীয়টা নেওয়া হলো, কারণ কলাম যোগ করলে সেগুলো
 * ভরার কোনো উপায় থাকত না (admin-এর coupon form-এ ঘর নেই), অর্থাৎ
 * প্রতিটা কার্ড ফাঁকা শিরোনাম নিয়ে বসত। এখন যা দেখা যায় তার প্রতিটা
 * শব্দ সত্যি।
 *
 * ⚠️ কোনো চালু কুপন না থাকলে পুরো section-টাই দেখা যায় না। খালি
 * "Today's Offers" শিরোনামের নিচে তিনটে ফাঁকা রঙিন বাক্স তার চেয়ে
 * অনেক খারাপ দেখাত।
 */

/**
 * Figma-র তিনটে রঙ, ক্রম অনুযায়ী। তিনটের বেশি কুপন এলে আবার প্রথম
 * থেকে ঘোরে — designer তিনটেই এঁকেছেন, কিন্তু কুপনের সংখ্যা তো
 * নকশার হাতে নয়।
 */
const CARD_COLORS = ["#FF9540", "#6DCB66", "#AE80FF"];

/** Figma Frame 2147236026/2147235619 — তীরের বোতাম, 44×44, radius 100। */
const ARROW_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function TodaysOffers({ offers }: { offers: MenuOffer[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  /**
   * তীরদুটো চালু না নিষ্ক্রিয় — scroll-এর অবস্থান দেখে।
   *
   * ⚠️ ১px-এর একটা ছাড় (`> 1`) রাখা হয়েছে। browser-এর scroll মান
   * ভগ্নাংশ হতে পারে (device pixel ratio ১ নয় এমন পর্দায়), তাই ঠিক
   * `=== 0` বা `=== max` প্রায় কখনোই মেলে না — শেষ প্রান্তে গিয়েও
   * "next" চালু দেখাত।
   */
  const syncArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    syncArrows();
    // পর্দার মাপ বদলালে কার্ডের প্রস্থ বদলায়, তাই আবার হিসাব।
    window.addEventListener("resize", syncArrows);
    return () => window.removeEventListener("resize", syncArrows);
  }, [syncArrows, offers.length]);

  /**
   * এক কার্ড সমান সরানো।
   *
   * ⚠️ দূরত্বটা হাতে লেখা নয়, প্রথম কার্ডের **মাপা প্রস্থ** + ১৬px
   * ফাঁক। কার্ডের প্রস্থ breakpoint-ভেদে বদলায় (288 → 416 → grid),
   * তাই স্থির সংখ্যা লিখলে ট্যাবলেটে আধা কার্ড সরত।
   */
  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.firstElementChild as HTMLElement | null;
    if (!track || !card) return;
    track.scrollBy({ left: direction * (card.offsetWidth + 16), behavior: "smooth" });
  };

  if (offers.length === 0) return null;

  return (
    <section className="bg-white px-4 py-12 md:px-[50px] md:py-[100px] xl:px-20">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[30px]">
        {/* Frame 2147236051: row, space-between, gap 60। */}
        <div className="flex items-center justify-between gap-6 md:gap-[60px]">
          <h2 className="font-frank-ruhl text-[16px] font-semibold leading-[1.14] tracking-[-0.01em] text-black min-[560px]:text-[22px] md:text-[28px] xl:text-[40px]">
            Today&apos;s Offers
          </h2>
          <p className="shrink-0 font-sora text-[11px] font-normal leading-[1.14] tracking-[-0.01em] text-black/70 md:text-[16px] xl:text-[20px]">
            Valid till stock lasts
          </p>
        </div>

        {/* Frame 2147236564: column, gap 16 — সারি, তারপর তীরদুটো। */}
        <div className="flex flex-col gap-4">
          {/**
           * ⚠️ `xl:` থেকে এটা আর slider নয়, তিন কলামের grid —
           * `xl:overflow-visible` দিয়ে scroll বন্ধ, আর কার্ডগুলোর
           * `xl:w-auto` দিয়ে প্রস্থ grid-এর হাতে ছেড়ে দেওয়া। ১২৮০px-এ
           * তিনটে কার্ড এমনিতেই আঁটে, তাই ওখানে scroll রাখাটা কেবল
           * একটা অপ্রয়োজনীয় scrollbar।
           *
           * ⚠️ scrollbar লুকানো হয়েছে তিনটে নিয়মে (Firefox, IE,
           * WebKit) — নাহলে কার্ডের নিচে একটা ধূসর পটি বসে থাকত,
           * অথচ চলাচলের জন্য তীর আর আঙুল দুটোই আছে।
           */}
          <div
            ref={trackRef}
            onScroll={syncArrows}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-3 xl:overflow-visible"
          >
            {offers.map((offer, index) => (
              /**
               * ⚠️ পুরো কার্ডটাই একটা লিঙ্ক — ভেতরে আলাদা কোনো বোতাম নেই।
               * নকশায় কার্ডে কোনো "See offer" বোতাম আঁকা নেই, অথচ কার্ডটা
               * চাপলে ছাড়ের পাতায় যাওয়ার কথা; পুরোটা ক্লিকযোগ্য হলে
               * লক্ষ্যটাও বড় হয় (মোবাইলে আঙুলের জন্য গুরুত্বপূর্ণ)।
               *
               * ⚠️ `draggable={false}` — নাহলে slider-এ কার্ড টেনে সরাতে
               * গেলে browser লিঙ্কটাকেই "টেনে আনা" শুরু করত, আর swipe
               * মাঝপথে আটকে যেত।
               */
              <Link
                key={offer.id}
                href={`/offers/${encodeURIComponent(offer.code)}`}
                draggable={false}
                aria-label={`${offer.eyebrow}: ${offer.headline}`}
                style={{ backgroundColor: CARD_COLORS[index % CARD_COLORS.length] }}
                className="relative flex h-[269px] w-[288px] shrink-0 snap-start flex-col justify-between gap-10 overflow-hidden rounded-[20px] p-7 transition-transform hover:scale-[1.01] focus:outline-none focus-visible:[outline:2px_solid_#111] focus-visible:[outline-offset:3px] md:w-[416px] md:rounded-[30px] xl:w-auto"
              >
                {/**
                 * Vector 7957 — Figma-র হালকা ঢেউ (একটা path, 20px সাদা
                 * stroke, opacity 0.06)।
                 *
                 * ⚠️ এটা `rounded-[50%] border-[20px]` দিয়ে করা যায় না —
                 * ellipse-এর border মানে **বন্ধ একটা ঘের**, তাই কার্ডে
                 * উপরে-নিচে দুটো আলাদা রেখা দেখা যেত। Figma-তে ওটা
                 * একটাই খোলা রেখা।
                 *
                 * ⚠️ `preserveAspectRatio="none"` + `inset-0` — ঢেউটা
                 * কার্ডের সাথে টেনে বসে, স্থির px মাপে নয়। কার্ডগুলো
                 * সমান চওড়া, তাই প্রতিটাতেই রেখাটা একই উচ্চতায় ঢোকে ও
                 * বেরোয় — চোখে একটানা একটা রেখা বলে মনে হয়।
                 */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 416 269"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <path
                    d="M-40 145 C 60 95, 150 95, 230 125 C 310 155, 380 150, 456 118"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="20"
                    strokeOpacity="0.06"
                  />
                </svg>

                {/* Frame 2147235265: row, space-between। */}
                <div className="relative flex items-center justify-between gap-4">
                  <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-normal leading-[1.3] text-white xl:text-[24px]">
                    {offer.eyebrow}
                  </h3>
                  {/* Frame 2147235205: dashed pill, ভেতরে কোডটা। */}
                  <span className="shrink-0 rounded-full border border-dashed border-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-white">
                    {offer.code}
                  </span>
                </div>

                {/**
                 * Frame 2147235266: column, gap 20।
                 *
                 * ⚠️ দুটো মাপ স্থির করে দেওয়া হয়েছে। কার্ডগুলো সমান
                 * উঁচু হয় ঠিকই, কিন্তু নিচের ব্লকটার **নিজের** উচ্চতা
                 * লেখার উপর নির্ভর করত: এক কার্ডে বিবরণ এক লাইন,
                 * আরেকটায় দুই — তাই শিরোনাম তিনটে তিন উচ্চতায় বসত।
                 *
                 * শিরোনাম দুই লাইনে বাঁধা (৩২০px-এ "20% Off Your First
                 * Order" দুই লাইনেই যায়, Figma-তেও তাই) আর বিবরণের ঘর
                 * সবসময় দুই লাইন সমান উঁচু — তাই তিনটে কার্ডে দুটোই এক
                 * সরলরেখায়।
                 */}
                <div className="relative flex flex-col gap-4 xl:gap-5">
                  <p className="line-clamp-2 min-h-[62px] font-frank-ruhl text-[20px] font-medium leading-[1.3] text-white md:min-h-0 md:line-clamp-1 xl:text-[24px]">
                    {offer.headline}
                  </p>
                  <p className="line-clamp-2 min-h-[44px] font-sora text-[13px] font-normal leading-[1.7] text-white/70 xl:min-h-[48px] xl:text-[14px]">
                    {offer.detail}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/**
           * Frame 2147236032 — তীরদুটো, মাঝবরাবর, নিজেদের মধ্যে gap 8।
           *
           * ⚠️ `xl:hidden` — ১২৮০px-এ তিনটে কার্ডই একসাথে দেখা যায়,
           * তাই সরানোর মতো কিছু নেই। Figma-র desktop frame-এও তীর নেই।
           *
           * ⚠️ শর্তটা `offers.length > 1`, `canNext` নয় — যদিও প্রথম
           * দৃশ্যে দুটোই একই ফল দিত। `canNext` মাপা হয় mount-এর পরে
           * (`useEffect`), তাই প্রথম রঙে তীরদুটো থাকত না আর এক মুহূর্ত
           * পরে হঠাৎ এসে নিচের সব কিছু ঠেলে দিত। কুপনের সংখ্যা render-এর
           * আগেই জানা, তাই ওটা দিয়ে ঠিক করলে কোনো লাফ নেই — বোতামদুটো
           * কেবল নিষ্ক্রিয় থাকে।
           */}
          {offers.length > 1 && (
            <div className="flex items-center justify-center gap-2 xl:hidden">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                disabled={!canPrev}
                aria-label="Previous offer"
                /* Figma-তে এই বোতামটা সাদা, কিন্তু section-এর পটভূমিও
                   সাদা — তাই cream (#F9F6F3), মোবাইল frame-এ designer
                   নিজেও সেটাই দিয়েছেন। */
                className={`${ARROW_BUTTON} bg-[#F9F6F3] text-black hover:bg-black/[0.06]`}
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => scrollByCard(1)}
                disabled={!canNext}
                aria-label="Next offer"
                className={`${ARROW_BUTTON} bg-black text-white hover:opacity-80`}
              >
                <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
