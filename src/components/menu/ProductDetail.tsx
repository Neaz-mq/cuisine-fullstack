"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Minus, Plus, Star, UtensilsCrossed } from "lucide-react";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";
import { formatAmount } from "@/lib/currency-format";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export type ProductDetailItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  /** এক ইউনিটের দাম, মুদ্রা সহ — server-এ `formatAmount` দিয়ে তৈরি। */
  priceLabel: string;
  /**
   * মুদ্রার ISO কোড ("USD")। সংখ্যা বদলালে মোট দামটা এখানেই হিসাব
   * করতে হয়, তাই কোডটাও লাগে।
   *
   * ⚠️ `lib/currency-format.ts` ইচ্ছাকৃতভাবে Prisma-মুক্ত, তাই client
   * component-এ import করা নিরাপদ — ওই ফাইলের মাথায় সতর্কতাটা লেখা
   * আছে, আর এই প্রজেক্টেই একবার সেটা ভেঙে `next build` থেমেছিল।
   */
  currency: string;
  /** মুদ্রার দশমিক সংখ্যা — RestaurantSettings থেকে। */
  currencyMinorUnits: number;
  images: string[];
  isAvailable: boolean;
  ingredients: string[];
  /** Benefits ঘরের চারটে ঘর — যেগুলোর মান আছে কেবল সেগুলোই। */
  benefits: { label: string; value: string }[];
  rating: number | null;
  reviewCount: number;
};

/**
 * src/components/menu/ProductDetail.tsx
 *
 * Figma "Details card" — row, gap 60, চওড়া 1280:
 *
 *   বাঁয়ে (626)   ছবির ঘর, radius 30, BG #F8F8F8
 *                 উপরে ডানে সাদা "Food Available" pill
 *                 মাঝ-বরাবর দুপাশে ৪০px গোল তীর (বাঁ সাদা, ডান কালো)
 *                 নিচে ছোট ছোট দাগ — কোন ছবিটা চলছে
 *   ডানে (594)    সাদা কার্ড, padding 30, gap 30, radius 20
 *     নাম         Frank Ruhl 600 46px
 *     রেটিং       পাঁচটা তারা + সংখ্যা + "(20 Review)"
 *     বিবরণ       Sora 400 18px/150%, Black/70
 *     দাম + সংখ্যা Frank Ruhl 600 36px · cream stepper (122×50)
 *     Ingredients দুই কলামে, cream বাক্সে, প্রতিটার পাশে টিক
 *     Benefits    চারটে cream ঘর (124.5×73, radius 14)
 *     বোতাম       "Add to Cart" (outline) · "Buy Now" (gradient)
 *
 * ── ছবির slider ─────────────────────────────────────────────────────
 *
 * ⚠️ Figma-তে একাধিক ছবি ধরে নেওয়া, কিন্তু `MenuItem`-এ `imageUrl`
 * একটাই। তাই তীর আর দাগগুলো কেবল তখনই দেখা যায় যখন সত্যিই একাধিক
 * ছবি থাকে — আজ কখনোই নয়। বানানো ২/৩টে ছবি দেখানোর চেয়ে ঘরটা
 * পরিষ্কার রাখাই ভালো, আর কোনোদিন `images String[]` যোগ হলে এই
 * component-এ এক অক্ষরও বদলাতে হবে না: সে `images` array-ই নেয়।
 *
 * ── "Kitchen is closed" আর নেই ──────────────────────────────────────
 *
 * ⚠️ আগে মেনু কার্ডে cart-এ যোগ করার আগে রান্নাঘরের সময় দেখা হতো, আর
 * সেটাই "Kitchen is closed right now" toast দিত। এখন সেটা সরানো —
 * পরীক্ষার সময় প্রতিবার আটকে যাচ্ছিল।
 *
 * ⚠️ কিন্তু জেনে রাখা দরকার: **server-এ এই যাচাইটা নেই**। order তৈরির
 * route (`/api/orders`) রান্নাঘর খোলা কিনা দেখে না, অর্থাৎ এখন রাত
 * তিনটেতেও অর্ডার বসানো যাবে। সত্যিকারের সমাধান হলো ওই route-এ
 * `RestaurantSettings`-এর `kitchenOpenHour`/`kitchenCloseHour` ধরে
 * যাচাই করা — client-এর ছাঁকনি যেকোনো সময় এড়ানো যায়, তাই এটা
 * আসলে ওখানেই থাকা উচিত ছিল।
 */
