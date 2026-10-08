import { prisma } from "@/lib/prisma";
import type { SignatureDish } from "@/lib/landing-content";

/**
 * src/lib/signature-dishes.ts
 *
 * হোমপেজ আর /menu-র "Our Signature" তিনটে কার্ড — সরাসরি database থেকে।
 *
 * নিয়ম:
 *   • শ্রেণি: মেনুর ক্রমে (sortOrder, তারপর নাম) প্রথম তিনটে শ্রেণি, যেগুলোতে
 *     অন্তত একটা **পাওয়া যাচ্ছে** (isAvailable) এমন পদ আছে। প্রতিটা শ্রেণি
 *     থেকে ঠিক একটা কার্ড, তাই তিনটে কার্ড = তিনটে আলাদা শ্রেণি।
 *   • শ্রেণির ভেতরে কোন পদ: ছবি আছে এমনটা আগে → অনুমোদিত review-র গড়
 *     রেটিং বেশি → review বেশি → নাম।
 *   • কার্ডের প্রতিটা লেখা DB-র মান। null মান মানে ঘরটা বাদ — "0 kcal"
 *     বা বানানো রেটিং দেখানো হয় না।
 */

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function getSignatureDishes(limit = 3): Promise<SignatureDish[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      menuItems: {
        where: { isAvailable: true },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          calories: true,
          fatGrams: true,
          proteinGrams: true,
          prepTimeMinutes: true,
        },
      },
    },
  });

  const candidateIds = categories.flatMap((category) =>
    category.menuItems.map((item) => item.id)
  );
  if (candidateIds.length === 0) return [];

  // রেটিং: শুধু APPROVED review, DB-তেই গড় (menu/page.tsx-এর মতো)।
  const ratingRows = await prisma.review.groupBy({
    by: ["menuItemId"],
    where: { status: "APPROVED", menuItemId: { in: candidateIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingByItem = new Map(
    ratingRows.map((row) => [
      row.menuItemId,
      { average: row._avg.rating, count: row._count._all },
    ])
  );

  const dishes: SignatureDish[] = [];

  for (const category of categories) {
    if (dishes.length >= limit) break;
    if (category.menuItems.length === 0) continue;

    const best = [...category.menuItems].sort((a, b) => {
      const aImage = a.imageUrl ? 1 : 0;
      const bImage = b.imageUrl ? 1 : 0;
      if (aImage !== bImage) return bImage - aImage;

      const aRating = ratingByItem.get(a.id);
      const bRating = ratingByItem.get(b.id);
      const aAvg = aRating?.average ?? -1;
      const bAvg = bRating?.average ?? -1;
      if (aAvg !== bAvg) return bAvg - aAvg;

      const aCount = aRating?.count ?? 0;
      const bCount = bRating?.count ?? 0;
      if (aCount !== bCount) return bCount - aCount;

      return a.title.localeCompare(b.title);
    })[0];

    const rating = ratingByItem.get(best.id)?.average ?? null;

    dishes.push({
      id: best.id,
      name: best.title,
      rating: rating === null ? null : rating.toFixed(1),
      // FoodCard.tsx-র সাথে একই লেখা, যাতে একই পদ দুই জায়গায় দুই রকম না দেখায়।
      chips: [
        best.prepTimeMinutes !== null ? `${best.prepTimeMinutes} min` : null,
        best.calories !== null ? `${best.calories} kcal` : null,
        best.fatGrams !== null ? `${round1(best.fatGrams)} Fats` : null,
        best.proteinGrams !== null ? `${round1(best.proteinGrams)} Protein` : null,
      ].filter((chip): chip is string => chip !== null),
      description: best.description,
      image: best.imageUrl,
      href: `/menu/${best.id}`,
    });
  }

  return dishes;
}