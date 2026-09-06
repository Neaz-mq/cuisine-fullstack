"use client";

import { useState } from "react";
import FoodCard, { type MenuCardItem } from "./FoodCard";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** "All" দেখা অবস্থায় প্রতিটা শ্রেণির কতগুলো পদ দেখা যাবে (Figma: তিনটে)। */
const PREVIEW_COUNT = 3;

/**
 * শ্রেণির নাম → emoji।
 *
 * ⚠️ `Category` model-এ icon-এর কোনো মাঠ নেই, তাই এটা **নাম দেখে
 * অনুমান** — সঠিক সমাধান নয়, কাজ চালানোর মতো সমাধান। সঠিকটা হলো
 * schema-য় একটা `icon String?` কলাম + Add Category modal-এ একটা ঘর;
 * তখন এই তালিকাটা শুধু fallback হয়ে যাবে (`category.icon ?? iconFor(name)`)।
 *
 * ⚠️ মিলটা পুরো নামে নয়, **শব্দাংশে** — তাই "Chicken", "Spicy Chicken"
 * আর "Chicken Wings" তিনটেতেই 🍗 বসে। পুরো নামের তালিকা রাখলে সামান্য
 * বানান বদলেই সব খালি হয়ে যেত।
 *
 * ⚠️ ক্রমটা গুরুত্বপূর্ণ — প্রথম যেটা মেলে সেটাই জেতে। তাই নির্দিষ্ট
 * শব্দগুলো (biryani, milkshake) সাধারণগুলোর (rice, drink) **আগে**।
 * উল্টো হলে "Rice & Biryani" ভাতের আইকন পেত, আর "Milkshake" পানীয়ের।
 *
 * ⚠️ কিছুই না মিললে 🍽️ — খালি রাখলে ওই chip-টা বাকিগুলোর চেয়ে সরু
 * হয়ে সারিটা এবড়োখেবড়ো দেখাত।
 */
const CATEGORY_ICONS: [readonly string[], string][] = [
  [["biryani", "pulao", "pilaf"], "🍛"],
  [["milkshake", "shake", "smoothie"], "🥤"],
  [["ice cream", "gelato"], "🍨"],
  [["pizza"], "🍕"],
  [["burger"], "🍔"],
  [["sandwich", "wrap", "roll"], "🥪"],
  [["taco", "burrito", "nacho"], "🌮"],
  [["sushi", "sashimi"], "🍣"],
  [["pasta", "spaghetti"], "🍝"],
  [["noodle", "ramen", "soup", "broth"], "🍜"],
  [["rice", "fried rice"], "🍚"],
  [["chicken", "wing", "poultry"], "🍗"],
  [["steak", "beef", "lamb", "mutton", "grill", "bbq"], "🥩"],
  [["fish", "seafood", "prawn", "shrimp", "crab"], "🦐"],
  [["mushroom"], "🍄"],
  [["salad", "veg", "green"], "🥗"],
  [["appetizer", "starter", "snack", "fries", "side"], "🍟"],
  [["coffee", "espresso", "latte"], "☕"],
  [["tea", "matcha"], "🍵"],
  [["juice"], "🧃"],
  [["drink", "beverage", "soda", "cooler"], "🥤"],
  [["dessert", "cake", "pastry", "sweet"], "🍰"],
  [["bread", "bakery", "bun", "croissant"], "🥐"],
  [["breakfast", "egg", "omelet"], "🍳"],
  [["combo", "meal", "feast", "platter", "family"], "🍱"],
  [["offer", "deal", "discount"], "🏷️"],
  [["popular", "trending", "best"], "🔥"],
  [["signature", "chef", "premium"], "⭐"],
  [["weekly", "special", "today"], "✨"],
];

const FALLBACK_ICON = "🍽️";

function iconFor(name: string): string {
  const needle = name.toLowerCase();
  for (const [keywords, icon] of CATEGORY_ICONS) {
    if (keywords.some((keyword) => needle.includes(keyword))) return icon;
  }
  return FALLBACK_ICON;
}

/**
 * ⚠️ কার্ডের আকারটা এখন `FoodCard.tsx`-এ, কারণ detail পাতাও ওটাই
 * ব্যবহার করে। এখানে কেবল পুরনো নামটা ধরে রাখা, যাতে page.tsx-এর
 * import বদলাতে না হয়।
 */
export type MenuBrowserItem = MenuCardItem;

export type MenuBrowserCategory = {
  id: string;
  name: string;
  items: MenuBrowserItem[];
};

/**
 * src/components/menu/MenuBrowser.tsx
 *
 * Figma Frame 2147235253 — "Categories": column, padding 100px 80px,
 * gap 40, পটভূমি #F9F6F3।
 *
 *   Frame 2147236057  column, gap 30
 *     শিরোনাম          "Categories", Frank Ruhl 600 40px
 *     Frame …053       row, gap 16 — শ্রেণির chip গুলো
 *   Frame 2147236058   প্রতিটা শ্রেণির দল, column, gap 30
 *     Frame …056       row, space-between — নাম (Frank Ruhl 600 36px)
 *                      আর "View All" (Sora 400 20px, Black/70)
 *     Frame …270       row, gap 16 — তিনটে Food Card
 *
 *   Food Card          `FoodCard.tsx` — detail পাতাও ওটাই ব্যবহার করে
 *
 * ── নকশার সাথে একটা পার্থক্য ────────────────────────────────────────
 *
 * ⚠️ chip-এর emoji গুলো **নাম দেখে অনুমান করা** (`iconFor`), DB থেকে
 * আসে না — `Category` model-এ icon-এর কোনো মাঠই নেই। অনুমানটা শব্দাংশ
 * ধরে, তাই নতুন শ্রেণিও সাধারণত ঠিক আইকন পায়, আর না মিললে একটা
 * নিরপেক্ষ 🍽️ বসে। সঠিক সমাধান হলো schema-য় `icon String?` + Add
 * Category modal-এ একটা ঘর; বিস্তারিত `CATEGORY_ICONS`-এর মন্তব্যে।
 *
 * ⚠️ এখানে আর cart-এ কিছু যোগ হয় না — "Order Now" পদটার নিজের পাতায়
 * নিয়ে যায়, আর যোগ করার কাজটা ওখানে। তাই রান্নাঘরের সময় দেখার
 * যুক্তিটাও এখান থেকে সরেছে (আগে ওটাই "Kitchen is closed" toast
 * দেখাচ্ছিল)।
 */
