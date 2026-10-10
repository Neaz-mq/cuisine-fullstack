/**
 * src/lib/menu-highlights.ts
 *
 * /menu-র "Chef's Picks" section-এর তিনটে তালিকা।
 *
 * ⚠️ কোনো নতুন database query নেই। menu/page.tsx যে `categories` আগেই বানায়
 * (দাম অফার-সহ, গড় রেটিং, রান্নার সময়, প্রোটিন) সেটাই এখানে ঢোকে — তাই
 * "Chef's Picks"-এ যা দেখায় তা মেনু-তালিকার সাথে হুবহু মেলে, আর পাতাটা
 * আগের চেয়ে একটা query কম চালায় (আগের `getSignatureDishes()` বাদ)।
 *
 * নিয়ম:
 *   • কেবল **পাওয়া যাচ্ছে** (isAvailable) এমন পদ।
 *   • Guest Favorites — অনুমোদিত review-র গড় রেটিং ≥ 4.0, বেশি আগে।
 *   • Ready in a Flash — রান্নার সময় কম আগে (সময় জানা থাকলে)।
 *   • Protein Packed — প্রোটিন বেশি আগে (০-র বেশি হলে)।
 *   • একটা পদ তিন তালিকার মধ্যে একবারই আসে (Favorites → Flash → Protein
 *     ক্রমে আগে যে নেয়), নাহলে একই ছবি তিন কার্ডে দেখাত।
 *   • তথ্য না থাকলে (null) পদটা ওই তালিকায় যায় না — বানানো মান নেই।
 *   • কোনো তালিকা খালি হলে সেটা বাদ; সব খালি হলে section-ই দেখা যায় না।
 */

export type HighlightKey = "favorites" | "quick" | "protein";

/** MenuBrowserItem-এর যে মাঠগুলো লাগে — কাঠামোগতভাবে মেলে, তাই সরাসরি পাঠানো যায়। */
export type HighlightSourceItem = {
  id: string;
  title: string;
  priceLabel: string;
  oldPriceLabel?: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  proteinGrams: number | null;
  prepTimeMinutes: number | null;
  rating: number | null;
};

export type HighlightDish = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceLabel: string;
  oldPriceLabel: string | null;
  /** চিপে যা লেখা হবে — "4.8", "15 min", "40 g protein"। */
  metric: string;
  href: string;
};

export type HighlightGroup = {
  key: HighlightKey;
  dishes: HighlightDish[];
};

/** "Guest Favorites"-এ ঢোকার নিম্নতম গড় রেটিং। */
export const MIN_FAVORITE_RATING = 4;

const round1 = (value: number) => Math.round(value * 10) / 10;

const byName = (a: HighlightSourceItem, b: HighlightSourceItem) =>
  a.title.localeCompare(b.title);

export function buildMenuHighlights(
  categories: { items: HighlightSourceItem[] }[],
  perGroup = 3
): HighlightGroup[] {
  const available = categories
    .flatMap((category) => category.items)
    .filter((item) => item.isAvailable);

  const used = new Set<string>();

  const pick = (
    candidates: HighlightSourceItem[],
    metric: (item: HighlightSourceItem) => string
  ): HighlightDish[] => {
    const dishes: HighlightDish[] = [];
    for (const item of candidates) {
      if (dishes.length >= perGroup) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      dishes.push({
        id: item.id,
        name: item.title,
        imageUrl: item.imageUrl,
        priceLabel: item.priceLabel,
        oldPriceLabel: item.oldPriceLabel ?? null,
        metric: metric(item),
        href: `/menu/${item.id}`,
      });
    }
    return dishes;
  };

  const favorites = pick(
    available
      .filter((item) => item.rating !== null && item.rating >= MIN_FAVORITE_RATING)
      .sort((a, b) => (b.rating as number) - (a.rating as number) || byName(a, b)),
    (item) => (item.rating as number).toFixed(1)
  );

  const quick = pick(
    available
      .filter((item) => item.prepTimeMinutes !== null && item.prepTimeMinutes > 0)
      .sort(
        (a, b) =>
          (a.prepTimeMinutes as number) - (b.prepTimeMinutes as number) || byName(a, b)
      ),
    (item) => `${item.prepTimeMinutes} min`
  );

  const protein = pick(
    available
      .filter((item) => item.proteinGrams !== null && item.proteinGrams > 0)
      .sort(
        (a, b) => (b.proteinGrams as number) - (a.proteinGrams as number) || byName(a, b)
      ),
    (item) => `${round1(item.proteinGrams as number)} g protein`
  );

  return [
    { key: "favorites" as const, dishes: favorites },
    { key: "quick" as const, dishes: quick },
    { key: "protein" as const, dishes: protein },
  ].filter((group) => group.dishes.length > 0);
}