import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import OfferHeader from "@/components/menu/OfferHeader";
import FoodCard, { type MenuCardItem } from "@/components/menu/FoodCard";
import MenuComboCta from "@/components/menu/MenuComboCta";

/**
 * ⚠️ প্রতিটা request-এ নতুন করে render — `/menu`-এর মতোই। CI-তে কোনো
 * database নেই, তাই prerender করতে গেলে prisma ECONNREFUSED দিয়ে পুরো
 * build ভেঙে দিত।
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Offer ${decodeURIComponent(code).toUpperCase()}` };
}

/**
 * src/app/(main)/offers/[code]/page.tsx
 *
 * Figma — "Today's Offers"-এর একটা কার্ড চাপলে যে পাতাটা খোলে:
 *
 *   Frame 2147236051   বাঁয়ে "New Here 20% OFF", ডানে "Apply Voucher"
 *   Frame 2147235270   Food Card-এর grid — এই কুপনে যে যে পদ চলে
 *   Frame 2147236006   "Can't Decide? Try Our Chef's Combo Deals" CTA
 *
 * ── route-টা `/offers/<code>`, `/menu/offers/<code>` নয় ─────────────
 *
 * ⚠️ কারণটা routing-এর: `app/(main)/menu/[id]/` ইতিমধ্যেই আছে, তাই
 * `/menu/offers` লিখলে Next সেটাকে `[id] = "offers"` ধরে পদের পাতা
 * খুলতে যেত আর 404 দিত। নিচে একটা static ফোল্ডার বানিয়ে সেটা এড়ানো
 * যেত, কিন্তু ছাড় জিনিসটা মেনুর অংশ নয় — নিজের একটা ঠিকানা পাওয়াই
 * তার প্রাপ্য।
 *
 * ⚠️ কোডটা URL-এ যায়, id নয় — `Coupon.code` `@unique`, আর
 * "/offers/PIZZA20" পড়েই বোঝা যায় কী আছে। কেউ কোড বদলালে পুরনো
 * লিঙ্ক ভাঙবে, কিন্তু ততক্ষণে ওই কুপনটাই আর নেই।
 */
