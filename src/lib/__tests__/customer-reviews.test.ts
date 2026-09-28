import { describe, expect, it } from "vitest";
import { attributeDishRatings, buildReviewEntries, orderTitle, type OrderForReviews } from "@/lib/customer-reviews";

/**
 * My Reviews: dish ratings don't say which order they came from, so they
 * are matched to the latest order with that dish placed before the rating.
 */

const d = (day: number) => new Date(Date.UTC(2026, 6, day));
const dish = (id: string, title = id) => ({ menuItemId: id, title, imageUrl: null });

const orders: OrderForReviews[] = [
  { id: "o1", createdAt: d(1), deliveredAt: d(1), items: [dish("burger", "Burger"), dish("fries", "Fries")] },
  { id: "o2", createdAt: d(10), deliveredAt: d(10), items: [dish("burger", "Burger"), dish("burger", "Burger")] },
  { id: "o3", createdAt: d(20), deliveredAt: null, items: [dish("pizza", "Pizza")] },
];

const rating = (id: string, menuItemId: string, day: number, value = 5) => ({
  id,
  menuItemId,
  rating: value,
  comment: null,
  status: "APPROVED" as const,
  updatedAt: d(day),
  title: menuItemId,
  imageUrl: null,
});

describe("customer reviews", () => {
  it("names an order by its dishes, each once", () => {
    expect(orderTitle(orders[1].items)).toBe("Burger");
    expect(orderTitle(orders[0].items)).toBe("Burger, Fries");
  });

  it("matches a rating to the latest order with that dish placed before it", () => {
    const map = attributeDishRatings(orders, [
      { id: "r1", menuItemId: "burger", updatedAt: d(12) },
      { id: "r2", menuItemId: "burger", updatedAt: d(5) },
      { id: "r3", menuItemId: "fries", updatedAt: d(25) },
      { id: "r4", menuItemId: "soup", updatedAt: d(25) },
    ]);
    expect(map.get("r1")).toBe("o2");
    expect(map.get("r2")).toBe("o1");
    expect(map.get("r3")).toBe("o1");
    expect(map.get("r4")).toBeNull();
  });

  it("builds one card per reviewed order, with average stars and the comment", () => {
    const { entries, reviewedOrderIds } = buildReviewEntries(
      orders,
      [{ orderId: "o1", comment: "Came hot", status: "PENDING", updatedAt: d(2) }],
      [rating("r1", "burger", 2, 5), rating("r2", "fries", 2, 4), rating("r3", "pizza", 21, 3)]
    );
    expect([...reviewedOrderIds].sort()).toEqual(["o1", "o3"]);
    const o1 = entries.find((entry) => entry.orderId === "o1")!;
    expect(o1.stars).toBe(5); // (5 + 4) / 2 = 4.5 → 5
    expect(o1.comment).toBe("Came hot");
    expect(o1.status).toBe("PENDING");
    expect(o1.ratings).toEqual({ burger: 5, fries: 4 });
    // newest first; o3 had no delivery time, so its order date is used
    expect(entries[0].orderId).toBe("o3");
    expect(entries[0].date?.toISOString()).toBe(d(20).toISOString());
  });

  it("keeps a comment-only review and a rating with no order", () => {
    const { entries } = buildReviewEntries(
      orders,
      [{ orderId: "o2", comment: "Great", status: "APPROVED", updatedAt: d(11) }],
      [rating("r9", "soup", 3, 2)]
    );
    expect(entries.find((entry) => entry.orderId === "o2")?.stars).toBeNull();
    const loose = entries.find((entry) => entry.reviewId === "r9")!;
    expect(loose.orderId).toBeNull();
    expect(loose.stars).toBe(2);
  });
});
