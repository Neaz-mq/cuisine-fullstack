import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/orders/[id]/review — the customer "Food Review" pop-up.
 * Star ratings become `Review` rows (what /admin/reviews shows), but only
 * for the logged-in customer who owns the order, and only for dishes that
 * were in it.
 */

const access = vi.fn();
vi.mock("@/lib/order-access", () => ({ resolveOrderAccess: () => access() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }));

const db = {
  findOrder: vi.fn(),
  reviewUpsert: vi.fn((args: unknown) => ({ kind: "review", args })),
  orderReviewUpsert: vi.fn((args: unknown) => ({ kind: "orderReview", args })),
  transaction: vi.fn(async (ops: unknown[]) => ops),
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (a: unknown) => db.findOrder(a) },
    review: { upsert: (a: unknown) => db.reviewUpsert(a) },
    orderReview: { upsert: (a: unknown) => db.orderReviewUpsert(a) },
    $transaction: (ops: unknown[]) => db.transaction(ops),
  },
}));

import { POST } from "@/app/api/orders/[id]/review/route";

const deliveredOrder = {
  id: "o1",
  status: "DELIVERED",
  userId: "u1",
  firstName: "Neaz",
  items: [{ menuItemId: "burger" }, { menuItemId: "fries" }],
};

function call(body: unknown) {
  const req = new NextRequest("http://x/api/orders/o1/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: "o1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.findOrder.mockResolvedValue(deliveredOrder);
  access.mockResolvedValue("owner");
});

describe("order review", () => {
  it("saves one PENDING Review per rated dish, with the comment", async () => {
    const res = await call({
      comment: "Great!",
      ratings: [
        { menuItemId: "burger", rating: 5 },
        { menuItemId: "fries", rating: 4 },
      ],
    });
    expect(res.status).toBe(201);
    expect(db.reviewUpsert).toHaveBeenCalledTimes(2);
    expect(db.reviewUpsert.mock.calls[0][0]).toMatchObject({
      where: { userId_menuItemId: { userId: "u1", menuItemId: "burger" } },
      create: { userId: "u1", menuItemId: "burger", rating: 5, comment: "Great!", status: "PENDING" },
    });
    expect(db.orderReviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("ignores dishes that were not in the order", async () => {
    await call({ ratings: [{ menuItemId: "burger", rating: 5 }, { menuItemId: "steak", rating: 1 }] });
    expect(db.reviewUpsert).toHaveBeenCalledTimes(1);
    expect(db.orderReviewUpsert).not.toHaveBeenCalled();
  });

  it("stars only, no comment, is allowed", async () => {
    const res = await call({ ratings: [{ menuItemId: "fries", rating: 3 }] });
    expect(res.status).toBe(201);
  });

  it("refuses ratings from staff viewing a customer's order", async () => {
    access.mockResolvedValue("staff");
    const res = await call({ ratings: [{ menuItemId: "burger", rating: 5 }] });
    expect(res.status).toBe(403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("guest orders can still leave a comment, but not ratings", async () => {
    db.findOrder.mockResolvedValue({ ...deliveredOrder, userId: null });
    access.mockResolvedValue("bearer");
    expect((await call({ comment: "Nice" })).status).toBe(201);
    expect((await call({ ratings: [{ menuItemId: "burger", rating: 5 }] })).status).toBe(403);
  });

  it("rejects an empty review and an undelivered order", async () => {
    expect((await call({ comment: "   " })).status).toBe(400);
    db.findOrder.mockResolvedValue({ ...deliveredOrder, status: "PREPARING" });
    expect((await call({ comment: "Nice" })).status).toBe(409);
  });

  it("rejects a rating outside 1-5", async () => {
    expect((await call({ ratings: [{ menuItemId: "burger", rating: 6 }] })).status).toBe(400);
  });
});
