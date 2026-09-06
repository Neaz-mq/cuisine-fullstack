import Image from "next/image";
import { UserRound } from "lucide-react";

export type FeedbackCard = {
  id: string;
  /** বড় সংখ্যাটা — "98%", "4.7"। */
  stat: string;
  /** সংখ্যার নিচের ছোট লেখা — "Guest Satisfaction"। */
  statLabel: string;
  quote: string;
  authorName: string;
  authorRole: string;
  authorImage: string | null;
};

/**
 * src/components/menu/CustomerFeedback.tsx
 *
 * Figma Frame 2147235871 — "Our Costumers Feedback": column, padding
 * 100px 80px, gap 40, পটভূমি সাদা।
 *
 *   Frame 2147235980  row, gap 26 — বাঁয়ে একটা Feedback কার্ড, মাঝে
 *                     একটা ছবি (488×479, radius 20), ডানে আরেকটা কার্ড
 *   Feedback          column, space-between, padding 30px 18px,
 *                     370×479, BG #F9F6F3, radius 30
 *     সংখ্যা          Frank Ruhl 500 64px
 *     ছোট লেখা        Sora 400 14px/160%, Black/70
 *     উদ্ধৃতি         Sora 400 18px/160%, কালো
 *     নিচে            48px গোল ছবি + নাম (Frank Ruhl 500 20px) +
 *                     ভূমিকা (Sora 400 14px, Black/70)
 *
 * ── লেখাগুলো সত্যি, বানানো নয় ──────────────────────────────────────
 *
 * ⚠️ Figma-তে দুটো কার্ডে দুটো testimonial আর দুটো পরিসংখ্যান
 * ("98% Guest Satisfaction", "2x Faster Delivery")। প্রথমটা `Review`
 * থেকে সত্যিই বার করা যায়, দ্বিতীয়টা যায় না — delivery-র গতি মাপার
 * কোনো ভিত্তি এই অ্যাপে নেই।
 *
 * তাই দুটোই review থেকে: একটায় সন্তুষ্টির হার (৪ বা ৫ তারা দেওয়া
 * review-এর শতাংশ), অন্যটায় গড় রেটিং। "2x Faster Delivery" লিখে
 * রাখলে সেটা একটা দাবি হতো, আর তার পেছনে কোনো সংখ্যা থাকত না।
 *
 * ⚠️ দুটোর কম অনুমোদিত review থাকলে পুরো section-টাই দেখা যায় না।
 * একটা মাত্র মতামত নিয়ে "Our Costumers Feedback" শিরোনাম দেওয়াটা
 * সৎ নয়, আর খালি কার্ড তার চেয়েও খারাপ।
 */
export default function CustomerFeedback({
  cards,
  centerImage,
}: {
  cards: FeedbackCard[];
  /** মাঝের বড় ছবিটা — না থাকলে ঘরটাই বাদ পড়ে। */
  centerImage: string | null;
}) {
  if (cards.length < 2) return null;

  const [first, second] = cards;

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-10">
        <h2 className="font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[34px] xl:text-[40px]">
          Our Customers Feedback
        </h2>

        {/**
         * Frame 2147235980: row, gap 26 — কার্ড · ছবি · কার্ড।
         *
         * ⚠️ ১০২৪-এর নিচে এক কলাম, আর ছবিটা **মাঝখান থেকে সরে দুইয়ের
         * পরে** যায় (`order-3`)। ছবিটা মাঝে রেখে দিলে মোবাইলে দুটো
         * মতামতের মাঝখানে ৪৭৯px উঁচু একটা ছবি বসত, আর দ্বিতীয় মতামতটা
         * প্রায় কেউ দেখত না।
         */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,370fr)_minmax(0,488fr)_minmax(0,370fr)] xl:gap-[26px]">
          <FeedbackTile card={first} />

          {centerImage && (
            <div className="relative order-3 h-[280px] overflow-hidden rounded-[20px] bg-[#F9F6F3] md:h-[380px] lg:order-none lg:h-auto">
              <Image
                src={centerImage}
                alt=""
                fill
                sizes="(min-width: 1024px) 488px, 100vw"
                unoptimized
                className="object-cover"
              />
            </div>
          )}

          <FeedbackTile card={second} />
        </div>
      </div>
    </section>
  );
}

function FeedbackTile({ card }: { card: FeedbackCard }) {
  return (
    <article className="flex flex-col justify-between gap-8 rounded-[30px] bg-[#F9F6F3] px-[18px] py-[30px]">
      <div className="flex flex-col gap-6 xl:gap-9">
        <div className="flex flex-col gap-2">
          <p className="font-frank-ruhl text-[44px] font-medium leading-[1.14] tracking-[-0.01em] text-black xl:text-[64px]">
            {card.stat}
          </p>
          <p className="font-sora text-[14px] font-normal leading-[1.6] text-black/70">
            {card.statLabel}
          </p>
        </div>

        {/* ⚠️ উদ্ধৃতি-চিহ্নদুটো এখানে বসানো, ডেটায় নয় — খদ্দের review
            লেখার সময় নিজে উদ্ধৃতি দেন না, আর দিলে দুবার বসত। */}
        <blockquote className="font-sora text-[15px] font-normal leading-[1.6] text-black xl:text-[18px]">
          &ldquo;{card.quote}&rdquo;
        </blockquote>
      </div>

      {/* Frame 2147235976: row, gap 12 — ছবি + নাম। */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          {card.authorImage ? (
            <Image
              src={card.authorImage}
              alt=""
              fill
              sizes="48px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <UserRound className="h-5 w-5 text-black/30" strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate font-frank-ruhl text-[18px] font-medium leading-[1.3] text-black xl:text-[20px]">
            {card.authorName}
          </p>
          <p className="truncate font-sora text-[13px] font-normal leading-none text-black/70 xl:text-[14px]">
            {card.authorRole}
          </p>
        </div>
      </div>
    </article>
  );
}