export default function MenuBrowser({
  categories,
}: {
  categories: MenuBrowserCategory[];
}) {
  // null = "All"। শ্রেণির id, নাম নয় — দুটো শ্রেণির নাম এক হতে পারে।
  const [selected, setSelected] = useState<string | null>(null);

  const visible = selected
    ? categories.filter((category) => category.id === selected)
    : categories;

  return (
    <section className="bg-[#F9F6F3] px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-10">
        {/* Frame 2147236057: column, gap 30। */}
        <div className="flex flex-col gap-5 xl:gap-[30px]">
          <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[34px] xl:text-[40px]">
            Categories
          </h2>

          {/**
           * Frame 2147236053: row, gap 16। বাছাই করা chip-এ gradient,
           * বাকিগুলোয় ১px কালো রেখা।
           *
           * ⚠️ `flex-wrap` — Figma-তে ছ'টা chip এক সারিতে ধরে, কিন্তু
           * শ্রেণির সংখ্যা নকশার হাতে নয়। চোদ্দটা হলে এক সারিতে চাপাতে
           * গিয়ে হয় লেখা কাটত, নয় আড়াআড়ি scroll লাগত।
           */}
          <div className="flex flex-wrap gap-3 xl:gap-4">
            {/* ⚠️ "All"-এ কোনো আইকন নেই — Figma-তেও নেই, আর থাকলে
                ওটা একটা শ্রেণির নাম বলে ভুল হতো। */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-pressed={selected === null}
              className={`flex h-12 shrink-0 items-center justify-center rounded-[90px] px-5 font-sora text-[14px] font-semibold leading-[1.6] transition-colors xl:h-14 xl:px-6 xl:text-[16px] ${
                selected === null
                  ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                  : "border border-black text-black hover:bg-black hover:text-white"
              } ${FOCUS_RING}`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelected(category.id)}
                aria-pressed={selected === category.id}
                className={`flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[90px] px-5 font-sora text-[14px] font-semibold leading-[1.6] transition-colors xl:h-14 xl:px-6 xl:text-[16px] ${
                  selected === category.id
                    ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    : "border border-black text-black hover:bg-black hover:text-white"
                } ${FOCUS_RING}`}
              >
                {/**
                 * ⚠️ `aria-hidden` — emoji-টা কেবল চোখের জন্য। না দিলে
                 * screen reader "Pizza" পড়ার আগে "slice of pizza"-ও
                 * পড়ত, অর্থাৎ প্রতিটা chip দুবার শোনা যেত।
                 *
                 * Figma-তে আইকনগুলো ২০px, তাই লেখার (১৬px) চেয়ে সামান্য
                 * বড় — `text-[18px]`/`xl:text-[20px]`।
                 */}
                <span aria-hidden="true" className="text-[18px] leading-none xl:text-[20px]">
                  {iconFor(category.name)}
                </span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            Nothing on the menu yet — please check back soon.
          </p>
        ) : (
          visible.map((category) => {
            /**
             * "All" দেখার সময় প্রতিটা শ্রেণি থেকে তিনটে, আর একটা শ্রেণি
             * বাছা থাকলে তার সবগুলো — "View All" চাপার মানেই সেটা।
             */
            const items =
              selected === null ? category.items.slice(0, PREVIEW_COUNT) : category.items;

            return (
              <div key={category.id} className="flex flex-col gap-5 xl:gap-[30px]">
                {/* Frame 2147236056: row, space-between। */}
                <div className="flex items-center justify-between gap-6">
                  <h3 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[30px] xl:text-[36px]">
                    {category.name}
                  </h3>

                  {/**
                   * ⚠️ "View All" একটা লিঙ্ক নয়, বোতাম — প্রতিটা শ্রেণির
                   * নিজের কোনো পাতা এই অ্যাপে নেই। চাপলে উপরের chip-টাই
                   * বাছা হয়, আর তখন ওই শ্রেণির সব পদ দেখা যায়। একটা
                   * ভাঙা লিঙ্কের চেয়ে এটা ভালো, আর ফলটাও ব্যবহারকারী
                   * যা আশা করেন তাই।
                   */}
                  {selected === null && category.items.length > PREVIEW_COUNT && (
                    <button
                      type="button"
                      onClick={() => setSelected(category.id)}
                      className={`shrink-0 font-sora text-[14px] font-normal leading-[1.14] tracking-[-0.01em] text-black/70 underline-offset-4 transition-colors hover:text-black hover:underline xl:text-[20px] ${FOCUS_RING}`}
                    >
                      View All
                    </button>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="rounded-[30px] bg-white p-6 font-sora text-[14px] leading-[1.7] text-black/70">
                    Nothing in this category yet.
                  </p>
                ) : (
                  /* Frame 2147235270: row, gap 16 — তিনটে কার্ড। */
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => (
                      <FoodCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