export default function ProductDetail({ item }: { item: ProductDetailItem }) {
  const router = useRouter();
  const { addToCart } = useCart();

  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  /**
   * ⚠️ দেখানো দামটা **মোট**, এক ইউনিটের নয় — সংখ্যা বাড়ালে দামও বাড়ে।
   *
   * Figma-তে ওখানে স্থির একটা দাম আঁকা, কিন্তু সেটা mockup-এ সংখ্যা
   * ০১ বলেই — এক ইউনিটে দুটো এক জিনিস। বাস্তবে ৩টা বাছার পরেও
   * "$3.00" লেখা থাকলে খদ্দের ভাবতেন দাম বদলায়নি, আর cart-এ গিয়ে
   * $9.00 দেখে অবাক হতেন।
   *
   * এক ইউনিটের দামটা হারায় না — সংখ্যা একের বেশি হলে সেটা নিচে ছোট
   * করে দেখানো হয় ("$3.00 each")।
   */
  const totalLabel =
    quantity > 1
      ? formatAmount(
          (item.price * quantity).toFixed(item.currencyMinorUnits),
          item.currency
        )
      : item.priceLabel;

  const hasImages = item.images.length > 0;
  const hasGallery = item.images.length > 1;

  const step = (direction: 1 | -1) => {
    // ⚠️ `+ length` — JS-এ ঋণাত্মক সংখ্যার `%` ঋণাত্মকই থাকে
    // (`-1 % 3 === -1`), আর সেটা array index হিসেবে `undefined` দিত।
    setImageIndex(
      (prev) => (prev + direction + item.images.length) % item.images.length
    );
  };

  const add = () => {
    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity,
      imageUrl: item.images[0] ?? undefined,
      description: item.description,
    });
  };

  const handleAddToCart = () => {
    add();
    toast.success(`${item.title} added to cart!`);
  };

  const handleBuyNow = () => {
    add();
    // সোজা cart-এ — "Buy Now" মানে খদ্দের আর ঘুরতে চান না।
    router.push("/carts");
  };

  return (
    <section className="bg-[#F9F6F3] px-4 pb-12 pt-6 md:px-10 md:pb-14 xl:px-20 xl:pb-[60px] xl:pt-10">
      {/* Details card: row, gap 60। */}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-stretch xl:gap-[60px]">
        {/* Frame 2147225236 — ছবির ঘর, radius 30, BG #F8F8F8। */}
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-[30px] bg-[#F8F8F8] lg:w-[45%] lg:max-w-[626px]">
          {hasImages ? (
            <Image
              src={item.images[imageIndex]}
              alt={item.title}
              fill
              priority
              sizes="(min-width: 1024px) 626px, 100vw"
              /**
               * ⚠️ `unoptimized` — ছবি Supabase Storage বা Cloudinary
               * যেকোনোটা থেকে আসতে পারে, আর পুরনো সারিতে অন্য host-ও
               * থেকে যেতে পারে; optimizer-এ গেলে remotePatterns-এ না
               * থাকা host পুরো পাতাটাই 400 দিয়ে ভাঙে।
               */
              unoptimized
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed
                className="h-16 w-16 text-black/15"
                strokeWidth={1.2}
                aria-hidden="true"
              />
            </span>
          )}

          {/* Frame 2147235205 — সাদা pill, উপরে ডানে। */}
          <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-black">
            {item.isAvailable ? "Food Available" : "Unavailable"}
          </span>

          {hasGallery && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className={`absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-80 ${FOCUS_RING}`}
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className={`absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-80 ${FOCUS_RING}`}
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </button>

              {/* Frame 2147236403 — ছোট দাগ, gap 2, উচ্চতা 4। */}
              <div className="absolute bottom-4 left-4 flex items-center gap-0.5">
                {item.images.map((image, index) => (
                  <span
                    key={image}
                    aria-hidden="true"
                    className={`h-1 rounded-full transition-all ${
                      index === imageIndex ? "w-6 bg-white" : "w-3 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Frame 2147236127 — সাদা কার্ড, padding 30, gap 30, radius 20। */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px] xl:gap-[30px]">
          <div className="flex flex-col gap-4 xl:gap-5">
            <h1 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[36px] xl:text-[46px]">
              {item.title}
            </h1>

            {/* Frame 2147236118 — বাঁয়ে তারা, ডানে review সংখ্যা। */}
            {item.rating !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((position) => (
                    <Star
                      key={position}
                      className={`h-5 w-5 xl:h-6 xl:w-6 ${
                        // অর্ধেক তারা নেই — ৪.৭ মানে চারটে ভরাট আর
                        // পঞ্চমটা ফাঁকা। ভগ্নাংশটা পাশের সংখ্যাতেই আছে,
                        // তাই আধা-আঁকা তারা বানানোর দরকার পড়ে না।
                        position <= Math.round(item.rating!)
                          ? "fill-[#FF9540] text-[#FF9540]"
                          : "text-black/20"
                      }`}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="ml-1 font-frank-ruhl text-[20px] font-normal leading-none text-black xl:text-[24px]">
                    {item.rating.toFixed(1)}
                  </span>
                </div>

                <span className="font-sora text-[14px] font-normal leading-[1.2] text-black xl:text-[18px]">
                  ({item.reviewCount} {item.reviewCount === 1 ? "Review" : "Reviews"})
                </span>
              </div>
            )}

            <p className="font-sora text-[14px] font-normal leading-[1.5] text-black/70 xl:text-[18px]">
              {item.description}
            </p>

            {/* Frame 2147236130 — দাম আর সংখ্যা বাছাই। */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span
                  /* ⚠️ `aria-live` — সংখ্যা বদলালে screen reader নতুন
                     দামটা পড়ে শোনায়, নাহলে বদলটা কেবল চোখেই ধরা পড়ত। */
                  aria-live="polite"
                  className="font-frank-ruhl text-[28px] font-semibold leading-[1.3] text-black xl:text-[36px]"
                >
                  {totalLabel}
                </span>
                {/**
                 * ⚠️ লাইনটা সবসময় থাকে, কেবল দেখা যায় না — `invisible`,
                 * `{quantity > 1 && …}` নয়।
                 *
                 * শর্ত দিয়ে সরিয়ে দিলে সংখ্যা ১ থেকে ২ হওয়ার মুহূর্তে
                 * ঘরটা ১৫px লম্বা হয়ে যেত, আর তার নিচের সব কিছু —
                 * Ingredients, Benefits, বোতামদুটো — এক ধাক্কায় নেমে
                 * যেত। ডান কার্ড লম্বা হওয়ায় বাঁয়ের ছবিটাও (`items-
                 * stretch`) সাথে সাথে বড় হত, তাই পুরো পাতাটা লাফাত।
                 *
                 * `invisible` জায়গাটা ধরে রাখে কিন্তু আঁকে না, তাই
                 * উচ্চতা স্থির — কিছুই নড়ে না।
                 *
                 * ⚠️ সাথে `aria-hidden`, নাহলে screen reader লুকোনো
                 * লেখাটাও পড়ত ("$3.00 each" যখন সংখ্যা ১, অর্থাৎ
                 * অর্থহীন)।
                 */}
                <span
                  aria-hidden={quantity === 1}
                  className={`font-sora text-[12px] font-normal leading-none text-black/70 ${
                    quantity > 1 ? "" : "invisible"
                  }`}
                >
                  {item.priceLabel} each
                </span>
              </div>

              {/* Frame 2147225266 — cream stepper, 122×50, radius 90। */}
              <div className="flex h-[50px] shrink-0 items-center gap-2.5 rounded-[90px] bg-[#F9F6F3] p-[5px]">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  // ১-এর নিচে নামা যায় না — শূন্য সংখ্যা cart-এ পাঠানোর
                  // কোনো মানে নেই, আর CartContext ওটাকে "মুছে ফেলা"
                  // হিসেবেই ধরত।
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-opacity disabled:opacity-40 ${FOCUS_RING}`}
                >
                  <Minus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>

                <span
                  aria-live="polite"
                  className="min-w-[24px] text-center font-sora text-[12px] leading-none text-black"
                >
                  {String(quantity).padStart(2, "0")}
                </span>

                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  aria-label="Increase quantity"
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-80 ${FOCUS_RING}`}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Frame 2147236122 — Ingredients। */}
          {item.ingredients.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black xl:text-[24px]">
                Ingredients
              </h2>

              {/* Frame 2147236121 — cream বাক্স, padding 16, radius 20,
                  ভেতরে দুই কলাম। */}
              <div className="grid gap-3 rounded-[20px] bg-[#F9F6F3] p-4 min-[480px]:grid-cols-2 xl:gap-[14.6px]">
                {item.ingredients.map((ingredient) => (
                  <span key={ingredient} className="flex items-center gap-2.5">
                    {/**
                     * Figma "tick-circle" — 24×24, ভরাট কমলা বৃত্ত
                     * (#FF9540), ভেতরে সাদা টিক।
                     *
                     * ⚠️ আগে এখানে খালি একটা কমলা টিক ছিল (lucide-এর
                     * `Check`, কোনো বৃত্ত ছাড়া)। নকশায় টিকটা বৃত্তের
                     * **ভেতরে** সাদা — অর্থাৎ বৃত্তটাই আসল আকৃতি,
                     * টিকটা তার ফুটো। lucide-এ ওরকম একটা ভরাট
                     * "tick-circle" নেই (`CircleCheck` আউটলাইন), তাই
                     * বৃত্তটা একটা span দিয়ে আর টিকটা তার ভেতরে।
                     */}
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF9540]"
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 font-sora text-[14px] font-normal leading-[1.6] text-black/70 xl:text-[18px]">
                      {ingredient}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Frame 2147236126 — Benefits। */}
          {item.benefits.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black xl:text-[24px]">
                Benefits
              </h2>

              {/* Inner Card — 124.5×73, radius 14, cream। ৪৮০-এর নিচে
                  দুই কলাম: চারটে পাশাপাশি রাখলে প্রতিটার ভাগে ~৬৫px,
                  আর "459 Kcal" ওখানে আঁটত না। */}
              <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-4">
                {item.benefits.map((benefit) => (
                  <div
                    key={benefit.label}
                    className="flex h-[73px] flex-col items-center justify-center gap-2 rounded-[14px] bg-[#F9F6F3] px-3"
                  >
                    <span className="font-sora text-[12px] font-normal leading-[1.2] text-black/70">
                      {benefit.label}
                    </span>
                    <span className="font-sora text-[14px] font-semibold leading-[1.2] text-black xl:text-[16px]">
                      {benefit.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frame 2147236129 — দুটো বোতাম, gap 8, দুটোই সমান ভাগে। */}
          <div className="mt-auto flex flex-col gap-2 min-[480px]:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!item.isAvailable}
              className={`flex h-[46px] flex-1 items-center justify-center rounded-[90px] border border-black px-5 font-sora text-[16px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-black ${FOCUS_RING}`}
            >
              Add to Cart
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!item.isAvailable}
              className={`flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
