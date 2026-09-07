import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import ProductDetail, { type ProductDetailItem } from "@/components/menu/ProductDetail";
import CustomerFeedback, { type FeedbackCard } from "@/components/menu/CustomerFeedback";
import { MoreOptions, FullMenuCta } from "@/components/menu/MoreOptions";
import { type MenuCardItem } from "@/components/menu/FoodCard";

/**
 * ⚠️ প্রতিটা request-এ নতুন করে render, build-এর সময় নয় — `/menu`-এর
 * মতোই। CI-তে (GitHub Actions) কোনো database নেই, তাই prerender করতে
 * গেলে prisma ECONNREFUSED দিয়ে পুরো build ভেঙে দিত।
 *
 * `generateStaticParams` দিয়েও পথ ছিল না: সেটাও build-এর সময় DB-তে
 * গিয়ে id-গুলো আনতে চাইত।
 */
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 *  ⚠️  অস্থায়ী নমুনা-ডেটা — সত্যিকারের review এলে **মুছে ফেলতে হবে**
 * ─────────────────────────────────────────────────────────────────────
 *
 * এই দুটো ধ্রুবক নকশাটা ভরাট দেখানোর জন্য, আর এই মুহূর্তে ডেটাবেসে
 * অনুমোদিত কোনো review নেই বলেই এদের দরকার। এগুলো **কেবল তখনই** কাজে
 * লাগে যখন সত্যিকারের review শূন্য — একটাও এলে কোড নিজে থেকেই আসলটা
 * দেখাতে শুরু করে, এখানে হাত দিতে হয় না।
 *
 * ⚠️ কিন্তু বানানো রেটিং আর মতামত পর্দায় থাকা মানে খদ্দেরকে ভুল তথ্য
 * দেখানো। কয়েকটা সত্যি review জমা হলে দুটো ধ্রুবকই মুছে দেবেন, আর
 * নিচের `?? PLACEHOLDER_*` অংশগুলোও — তখন review না থাকলে ঘরগুলো
 * এমনিতেই বাদ পড়বে, যেটাই সঠিক আচরণ।
 *
 * খোঁজার সুবিধার জন্য: এই ফাইলে `PLACEHOLDER` শব্দটা grep করলেই
 * সবগুলো জায়গা এক সাথে পাওয়া যাবে।
 */
const PLACEHOLDER_RATING = { rating: 4.7, reviewCount: 20 };

/**
 * Feedback অংশের মাঝের ছবিটা।
 *
 * ⚠️ আগে এখানে পদটার নিজের ছবি বসানো ছিল, ফলে বার্গারের পাতায় তিনটে
 * ঘরের মাঝখানে সেই একই বার্গার — অর্থাৎ ছবিটা কিছুই যোগ করত না।
 * নকশায় ওখানে খদ্দেরদের খেতে বসার একটা ছবি, কিন্তু ওরকম কোনো ছবি
 * এই অ্যাপের ডেটায় নেই (`Review`-তে ছবির মাঠ নেই)।
 *
 * তাই আপাতত একটা স্থির ছবি। কোনোদিন সত্যিকারের ছবি এলে (settings-এ
 * একটা মাঠ, বা review-র সাথে ছবি) কেবল এই লাইনটাই বদলাবে।
 */
const PLACEHOLDER_FEEDBACK_IMAGE =
  "https://res.cloudinary.com/dzi3u164c/image/upload/v1787501234/e07f2ff3501ab463298a1af3cfd6da761f10b803_xkhcwx.webp";

