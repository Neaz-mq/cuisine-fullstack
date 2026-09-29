/**
 * src/lib/customer-reviews.ts
 *
 * Customer panel → My Reviews: turns what's stored into "one review per
 * order", the way the customer wrote it.
 *
 * What's stored (POST /api/orders/[id]/review):
 *   • OrderReview — the written comment, one per order (only if they wrote one);
 *   • Review      — one star rating per dish, per customer (the schema allows
 *                   only one per customer per dish, so a newer order's rating
 *                   replaces the older one).
 *
 * A Review row doesn't say which order it came from, so it is matched to the
 * customer's latest order that has that dish and was placed before the rating
 * was saved. That order is where the customer rated it.
 *
 * Pure functions — no Prisma — so the page, the delete route and the tests
 * all use exactly the same rules.
 */

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** The rider who delivered an order (restaurant's own delivery) and the
 *  customer's stars for them, if given. */
export type ReviewRider = { name: string; rating: number | null };

export type OrderForReviews = {
  id: string;
  createdAt: Date;
  deliveredAt: Date | null;
  items: { menuItemId: string; title: string; imageUrl: string | null }[];
  rider?: ReviewRider | null;
};

export type OrderCommentRow = {
  orderId: string;
  comment: string;
  status: ReviewStatus;
  updatedAt: Date;
};

export type DishRatingRow = {
  id: string;
  menuItemId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  updatedAt: Date;
  title: string;
  imageUrl: string | null;
};

export type ReviewDish = { menuItemId: string; title: string; imageUrl: string | null };

export type ReviewEntry = {
  /** Stable React key. */
  key: string;
  /** The order this review is about; null for a dish rating with no order. */
  orderId: string | null;
  /** Only for a dish rating with no order — deleted by its own id. */
  reviewId: string | null;
  title: string;
  imageUrl: string | null;
  /** When the order was delivered (or placed, for older orders). */
  date: Date | null;
  /** Average of the dish ratings, 1–5, or null if only a comment. */
  stars: number | null;
  ratings: Record<string, number>;
  dishes: ReviewDish[];
  comment: string;
  status: ReviewStatus;
  updatedAt: Date;
  /** Order entries only: the rider, and the stars they were given. */
  rider: ReviewRider | null;
};

/** Each dish in an order once, in order. */
export function uniqueDishes(items: OrderForReviews["items"]): ReviewDish[] {
  const seen = new Set<string>();
  const dishes: ReviewDish[] = [];
  for (const item of items) {
    if (seen.has(item.menuItemId)) continue;
    seen.add(item.menuItemId);
    dishes.push({ menuItemId: item.menuItemId, title: item.title, imageUrl: item.imageUrl });
  }
  return dishes;
}

/** "Beef Pizza, Lemon Mint Cooler" — Figma's row title. */
export function orderTitle(items: OrderForReviews["items"]): string {
  return uniqueDishes(items)
    .map((dish) => dish.title)
    .join(", ");
}

/**
 * Which order each dish rating belongs to: the latest order containing the
 * dish that was placed no later than the rating was saved. null = none.
 */
export function attributeDishRatings(
  orders: OrderForReviews[],
  ratings: Pick<DishRatingRow, "id" | "menuItemId" | "updatedAt">[]
): Map<string, string | null> {
  const newestFirst = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const result = new Map<string, string | null>();
  for (const rating of ratings) {
    const order = newestFirst.find(
      (candidate) =>
        candidate.createdAt.getTime() <= rating.updatedAt.getTime() &&
        candidate.items.some((item) => item.menuItemId === rating.menuItemId)
    );
    result.set(rating.id, order?.id ?? null);
  }
  return result;
}

/** One status for the whole card: waiting beats not-published beats published. */
function combinedStatus(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.includes("PENDING")) return "PENDING";
  if (statuses.includes("REJECTED")) return "REJECTED";
  return "APPROVED";
}

export function buildReviewEntries(
  orders: OrderForReviews[],
  comments: OrderCommentRow[],
  ratings: DishRatingRow[]
): { entries: ReviewEntry[]; reviewedOrderIds: Set<string> } {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const attribution = attributeDishRatings(orders, ratings);

  const byOrder = new Map<string, { comment: OrderCommentRow | null; ratings: DishRatingRow[] }>();
  const loose: DishRatingRow[] = [];

  for (const comment of comments) {
    if (!ordersById.has(comment.orderId)) continue;
    byOrder.set(comment.orderId, { comment, ratings: byOrder.get(comment.orderId)?.ratings ?? [] });
  }
  for (const rating of ratings) {
    const orderId = attribution.get(rating.id) ?? null;
    if (!orderId) {
      loose.push(rating);
      continue;
    }
    const group = byOrder.get(orderId) ?? { comment: null, ratings: [] };
    group.ratings.push(rating);
    byOrder.set(orderId, group);
  }
  // Only the rider was rated (no comment, no dish stars) — still a review
  // of that order.
  for (const order of orders) {
    if (order.rider?.rating && !byOrder.has(order.id)) byOrder.set(order.id, { comment: null, ratings: [] });
  }

  const entries: ReviewEntry[] = [];
  for (const [orderId, group] of byOrder) {
    const order = ordersById.get(orderId)!;
    const dishes = uniqueDishes(order.items);
    const ratingMap: Record<string, number> = {};
    for (const rating of group.ratings) ratingMap[rating.menuItemId] = rating.rating;
    const values = Object.values(ratingMap);
    const statuses = [
      ...(group.comment ? [group.comment.status] : []),
      ...group.ratings.map((rating) => rating.status),
    ];
    const times = [
      ...(group.comment ? [group.comment.updatedAt.getTime()] : []),
      ...group.ratings.map((rating) => rating.updatedAt.getTime()),
    ];
    if (times.length === 0) times.push((order.deliveredAt ?? order.createdAt).getTime());
    entries.push({
      key: `order-${orderId}`,
      orderId,
      reviewId: null,
      title: orderTitle(order.items),
      imageUrl: dishes.find((dish) => dish.imageUrl)?.imageUrl ?? null,
      date: order.deliveredAt ?? order.createdAt,
      stars: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
      ratings: ratingMap,
      dishes,
      comment: group.comment?.comment ?? group.ratings.find((rating) => rating.comment)?.comment ?? "",
      status: combinedStatus(statuses),
      updatedAt: new Date(Math.max(...times)),
      rider: order.rider ?? null,
    });
  }

  for (const rating of loose) {
    entries.push({
      key: `dish-${rating.id}`,
      orderId: null,
      reviewId: rating.id,
      title: rating.title,
      imageUrl: rating.imageUrl,
      date: null,
      stars: rating.rating,
      ratings: { [rating.menuItemId]: rating.rating },
      dishes: [{ menuItemId: rating.menuItemId, title: rating.title, imageUrl: rating.imageUrl }],
      comment: rating.comment ?? "",
      status: rating.status,
      updatedAt: rating.updatedAt,
      rider: null,
    });
  }

  entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return { entries, reviewedOrderIds: new Set(byOrder.keys()) };
}
