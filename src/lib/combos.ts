import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { findLiveOffers } from "@/lib/product-offers";
import {
  HOME_COMBO_LIMIT,
  comboChips,
  comboIncludes,
  pooledRating,
  priceCombo,
  type ComboComponent,
  type ComboDeal,
} from "@/lib/combo-pricing";

/**
 * src/lib/combos.ts
 *
 * Home page "Combo Deals" cards, from the database.
 *
 * A combo is shown only if every component exists and is currently available —
 * checkout rejects unavailable items, so a card whose "Order Now" can't be
 * completed is worse than no card. Inactive combos are hidden the same way.
 */
export async function getHomeCombos(limit = HOME_COMBO_LIMIT): Promise<ComboDeal[]> {
  const rows = await prisma.combo.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      discountPercent: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          quantity: true,
          menuItem: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              isAvailable: true,
              calories: true,
              fatGrams: true,
              proteinGrams: true,
              prepTimeMinutes: true,
            },
          },
        },
      },
    },
  });

  const combos = rows
    .filter((row) => row.items.length > 0 && row.items.every((i) => i.menuItem.isAvailable))
    .slice(0, limit);
  if (combos.length === 0) return [];

  const itemIds = [...new Set(combos.flatMap((c) => c.items.map((i) => i.menuItem.id)))];

  const [settings, offers, ratingRows, session] = await Promise.all([
    getRestaurantSettings(),
    findLiveOffers(itemIds, new Date()),
    prisma.review.groupBy({
      by: ["menuItemId"],
      where: { status: "APPROVED", menuItemId: { in: itemIds } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    auth(),
  ]);
  const isMember = Boolean(session?.user?.id);
  const ratingByItem = new Map(
    ratingRows.map((r) => [r.menuItemId, { average: r._avg.rating, count: r._count._all }])
  );

  return combos.map((combo): ComboDeal => {
    const components: ComboComponent[] = combo.items.map((i) => ({
      id: i.menuItem.id,
      title: i.menuItem.title,
      price: i.menuItem.price,
      imageUrl: i.menuItem.imageUrl,
      calories: i.menuItem.calories,
      fatGrams: i.menuItem.fatGrams,
      proteinGrams: i.menuItem.proteinGrams,
      prepTimeMinutes: i.menuItem.prepTimeMinutes,
      quantity: i.quantity,
    }));

    const priced = priceCombo(
      components,
      offers,
      isMember,
      settings.currency,
      settings.currencyMinorUnits,
      combo.discountPercent
    );

    return {
      id: combo.id,
      name: combo.name,
      description: combo.description,
      rating: pooledRating(
        combo.items.flatMap((i) => {
          const r = ratingByItem.get(i.menuItem.id);
          return r ? [r] : [];
        })
      ),
      discount: priced.discount,
      chips: comboChips(components),
      includes: comboIncludes(components),
      price: priced.price,
      wasPrice: priced.wasPrice,
      image: combo.imageUrl ?? components.find((c) => c.imageUrl)?.imageUrl ?? null,
      lines: priced.lines,
    };
  });
}