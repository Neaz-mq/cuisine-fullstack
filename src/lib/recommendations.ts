// src/lib/recommendations.ts
import { prisma } from "@/lib/prisma";

export interface RecommendedMenuItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
}

const MENU_ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  imageUrl: true,
} as const;

// Orders in these statuses represent real, completed activity — CANCELLED
// orders shouldn't influence "you might also like" or popularity ranking.
const COUNTED_ORDER_STATUSES = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

// Sorts a MenuItem[] to match the ranking implied by an ordered id list —
// Prisma's `findMany({ where: { id: { in: [...] } } })` does NOT preserve
// the order of the ids you passed in, so every function below needs this.
function sortByRank(items: RecommendedMenuItem[], rankedIds: string[]): RecommendedMenuItem[] {
  const rank = new Map(rankedIds.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/**
 * Best-selling items overall (by total quantity ordered), excluding any
 * ids passed in `excludeIds`. Used both as the guest/cold-start experience
 * and as a fallback wherever personalized data runs out.
 */
export async function getPopularItems(
  limit = 8,
  excludeIds: string[] = []
): Promise<RecommendedMenuItem[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: { status: { in: [...COUNTED_ORDER_STATUSES] } },
      menuItemId: { notIn: excludeIds },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const rankedIds = grouped.map((g) => g.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: rankedIds }, isAvailable: true },
    select: MENU_ITEM_SELECT,
  });
  return sortByRank(items, rankedIds);
}

/**
 * This customer's own most-ordered items — the "Order Again" row. Ranked
 * by total quantity they've personally ordered, most first.
 */
export async function getOrderAgainItems(
  userId: string,
  limit = 6
): Promise<RecommendedMenuItem[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: { order: { userId, status: { in: [...COUNTED_ORDER_STATUSES] } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const rankedIds = grouped.map((g) => g.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: rankedIds }, isAvailable: true },
    select: MENU_ITEM_SELECT,
  });
  return sortByRank(items, rankedIds);
}

/**
 * "You might also like" — item-item collaborative filtering: the same
 * "customers who ordered X also ordered Y" approach production
 * recommendation engines lean on before reaching for a full ML model.
 * Cheap to compute, fully explainable, and improves as order volume grows.
 *
 * 1. Look up everything this user has ordered.
 * 2. Find other customers ("neighbors") who ordered at least one of the
 *    same items — a rough proxy for "similar taste".
 * 3. Rank everything those neighbors ordered (that this user hasn't tried)
 *    by how often it co-occurs with this user's own items.
 */
export async function getYouMightAlsoLike(
  userId: string,
  limit = 8
): Promise<RecommendedMenuItem[]> {
  const ownItems = await prisma.orderItem.findMany({
    where: { order: { userId, status: { in: [...COUNTED_ORDER_STATUSES] } } },
    select: { menuItemId: true },
    distinct: ["menuItemId"],
  });
  const ownItemIds = ownItems.map((i) => i.menuItemId);
  if (ownItemIds.length === 0) return [];

  // Cap the fan-out for performance — this is a lightweight recommender,
  // not an offline batch job, so it runs on every relevant page load.
  const neighborOrders = await prisma.order.findMany({
    where: {
      userId: { not: userId },
      status: { in: [...COUNTED_ORDER_STATUSES] },
      items: { some: { menuItemId: { in: ownItemIds } } },
    },
    select: { items: { select: { menuItemId: true, quantity: true } } },
    take: 200,
  });

  const scores = new Map<string, number>();
  for (const order of neighborOrders) {
    for (const item of order.items) {
      if (ownItemIds.includes(item.menuItemId)) continue; // already a regular
      scores.set(item.menuItemId, (scores.get(item.menuItemId) ?? 0) + item.quantity);
    }
  }

  const rankedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  // Cold start within collaborative filtering (nobody else has ordered
  // this user's items yet, e.g. a brand-new restaurant) — fall back to
  // overall popularity, still excluding what they already order regularly.
  if (rankedIds.length === 0) {
    return getPopularItems(limit, ownItemIds);
  }

  const items = await prisma.menuItem.findMany({
    where: { id: { in: rankedIds }, isAvailable: true },
    select: MENU_ITEM_SELECT,
  });
  return sortByRank(items, rankedIds);
}

export interface Recommendations {
  // false = "Popular Right Now" cold-start experience (guest, or a
  // customer with no qualifying order history yet). true = genuinely
  // personalized off this specific customer's own orders.
  personalized: boolean;
  orderAgain: RecommendedMenuItem[];
  recommended: RecommendedMenuItem[];
}

export async function getRecommendationsForUser(
  userId?: string | null
): Promise<Recommendations> {
  if (!userId) {
    return { personalized: false, orderAgain: [], recommended: await getPopularItems(8) };
  }

  const [orderAgain, youMightAlsoLike] = await Promise.all([
    getOrderAgainItems(userId, 6),
    getYouMightAlsoLike(userId, 8),
  ]);

  // Brand-new customer, no order history at all yet — still give them a
  // useful section instead of an empty one.
  if (orderAgain.length === 0 && youMightAlsoLike.length === 0) {
    return { personalized: false, orderAgain: [], recommended: await getPopularItems(8) };
  }

  return { personalized: true, orderAgain, recommended: youMightAlsoLike };
}