const PLACEHOLDER_FEEDBACK: FeedbackCard[] = [
  {
    id: "placeholder-1",
    stat: "98%",
    statLabel: "Guest Satisfaction",
    quote:
      "The seasonal menu completely redefined what fresh dining means to us. Every single dish feels deeply intentional, bursting with authentic flavors that keep us coming back every week.",
    authorName: "Ridoy Ahmed",
    authorRole: "Regular Guest",
    authorImage: null,
  },
  {
    id: "placeholder-2",
    stat: "2x",
    statLabel: "Faster Delivery",
    quote:
      "Getting my Friday night gourmet burgers used to take an hour of waiting. Now, I access piping hot, restaurant-quality food in half the time.",
    authorName: "Elena Rostova",
    authorRole: "Weekend Diner",
    authorImage: null,
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.menuItem.findUnique({
    where: { id },
    select: { title: true, description: true },
  });

  if (!item) return { title: "Menu" };
  return { title: item.title, description: item.description };
}

/**
 * src/app/(main)/menu/[id]/page.tsx
 *
 * Figma-র পদ-বিস্তারিত পাতা — চারটে অংশ, উপর থেকে নিচে:
 *
 *   1. Details card    #F9F6F3 — বাঁয়ে ছবি, ডানে নাম/দাম/উপকরণ/বোতাম
 *   2. Feedback        সাদা — দুটো মতামত-কার্ড, মাঝে একটা ছবি
 *   3. More Options    #F9F6F3 — একই শ্রেণির তিনটে Food Card
 *   4. Full Menu CTA   সাদা — শিরোনাম + "View Full Menu"
 *
 * উপরের কালো পটি, navbar আর Footer `(main)/layout.tsx`-এ — সব পাতায়
 * এক, তাই এখানে নেই।
 *
 * ⚠️ Food Card-টা `components/menu/FoodCard.tsx` থেকে, মেনু পাতার
 * হুবহু একই component — কপি নয়।
 */
export default async function MenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;

  const item = await prisma.menuItem.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      isAvailable: true,
      calories: true,
      fatGrams: true,
      proteinGrams: true,
      carbGrams: true,
      prepTimeMinutes: true,
      ingredientTags: true,
      categoryId: true,
    },
  });

  // ⚠️ `notFound()`, নিজের হাতে একটা "পাওয়া যায়নি" ব্লক নয় — এতে
  // সত্যিকারের 404 status যায়, আর search engine ভুল করে পাতাটা
  // index করে রাখে না।
  if (!item) notFound();

  /**
   * ⚠️ তিনটে query একসাথে (`Promise.all`), পরপর নয় — কোনোটা অন্যটার
   * ফলের উপর নির্ভর করে না, তাই ধারাবাহিকভাবে চালালে শুধু অপেক্ষার
   * সময়টাই যোগ হতো।
   */
  const [reviews, siblings, siblingRatings] = await Promise.all([
    prisma.review.findMany({
      where: { menuItemId: id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        user: { select: { name: true, image: true } },
      },
    }),

    prisma.menuItem.findMany({
      // একই শ্রেণির অন্য পদ — নিজেকে বাদ দিয়ে।
      where: { categoryId: item.categoryId, id: { not: id } },
      orderBy: [{ isAvailable: "desc" }, { title: "asc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        calories: true,
        fatGrams: true,
        proteinGrams: true,
        prepTimeMinutes: true,
      },
    }),

    prisma.review.groupBy({
      by: ["menuItemId"],
      where: { status: "APPROVED" },
      _avg: { rating: true },
    }),
  ]);

  const ratingByItem = new Map(
    siblingRatings.map((row) => [row.menuItemId, row._avg.rating])
  );

  const price = Number(item.price);

  /**
   * Benefits ঘরের চারটে ঘর।
   *
   * ⚠️ যেগুলোর মান আছে কেবল সেগুলোই — Add Item modal-এ ঘরগুলো ঐচ্ছিক,
   * তাই পুরনো পদে প্রায়ই ফাঁকা। "0 Kcal" লেখা মানে "এই খাবারে ক্যালরি
   * নেই" দাবি করা, আর সেটা প্রায় কখনোই সত্যি নয়।
   */
  const benefits = [
    item.calories !== null ? { label: "Energy", value: `${item.calories} Kcal` } : null,
    item.carbGrams !== null ? { label: "Carbs", value: `${item.carbGrams} gm` } : null,
    item.fatGrams !== null ? { label: "Fats", value: `${item.fatGrams} gm` } : null,
    item.proteinGrams !== null
      ? { label: "Protein", value: `${item.proteinGrams} gm` }
      : null,
  ].filter((benefit): benefit is { label: string; value: string } => benefit !== null);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  const detail: ProductDetailItem = {
    id: item.id,
    title: item.title,
    description: item.description,
    price,
    priceLabel: formatAmount(price.toFixed(units), settings.currency),
    // সংখ্যা বদলালে মোট দামটা client-এ হিসাব হয়, তাই মুদ্রার কোড আর
    // দশমিক সংখ্যা দুটোই পাঠাতে হয় — ProductDetail-এ বিস্তারিত।
    currency: settings.currency,
    currencyMinorUnits: units,
    /**
     * ⚠️ `MenuItem`-এ ছবি একটাই (`imageUrl`), তাই array-টায় শূন্য বা
     * একটা সদস্য থাকে। ProductDetail একাধিক ছবি সামলাতে পারে, তাই
     * কোনোদিন `images String[]` যোগ হলে কেবল এই লাইনটাই বদলাবে।
     */
    images: item.imageUrl ? [item.imageUrl] : [],
    isAvailable: item.isAvailable,
    ingredients: item.ingredientTags,
    benefits,
    // ⚠️ PLACEHOLDER — সত্যিকারের review এলে ডান দিকটা নিজে থেকেই
    // ব্যবহার হবে; উপরের মন্তব্য দ্রষ্টব্য।
    rating: averageRating ?? PLACEHOLDER_RATING.rating,
    reviewCount: reviews.length > 0 ? reviews.length : PLACEHOLDER_RATING.reviewCount,
  };

  const related: MenuCardItem[] = siblings.map((sibling) => {
    const siblingPrice = Number(sibling.price);
    return {
      id: sibling.id,
      title: sibling.title,
      description: sibling.description,
      price: siblingPrice,
      priceLabel: formatAmount(siblingPrice.toFixed(units), settings.currency),
      imageUrl: sibling.imageUrl,
      isAvailable: sibling.isAvailable,
      calories: sibling.calories,
      fatGrams: sibling.fatGrams,
      proteinGrams: sibling.proteinGrams,
      prepTimeMinutes: sibling.prepTimeMinutes,
      rating: ratingByItem.get(sibling.id) ?? null,
      /**
       * ⚠️ এই পাতায় ছাড়ের ব্যাজ দেখানো হয় না। মেনু পাতায় ওটা চালু
       * কুপন থেকে হিসাব হয় (`discountFor`), আর সেই হিসাবটা এখানে
       * আবার করতে গেলে আরেকটা coupon query লাগত — তিনটে কার্ডের
       * জন্য যেটা বাড়াবাড়ি।
       */
      discountLabel: null,
    };
  });

  /**
   * মতামত-কার্ড দুটো — দুটোই **সত্যি review** থেকে।
   *
   * ⚠️ Figma-তে দ্বিতীয় কার্ডে "2x Faster Delivery" লেখা, কিন্তু
   * delivery-র গতি মাপার কোনো ভিত্তি এই অ্যাপে নেই। তাই দুটো এমন
   * সংখ্যা নেওয়া হলো যা সত্যিই হিসাব করা যায়: সন্তুষ্টির হার (৪ বা ৫
   * তারা দেওয়া review-এর শতাংশ) আর গড় রেটিং।
   */
  const happyCount = reviews.filter((review) => review.rating >= 4).length;
  const satisfaction =
    reviews.length > 0 ? Math.round((happyCount / reviews.length) * 100) : 0;

  const quoted = reviews.filter((review) => review.comment && review.comment.trim());

  const realFeedback: FeedbackCard[] = quoted.slice(0, 2).map((review, index) => ({
    id: review.id,
    stat: index === 0 ? `${satisfaction}%` : (averageRating ?? 0).toFixed(1),
    statLabel: index === 0 ? "Guest Satisfaction" : "Average Rating",
    quote: review.comment!.trim(),
    authorName: review.user.name ?? "Guest",
    // ⚠️ ভূমিকাটা বানানো নয়, review-এর নিজের রেটিং — "5 star review"
    // পড়লে বোঝা যায় মানুষটা কতটা খুশি ছিলেন।
    authorRole: `${review.rating} star review`,
    authorImage: review.user.image,
  }));

  // ⚠️ PLACEHOLDER — দুটোর কম সত্যিকারের মতামত থাকলে নমুনা দুটো।
  const feedbackCards =
    realFeedback.length >= 2 ? realFeedback : PLACEHOLDER_FEEDBACK;

  return (
    <>
      <ProductDetail item={detail} />
      {/* ⚠️ PLACEHOLDER — মাঝের ছবিটা স্থির; উপরের মন্তব্য দ্রষ্টব্য। */}
      <CustomerFeedback cards={feedbackCards} centerImage={PLACEHOLDER_FEEDBACK_IMAGE} />
      <MoreOptions items={related} />
      <FullMenuCta />
    </>
  );
}
