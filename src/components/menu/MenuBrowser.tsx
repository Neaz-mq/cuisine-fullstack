"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Star, UtensilsCrossed } from "lucide-react";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** Figma-র ছোট তথ্য-chip: padding 4px 8px, radius 30, BG #F9F6F3, Sora 12। */
const FACT_CHIP =
  "flex shrink-0 items-center rounded-[30px] bg-[#F9F6F3] px-2 py-1 font-sora text-[12px] font-normal leading-[1.6] text-black";

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

export type MenuBrowserItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  priceLabel: string;
  imageUrl: string | null;
  isAvailable: boolean;
  calories: number | null;
  fatGrams: number | null;
  proteinGrams: number | null;
  prepTimeMinutes: number | null;
  /** অনুমোদিত review-এর গড়, না থাকলে null। */
  rating: number | null;
};

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
 *   Food Card          column, padding 12/12/20, gap 16, radius 30,
 *                      সাদা, 416×455
 *     ছবির ঘর          392×203, BG #F9F6F3, radius 24; উপরে সাদা
 *                      "Food Available" pill
 *     নাম + রেটিং      Frank Ruhl 500 24px · তারা 16px + সংখ্যা
 *     তথ্য-chip        30 min · 615 kcal · 65 Fats · 45 Protein
 *     বিবরণ            Sora 400 14px/170%, Black/70, দুই লাইন
 *     দাম + বোতাম      Frank Ruhl 500 24px · gradient "Order Now"
 *
 * ── নকশার সাথে তিনটে জায়গায় পার্থক্য, আর প্রতিটার কারণ ─────────────
 *
 * ⚠️ chip-এর emoji গুলো **নাম দেখে অনুমান করা** (`iconFor`), DB থেকে
 * আসে না — `Category` model-এ icon-এর কোনো মাঠই নেই। অনুমানটা শব্দাংশ
 * ধরে, তাই নতুন শ্রেণিও সাধারণত ঠিক আইকন পায়, আর না মিললে একটা
 * নিরপেক্ষ 🍽️ বসে। সঠিক সমাধান হলো schema-য় `icon String?` + Add
 * Category modal-এ একটা ঘর; বিস্তারিত `CATEGORY_ICONS`-এর মন্তব্যে।
 *
 * ⚠️ ছাড়ের ব্যাজ ("20%") আর কাটা পুরনো দাম বসানো হয়নি। `MenuItem`-এ
 * "আগের দাম" বলে কিছু নেই, আর ছাড় এই অ্যাপে কুপন-ভিত্তিক (checkout-এ
 * প্রয়োগ হয়), পদের গায়ে লেখা নয়। ২০% লিখে রেখে checkout-এ পুরো দাম
 * নেওয়াটা নকশা মানা নয়, প্রতারণা।
 *
 * ⚠️ তথ্য-chip গুলো যেগুলোর মান আছে কেবল সেগুলোই দেখায়। Admin-এর
 * "Add Item" modal-এ ওগুলো ঐচ্ছিক, তাই পুরনো পদে প্রায়ই ফাঁকা — আর
 * "0 kcal" লেখা মানে "এই খাবারে ক্যালরি নেই" দাবি করা।
 */
export default function MenuBrowser({
  categories,
  kitchenOpenHour,
  kitchenCloseHour,
  timezone,
}: {
  categories: MenuBrowserCategory[];
  kitchenOpenHour: number;
  kitchenCloseHour: number;
  timezone: string;
}) {
  const { addToCart } = useCart();
  // null = "All"। শ্রেণির id, নাম নয় — দুটো শ্রেণির নাম এক হতে পারে।
  const [selected, setSelected] = useState<string | null>(null);
  const [isKitchenOpen, setIsKitchenOpen] = useState(true);

  /**
   * রান্নাঘর খোলা কিনা — **রেস্তোরাঁর** ঘড়ি ধরে, browser-এর নয়।
   * Signature.tsx-এ একই যুক্তি, তবে সেখানে সময়টা হাতে লেখা ধ্রুবক;
   * এখানে সেটা RestaurantSettings থেকে prop হয়ে আসে, তাই admin-এ
   * সময় বদলালে এই পাতাও সাথে সাথে মেনে চলে।
   */
  useEffect(() => {
    const check = () => {
      const hour = Number.parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date()),
        10
      );
      setIsKitchenOpen(hour >= kitchenOpenHour && hour < kitchenCloseHour);
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [kitchenOpenHour, kitchenCloseHour, timezone]);

  const handleOrder = (item: MenuBrowserItem) => {
    if (!isKitchenOpen) {
      toast.error(
        `Kitchen is closed right now. We're open ${kitchenOpenHour}:00–${kitchenCloseHour}:00.`
      );
      return;
    }
    if (!item.isAvailable) {
      toast.error(`${item.title} isn't available right now.`);
      return;
    }

    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl ?? undefined,
      description: item.description,
    });
    toast.success(`${item.title} added to cart!`);
  };

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
                      <FoodCard
                        key={item.id}
                        item={item}
                        onOrder={() => handleOrder(item)}
                      />
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

