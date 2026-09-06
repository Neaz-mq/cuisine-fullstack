/**
 * src/components/menu/TodaysOffers.tsx
 *
 * Figma Frame 2147236007 — "Today's Offers": column, padding 100px 80px,
 * gap 30, পটভূমি সাদা।
 *
 *   Frame 2147236051  row, space-between — শিরোনাম (Frank Ruhl 600
 *                     40px) আর "Valid till stock lasts" (Sora 400 20px,
 *                     Black/70)
 *   Frame 2147236052  row, gap 16 — তিনটে Offer Card
 *
 *   Offer Card        column, space-between, padding 28, radius 30,
 *                     416×269; রঙ তিনটে: #FF9540 · #6DCB66 · #AE80FF
 *     উপরের সারি      নাম (Frank Ruhl 400 24px সাদা) + কোড-pill
 *                     (1px dashed সাদা, radius 100, padding 8/12)
 *     নিচের অংশ       শিরোনাম (Frank Ruhl 500 24px সাদা) + বিবরণ
 *                     (Sora 400 14px/170%, White/70)
 *
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
 * শব্দ সত্যি: "20% Off Your Order", "Use code WELCOME20 at checkout on
 * orders over $15. Ends 12 Sep."
 *
 * marketing copy সত্যিই দরকার হলে ওই দুটো কলাম + form-এর ঘর একসাথে
 * যোগ করতে হবে — একটা ছাড়া অন্যটার কোনো মানে নেই।
 *
 * ⚠️ কোনো চালু কুপন না থাকলে পুরো section-টাই দেখা যায় না। খালি
 * "Today's Offers" শিরোনামের নিচে তিনটে ফাঁকা রঙিন বাক্স তার চেয়ে
 * অনেক খারাপ দেখাত।
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
 * Figma-র তিনটে রঙ, ক্রম অনুযায়ী। তিনটের বেশি কুপন এলে আবার প্রথম
 * থেকে ঘোরে — designer তিনটেই এঁকেছেন, কিন্তু কুপনের সংখ্যা তো
 * নকশার হাতে নয়।
 */
const CARD_COLORS = ["#FF9540", "#6DCB66", "#AE80FF"];

export default function TodaysOffers({ offers }: { offers: MenuOffer[] }) {
  if (offers.length === 0) return null;

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 xl:gap-[30px]">
        {/* Frame 2147236051: row, space-between, gap 60। */}
        <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between min-[560px]:gap-[60px]">
          <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[34px] xl:text-[40px]">
            Today&apos;s Offers
          </h2>
          <p className="font-sora text-[14px] font-normal leading-[1.14] tracking-[-0.01em] text-black/70 md:text-[16px] xl:text-[20px]">
            Valid till stock lasts
          </p>
        </div>

        {/* Frame 2147236052: row, gap 16 — ছোট পর্দায় এক কলাম। */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer, index) => (
            <article
              key={offer.id}
              style={{ backgroundColor: CARD_COLORS[index % CARD_COLORS.length] }}
              className="relative flex min-h-[240px] flex-col justify-between gap-10 overflow-hidden rounded-[30px] p-6 xl:min-h-[269px] xl:p-7"
            >
              {/**
               * Vector 7957 — Figma-র হালকা ঢেউ (একটা path, 20px সাদা
               * stroke, opacity 0.06)।
               *
               * ⚠️ আগে এটা `rounded-[50%] border-[20px]` দিয়ে করা ছিল —
               * একটা চ্যাপ্টা ellipse-এর কেবল border। কিন্তু ellipse-এর
               * border মানে **বন্ধ একটা ঘের**, তাই কার্ডে উপরে-নিচে
               * দুটো আলাদা রেখা দেখা যেত। Figma-তে ওটা একটাই খোলা
               * রেখা। SVG path ছাড়া সেটা CSS-এ পাওয়া যায় না।
               *
               * ⚠️ `preserveAspectRatio="none"` + `inset-0` — ঢেউটা
               * কার্ডের সাথে টেনে বসে, স্থির px মাপে নয়। তিনটে কার্ড
               * সমান চওড়া, তাই তিনটেতেই ঢেউটা ঠিক একই উচ্চতায় ঢোকে ও
               * বেরোয় — চোখে একটানা একটা রেখা বলে মনে হয়, যেটাই
               * নকশায় দেখতে পাওয়া যায়। স্থির px হলে সরু পর্দায়
               * কার্ডগুলো ছোট হয়ে যেত আর মিল ভেঙে পড়ত।
               *
               * ⚠️ `aria-hidden` আর `pointer-events-none` — নাহলে
               * screen reader-এ একটা অর্থহীন উপাদান পড়ত আর মাউস
               * লেখাগুলোর উপরে ধরত না।
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
                <h3 className="min-w-0 font-frank-ruhl text-[20px] font-normal leading-[1.3] text-white xl:text-[24px]">
                  {offer.eyebrow}
                </h3>
                {/* Frame 2147235205: dashed pill, ভেতরে কোডটা। */}
                <span className="shrink-0 rounded-full border border-dashed border-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-white">
                  {offer.code}
                </span>
              </div>

              {/**
               * Frame 2147235266: column, gap 20, উচ্চতা 99 —
               * শিরোনাম 31 + ফাঁক 20 + বিবরণ 48।
               *
               * ⚠️ দুটো মাপ স্থির করে দেওয়া হয়েছে, আর সেটাই এখানকার
               * পুরো কথা। কার্ডগুলো grid-এ সমান উঁচু হয় ঠিকই, কিন্তু
               * নিচের ব্লকটার **নিজের** উচ্চতা লেখার উপর নির্ভর করত:
               * এক কার্ডে বিবরণ এক লাইন, আরেকটায় দুই — তাই শিরোনাম
               * তিনটে তিন উচ্চতায় বসত।
               *
               * শিরোনাম এক লাইনে বাঁধা (`line-clamp-1`) আর বিবরণের ঘর
               * সবসময় দুই লাইন সমান উঁচু (`min-h`), তাই তিনটে কার্ডে
               * দুটোই এক সরলরেখায় — নকশায় যেমন।
               */}
              <div className="relative flex flex-col gap-4 xl:gap-5">
                <p className="line-clamp-1 font-frank-ruhl text-[20px] font-medium leading-[1.3] text-white xl:text-[24px]">
                  {offer.headline}
                </p>
                <p className="line-clamp-2 min-h-[44px] font-sora text-[13px] font-normal leading-[1.7] text-white/70 xl:min-h-[48px] xl:text-[14px]">
                  {offer.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
