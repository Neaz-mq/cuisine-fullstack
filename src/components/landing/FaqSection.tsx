"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
/**
 * ⚠️ `Minus` ব্যবহার করিনি — ওটা প্রজেক্টে আর কোথাও নেই, তাই এই
 * lucide সংস্করণে আছে কি না যাচাই করা নেই। মাইনাসটা একটা সাধারণ
 * দাগ (`<span>`) দিয়েই হয়, আর তাতে ঝুঁকিও থাকে না।
 */
import { Plus, Search } from "lucide-react";
import { FAQ_ITEMS, type FaqItem } from "@/lib/landing-content";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * src/components/landing/FaqSection.tsx
 *
 * Figma Frame 2147230702 — "FAQ": row, padding 100px 80px, gap 60,
 * BG #F9F6F3। বাঁয়ে শিরোনাম + খোঁজার ঘর (501px), ডানে প্রশ্নের
 * তালিকা (658px)।
 */
export default function FaqSection({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  const reduceMotion = useReducedMotion();

  /**
   * ⚠️ একটাই খোলা থাকে (`openIndex`), একাধিক নয় — Figma-তে প্রথমটাই
   * খোলা আর বাকিগুলো বন্ধ, আর accordion-এর চেনা আচরণও তাই।
   */
  const [openIndex, setOpenIndex] = useState(0);
  const [query, setQuery] = useState("");

  /**
   * ⚠️ খোঁজাটা প্রশ্ন **আর** উত্তর দুটোতেই — কেউ "gluten" লিখলে
   * প্রশ্নে ওই শব্দ নেই, উত্তরে আছে। শুধু প্রশ্নে খুঁজলে ফল আসত না,
   * আর ব্যবহারকারী ভাবতেন উত্তরটা নেই।
   */
  const visible = query.trim()
    ? items.filter((item) =>
        `${item.question} ${item.answer}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 lg:flex-row lg:gap-[81px]">
        {/* Frame 2147235866: column, gap 40, চওড়া 501। */}
        <div className="flex flex-col gap-6 lg:w-[501px] lg:shrink-0 xl:gap-10">
          <div className="flex flex-col gap-4 xl:gap-5">
            {/* Level Button: 89×38, সাদা, বিন্দু 8px #FF9540। */}
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              FAQ&apos;S
            </motion.span>

            <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[40px] lg:text-[52px] xl:text-[64px]">
              Frequently Asked Questions
            </h2>

            <p className="max-w-[422px] font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
              Can&apos;t find what you&apos;re looking for? Type your question into the search bar
              or browse our most common answers.
            </p>
          </div>

          {/**
           * Frame 2147234323: row, padding 14px 24px, radius 90, চওড়া 343।
           *
           * ⚠️ ইনপুট ১৬px, placeholder ছোট নয় — এখানে Figma-ও ১৬px
           * বলে, আর iOS-এর zoom-এর নিয়মটাও ১৬px-এই সন্তুষ্ট। তাই
           * admin-এর `placeholder:text-[12px]` কৌশলটা লাগেনি।
           */}
          <label className="flex h-[52px] w-full max-w-[343px] items-center gap-1.5 rounded-[90px] border border-black/20 bg-transparent px-6 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your question....."
              aria-label="Search frequently asked questions"
              className="min-w-0 flex-1 bg-transparent font-sora text-[16px] font-normal leading-none text-black placeholder:text-black/50 focus:outline-none"
            />
            <Search className="h-5 w-5 shrink-0 text-black" strokeWidth={1.5} aria-hidden="true" />
          </label>
        </div>

        {/* Frame 2147235518: column, gap 16, চওড়া 658। */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 xl:gap-4">
          {visible.length === 0 ? (
            <p className="font-sora text-[14px] leading-[1.7] text-black/70">
              No questions match that search. Try a different word, or ask us directly.
            </p>
          ) : (
            visible.map((item) => {
              /**
               * ⚠️ ক্রমটা `items`-এর ভেতরের অবস্থান থেকে, `visible`-এর
               * নয় — নাহলে খোঁজার পরে "01" নম্বরটা অন্য প্রশ্নের গায়ে
               * বসত, আর কেউ নম্বর ধরে কিছু মনে রাখলে বিভ্রান্ত হতেন।
               */
              const realIndex = items.indexOf(item);
              const open = openIndex === realIndex;

              return (
                <div
                  key={item.question}
                  /* FAQ: row, radius 16; খোলা থাকলে সাদা আর padding
                     30px 20px, বন্ধ থাকলে স্বচ্ছ আর padding 20। */
                  className={`rounded-[16px] transition-colors ${
                    open ? "bg-white px-5 py-6 xl:px-5 xl:py-[30px]" : "bg-transparent p-5"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(open ? -1 : realIndex)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-4 text-left focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:4px] xl:gap-[33px]"
                    >
                      <span className="shrink-0 font-sora text-[16px] font-normal leading-[1.4] text-black/50 xl:text-[18px]">
                        {String(realIndex + 1).padStart(2, "0")}
                      </span>

                      <span className="min-w-0 flex-1 font-frank-ruhl text-[18px] font-medium leading-[1.3] text-black xl:text-[24px]">
                        {item.question}
                      </span>

                      {/**
                       * Frame 2147235511: 40×40, radius 100 — খোলা
                       * থাকলে ভরাট #FF9540 আর মাইনাস, বন্ধ থাকলে
                       * রেখা-টানা আর প্লাস।
                       */}
                      <span
                        aria-hidden="true"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                          open ? "bg-[#FF9540] text-white" : "border border-black/20 text-black"
                        }`}
                      >
                        {open ? (
                          <span className="block h-0.5 w-4 rounded-full bg-current" />
                        ) : (
                          <Plus className="h-4 w-4" strokeWidth={2} />
                        )}
                      </span>
                    </button>
                  </h3>

                  {/**
                   * ⚠️ উত্তরটা খোলা না থাকলে DOM-এ **থাকেই না**,
                   * `hidden` দিয়ে লুকোনো নয়। লুকোনো লেখা screen
                   * reader কখনো কখনো পড়ে ফেলে, আর তখন বন্ধ
                   * accordion-ও পাঁচটা উত্তর একসাথে শোনায়।
                   */}
                  {open && (
                    <p className="mt-3 pl-[calc(1rem+2ch)] pr-14 font-sora text-[14px] font-normal leading-[1.7] text-black/70 xl:pl-[calc(33px+2ch)] xl:text-[16px]">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