export default async function OfferPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const now = new Date();

  const coupon = await prisma.coupon.findUnique({
    where: { code: decodeURIComponent(code).toUpperCase() },
    select: {
      code: true,
      type: true,
      percentOff: true,
      fixedOff: true,
      minOrderValue: true,
      expiresAt: true,
      startsAt: true,
      isActive: true,
      usageLimit: true,
      usageCount: true,
      restrictedCategories: { select: { id: true, name: true } },
      restrictedItems: { select: { id: true } },
    },
  });

  /**
   * ⚠️ কেবল "আছে কিনা" নয়, "এখন চলছে কিনা"ও দেখা হয় — নাহলে মেয়াদ
   * পেরোনো বা বন্ধ করা কুপনের পুরনো লিঙ্ক থেকে একটা আস্ত ছাড়ের পাতা
   * খুলত, আর খদ্দের checkout-এ গিয়ে জানতেন কোডটা কাজ করে না।
   */
  const isLive =
    coupon !== null &&
    coupon.isActive &&
    (coupon.startsAt === null || coupon.startsAt <= now) &&
    (coupon.expiresAt === null || coupon.expiresAt > now) &&
    (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit);

  if (!coupon || !isLive) notFound();

  const discount =
    coupon.type === "PERCENT" && coupon.percentOff !== null
      ? `${coupon.percentOff}% OFF`
      : coupon.fixedOff !== null
        ? `${formatAmount(Number(coupon.fixedOff).toFixed(units), settings.currency)} OFF`
        : "SPECIAL OFFER";

  const scope =
    coupon.restrictedCategories.length > 0
      ? coupon.restrictedCategories.map((category) => category.name).join(", ")
      : "Every Order";

  /**
   * কোন পদগুলো এই কুপনে চলে।
   *
   * ⚠️ কুপনটা যদি কোনো পদ বা শ্রেণিতে বাঁধা না থাকে, তবে সেটা **সব**
   * পদে চলে — তাই তখন পুরো মেনুটাই দেখানো হয়। "কোনো restriction নেই"
   * মানে "কিছুই চলে না" নয়, উল্টোটা।
   */
  const itemIds = coupon.restrictedItems.map((item) => item.id);
  const categoryIds = coupon.restrictedCategories.map((category) => category.id);
  const isTargeted = itemIds.length > 0 || categoryIds.length > 0;

  const [rows, ratingRows] = await Promise.all([
    prisma.menuItem.findMany({
      where: isTargeted
        ? { OR: [{ id: { in: itemIds } }, { categoryId: { in: categoryIds } }] }
        : {},
      // পাওয়া যাচ্ছে এমনগুলো আগে — বন্ধ পদ দিয়ে পাতা শুরু হলে ছাড়টা
      // কম আকর্ষণীয় লাগত।
      orderBy: [{ isAvailable: "desc" }, { title: "asc" }],
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
    ratingRows.map((row) => [row.menuItemId, row._avg.rating])
  );

  /**
   * ছবির কোণের ব্যাজ।
   *
   * ⚠️ এই পাতার **প্রতিটা** কার্ডেই ব্যাজটা বসে, আর সেটা এখানে সঠিক:
   * পদগুলো এখানে আছেই কারণ ওরা এই ছাড়ে পড়ে। মেনু পাতায় উল্টোটা —
   * ওখানে সাইট-জোড়া কুপনের ব্যাজ দেখানো হয় না, নাহলে প্রতিটা কার্ডে
   * বসে গোলমাল করত।
   */
  const badge =
    coupon.type === "PERCENT" && coupon.percentOff !== null
      ? `${coupon.percentOff}%`
      : coupon.fixedOff !== null
        ? `${formatAmount(Number(coupon.fixedOff).toFixed(units), settings.currency)} Off`
        : null;

  const items: MenuCardItem[] = rows.map((row) => {
    const price = Number(row.price);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price,
      priceLabel: formatAmount(price.toFixed(units), settings.currency),
      imageUrl: row.imageUrl,
      isAvailable: row.isAvailable,
      calories: row.calories,
      fatGrams: row.fatGrams,
      proteinGrams: row.proteinGrams,
      prepTimeMinutes: row.prepTimeMinutes,
      rating: ratingByItem.get(row.id) ?? null,
      discountLabel: badge,
    };
  });

  return (
    <>
      <section className="bg-[#F9F6F3] px-4 py-12 md:px-10 md:py-16 xl:px-20 xl:py-20">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 xl:gap-10">
          <OfferHeader title={`${scope} ${discount}`} code={coupon.code} />

          {coupon.minOrderValue !== null && (
            /* ⚠️ শর্তটা লুকিয়ে রাখা যায় না — খদ্দের ছাড় দেখে অর্ডার
               সাজিয়ে checkout-এ গিয়ে "সর্বনিম্ন $15" জানলে সেটা
               প্রতারণার মতো লাগে। */
            <p className="font-sora text-[13px] leading-[1.6] text-black/70 md:text-[14px]">
              Valid on orders over{" "}
              {formatAmount(
                Number(coupon.minOrderValue).toFixed(units),
                settings.currency
              )}
              . Use code <span className="font-semibold text-black">{coupon.code}</span> at
              checkout.
            </p>
          )}

          {items.length === 0 ? (
            <p className="rounded-[30px] bg-white p-6 font-sora text-[14px] leading-[1.7] text-black/70">
              Nothing is on this offer right now — please check back soon.
            </p>
          ) : (
            /* Frame 2147235270: row, gap 16 — তিনটে করে, তারপর নিচে। */
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <FoodCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/**
       * ⚠️ menu পাতার সাথে একই component — Figma-তেও frame এক
       * (2147236006)। কেবল দুটো জিনিস আলাদা, তাই দুটো prop: এখানে
       * "Download Menu" বোতামটা নেই (নকশায় একটাই বোতাম), আর বর্ণনাটা
       * সামান্য ভিন্ন। কপি করে দ্বিতীয় একটা component বানানোর চেয়ে
       * দুটো prop অনেক সস্তা।
       */}
      <MenuComboCta
        showMenuLink={false}
        description="Save More with Our Curated Combo Meals — Enjoy the Best of Your Favorite Dishes, Perfectly Paired Together for More Flavor, More Variety."
      />
    </>
  );
}
