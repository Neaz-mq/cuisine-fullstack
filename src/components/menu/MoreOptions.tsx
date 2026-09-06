import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FoodCard, { type MenuCardItem } from "./FoodCard";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * src/components/menu/MoreOptions.tsx
 *
 * Figma Frame 2147236101 — "Check Out More Yummy Options": column,
 * padding 100px 80px, gap 100, পটভূমি #F9F6F3।
 *
 *   Frame 2147236051  row, space-between — শিরোনাম (Frank Ruhl 600
 *                     40px) আর "Most ordered this week" (Sora 400 20px)
 *   Frame 2147235270  row, gap 16 — তিনটে Food Card
 *
 * ⚠️ কার্ডটা `FoodCard.tsx` থেকেই, মেনু পাতার হুবহু একই component।
 * Figma-তেও frame-এর নাম এক ("Food Card 2"), অর্থাৎ designer একই
 * কার্ডই আবার ব্যবহার করেছেন।
 *
 * ⚠️ "Most ordered this week" লেখাটা রাখা হয়েছে, কিন্তু পদগুলো আসলে
 * **একই শ্রেণির অন্য পদ** — অর্ডারের সংখ্যা ধরে সাজানো নয়। সেটা করতে
 * হলে `OrderItem` জুড়ে গুনতে হতো, আর সেটা এই পাতার জন্য একটা ভারী
 * query। লেখাটা বদলে "More from this category" করে দেওয়াই বেশি সৎ
 * হতো; নকশার শব্দ রাখা হলো, কিন্তু জেনে রাখা দরকার।
 */
export function MoreOptions({ items }: { items: MenuCardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-10">
        <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between min-[560px]:gap-[60px]">
          <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[34px] xl:text-[40px]">
            Check Out More Yummy Options
          </h2>
          <p className="font-sora text-[14px] font-normal leading-[1.14] tracking-[-0.01em] text-black/70 md:text-[16px] xl:text-[20px]">
            More from this category
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Figma Frame 2147236100 — শেষ ব্লক: column, padding 100px 80px,
 * gap 60, পটভূমি সাদা।
 *
 *   h2      Frank Ruhl 600 64px/114%, center, −0.01em, #141921
 *   p       Sora 400 16px/160%, center, Black/70, চওড়া 636
 *   বোতাম   209×56, gradient, radius 100, padding 14px 6px 14px 24px,
 *           ডানে 44×44 সাদা গোল + তীর
 *
 * ⚠️ menu পাতার `MenuComboCta`-র সাথে গড়ন এক, কিন্তু লেখা আর বোতামের
 * সংখ্যা আলাদা (ওখানে দুটো, এখানে একটা)। তাই আলাদা component — একটা
 * দিয়ে দুটো চালাতে গেলে prop-এর তালিকা এত লম্বা হতো যে পড়ে বোঝা
 * যেত না কোন পাতায় কী দেখাচ্ছে।
 */
export function FullMenuCta() {
  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-8 xl:gap-9">
        <div className="flex max-w-[1008px] flex-col items-center gap-4 xl:gap-5">
          <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#141921] md:text-[40px] lg:text-[52px] xl:text-[64px]">
            Looking for Something Specific That&apos;s Fresh and Delicious?
          </h2>

          <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
            Explore a wide selection of freshly prepared dishes made with quality
            ingredients and unforgettable flavors.
          </p>
        </div>

        {/**
         * Figma: padding `14px 6px 14px 24px` — ডান দিকটা মাত্র 6,
         * কারণ ভেতরের সাদা গোলটাই (44px) ডান কিনারা ভরায়। সমান padding
         * দিলে বোতামটা ডান দিকে অকারণ চওড়া লাগত।
         */}
        <Link
          href="/menu"
          className={`group flex h-[52px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-[14px] pl-6 pr-1.5 font-sora text-[15px] font-semibold leading-[1.6] text-white transition-opacity hover:opacity-90 xl:h-14 xl:text-[16px] ${FOCUS_RING}`}
        >
          View Full Menu
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white xl:h-11 xl:w-11">
            <ArrowRight
              className="h-[18px] w-[18px] text-black transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </span>
        </Link>
      </div>
    </section>
  );
}