/** Figma "Food Card 2" — column, padding 12/12/20, gap 16, radius 30। */
function FoodCard({ item, onOrder }: { item: MenuBrowserItem; onOrder: () => void }) {
  const facts = [
    item.prepTimeMinutes !== null ? `${item.prepTimeMinutes} min` : null,
    item.calories !== null ? `${item.calories} kcal` : null,
    item.fatGrams !== null ? `${item.fatGrams} Fats` : null,
    item.proteinGrams !== null ? `${item.proteinGrams} Protein` : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <article className="flex flex-col gap-4 rounded-[30px] bg-white p-3 pb-5">
      {/* Frame 2147225236: ছবির ঘর, 392×203, radius 24, BG #F9F6F3। */}
      <div className="relative h-[203px] w-full overflow-hidden rounded-[24px] bg-[#F9F6F3]">
        {item.imageUrl ? (
          /**
           * ⚠️ `unoptimized` — ছবি Supabase Storage বা Cloudinary
           * যেকোনোটা থেকে আসতে পারে, আর পুরনো সারিতে অন্য host-ও থেকে
           * যেতে পারে; optimizer-এ গেলে remotePatterns-এ না থাকা host
           * পুরো পাতাটাই 400 দিয়ে ভাঙে।
           */
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 392px, (min-width: 768px) 45vw, 90vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed
              className="h-10 w-10 text-black/15"
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </span>
        )}

        {/* Frame 2147235205: সাদা pill, ছবির উপরে। */}
        <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-black">
          {item.isAvailable ? "Food Available" : "Unavailable"}
        </span>
      </div>

      {/* Frame 2147235266: column, padding 0 12px, gap 20। */}
      <div className="flex flex-1 flex-col justify-between gap-5 px-3">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {/* Frame 2147236014: row, space-between — নাম আর রেটিং। */}
            <div className="flex items-start justify-between gap-5">
              <h4 className="min-w-0 font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
                {item.title}
              </h4>

              {/**
               * ⚠️ রেটিংটা কেবল তখনই, যখন অন্তত একটা অনুমোদিত review
               * আছে। নাহলে Figma-র মতো "4.7" বসিয়ে রাখা মানে একটা
               * সংখ্যা বানিয়ে লেখা, আর খদ্দের সেটার উপর ভরসা করেন।
               */}
              {item.rating !== null && (
                <span className="flex shrink-0 items-center gap-1">
                  <Star
                    className="h-4 w-4 fill-[#FF9540] text-[#FF9540]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="font-frank-ruhl text-[16px] font-normal leading-none text-black">
                    {item.rating.toFixed(1)}
                  </span>
                </span>
              )}
            </div>

            {facts.length > 0 && (
              /* Frame 2147225242: row, gap 6 — `flex-wrap`, কারণ চারটে
                 chip সরু পর্দায় এক সারিতে ধরে না। */
              <div className="flex flex-wrap gap-1.5">
                {facts.map((fact) => (
                  <span key={fact} className={FACT_CHIP}>
                    {fact}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* নকশায় ঘরটা 48px উঁচু = ঠিক দুই লাইন (14px × 170%)। */}
          <p className="line-clamp-2 font-sora text-[14px] font-normal leading-[1.7] text-black/70">
            {item.description}
          </p>
        </div>

        {/* Frame 2147236028: row, space-between — দাম আর বোতাম। */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black xl:text-[24px]">
            {item.priceLabel}
          </span>

          <button
            type="button"
            onClick={onOrder}
            disabled={!item.isAvailable}
            className={`flex h-[46px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-6 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            Order Now
          </button>
        </div>
      </div>
    </article>
  );
}
