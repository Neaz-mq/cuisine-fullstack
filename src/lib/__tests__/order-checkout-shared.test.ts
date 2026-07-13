import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests mock "@/lib/prisma" entirely, so the real generated Prisma
 * client (which needs `prisma generate` + a live DATABASE_URL) is never
 * imported. That keeps this suite runnable in CI / offline without a
 * database — findValidCoupon and consumeCoupon only ever touch `prisma`
 * through the mocked methods below, exactly the calls they make in
 * order-checkout-shared.ts.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: { findUnique: vi.fn(), updateMany: vi.fn() },
    couponRedemption: { count: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  computeEligibleSubtotal,
  calcDiscountAmount,
  findValidCoupon,
  consumeCoupon,
  getCustomerKey,
  type CouponInfo,
  type ResolvedItem,
} from "@/lib/order-checkout-shared";

// ---------------------------------------------------------------------------
// Fixtures — mirrors the actual manual test session:
//   Veggie Supreme Pizza  = $420, category "cat_pizza"
//   Margherita Delight    = $400, category "cat_pizza"
//   Creamy Vanilla Milkshake = $90, category "cat_drinks"
// ---------------------------------------------------------------------------
const pizza420: Pick<ResolvedItem, "menuItemId" | "categoryId" | "price" | "quantity"> = {
  menuItemId: "item_veggie_supreme",
  categoryId: "cat_pizza",
  price: 420,
  quantity: 1,
};
const pizza400: Pick<ResolvedItem, "menuItemId" | "categoryId" | "price" | "quantity"> = {
  menuItemId: "item_margherita",
  categoryId: "cat_pizza",
  price: 400,
  quantity: 1,
};
const milkshake90: Pick<ResolvedItem, "menuItemId" | "categoryId" | "price" | "quantity"> = {
  menuItemId: "item_milkshake",
  categoryId: "cat_drinks",
  price: 90,
  quantity: 1,
};

const pizza20Restricted: Pick<CouponInfo, "restrictedCategoryIds" | "restrictedItemIds"> = {
  restrictedCategoryIds: ["cat_pizza"],
  restrictedItemIds: [],
};
const unrestricted: Pick<CouponInfo, "restrictedCategoryIds" | "restrictedItemIds"> = {
  restrictedCategoryIds: [],
  restrictedItemIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// computeEligibleSubtotal — pure function, no DB
// ---------------------------------------------------------------------------
describe("computeEligibleSubtotal", () => {
  it("unrestricted coupon: eligible subtotal = full cart subtotal", () => {
    const total = computeEligibleSubtotal([pizza400, milkshake90], unrestricted);
    expect(total).toBe(490);
  });

  it("category-restricted, cart has NO matching item: eligible subtotal = 0 (Test 1)", () => {
    const total = computeEligibleSubtotal([milkshake90], pizza20Restricted);
    expect(total).toBe(0);
  });

  it("category-restricted, mixed cart: only matching lines count (Test 2)", () => {
    const total = computeEligibleSubtotal([milkshake90, pizza400], pizza20Restricted);
    expect(total).toBe(400); // milkshake excluded
  });

  it("category-restricted, cart is entirely eligible: same as unrestricted (Test 3)", () => {
    const total = computeEligibleSubtotal([pizza400], pizza20Restricted);
    expect(total).toBe(400);
  });

  it("item-restricted matches by menuItemId even outside the restricted category list", () => {
    const total = computeEligibleSubtotal([pizza400, milkshake90], {
      restrictedCategoryIds: [],
      restrictedItemIds: ["item_milkshake"],
    });
    expect(total).toBe(90);
  });

  it("quantity multiplies correctly for a matching line", () => {
    const total = computeEligibleSubtotal([{ ...pizza400, quantity: 3 }], pizza20Restricted);
    expect(total).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// calcDiscountAmount — pure function, no DB
// ---------------------------------------------------------------------------
describe("calcDiscountAmount", () => {
  const baseCoupon: CouponInfo = {
    id: "c1",
    code: "PIZZA20",
    type: "PERCENT",
    percentOff: 20,
    fixedOff: null,
    maxDiscountAmount: null,
    minOrderValue: null,
    restrictedCategoryIds: ["cat_pizza"],
    restrictedItemIds: [],
  };

  it("PERCENT: 20% of $400 eligible subtotal = $80.00 (Test 2/3, matches real screenshots)", () => {
    expect(calcDiscountAmount(400, baseCoupon)).toBe(80);
  });

  it("PERCENT: 20% of $420 eligible subtotal = $84.00 (real order #ORD-YBM9PX)", () => {
    expect(calcDiscountAmount(420, baseCoupon)).toBe(84);
  });

  it("FIXED: SAVE5-style coupon always deducts the flat amount", () => {
    const save5: CouponInfo = { ...baseCoupon, type: "FIXED", percentOff: null, fixedOff: 5 };
    expect(calcDiscountAmount(420, save5)).toBe(5);
  });

  it("TEST10 regression: 10% of $420 = $42.00 (matches real screenshot)", () => {
    const test10: CouponInfo = { ...baseCoupon, percentOff: 10, restrictedCategoryIds: [], restrictedItemIds: [] };
    expect(calcDiscountAmount(420, test10)).toBe(42);
  });

  it("respects maxDiscountAmount cap even when the percentage would exceed it", () => {
    const capped: CouponInfo = { ...baseCoupon, maxDiscountAmount: 50 };
    expect(calcDiscountAmount(400, capped)).toBe(50); // 20% of 400 = 80, capped to 50
  });

  it("never discounts more than the eligible subtotal itself", () => {
    const oddFixed: CouponInfo = { ...baseCoupon, type: "FIXED", percentOff: null, fixedOff: 999 };
    expect(calcDiscountAmount(30, oddFixed)).toBe(30); // can't exceed eligible lines' value
  });

  it("rounds to the nearest cent", () => {
    const coupon: CouponInfo = { ...baseCoupon, percentOff: 33 };
    expect(calcDiscountAmount(10, coupon)).toBe(3.3);
  });
});

// ---------------------------------------------------------------------------
// getCustomerKey — pure function, no DB
// ---------------------------------------------------------------------------
describe("getCustomerKey", () => {
  it("prefers the logged-in userId when present", () => {
    expect(getCustomerKey("user_123", "+1 555-0100")).toBe("user:user_123");
  });

  it("falls back to a normalized phone number for guests", () => {
    expect(getCustomerKey(null, "+1 555-0100")).toBe("phone:+15550100");
  });

  it("returns null when there's neither a userId nor a phone", () => {
    expect(getCustomerKey(null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findValidCoupon — mocked DB, one test per manually-verified flow
// ---------------------------------------------------------------------------
describe("findValidCoupon (mocked prisma)", () => {
  const pizza20Row = {
    id: "coupon_pizza20",
    code: "PIZZA20",
    isActive: true,
    startsAt: null,
    expiresAt: null,
    minOrderValue: null,
    type: "PERCENT" as const,
    percentOff: 20,
    fixedOff: null,
    maxDiscountAmount: null,
    usageLimit: null,
    usageCount: 1,
    perCustomerLimit: null, // "Unlimited per customer", matches the real coupon
    restrictedCategories: [{ id: "cat_pizza" }],
    restrictedItems: [],
  };

  it("Flow 1 — restricted coupon rejected when cart has no eligible item", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce(pizza20Row as never);

    const result = await findValidCoupon("PIZZA20", [milkshake90], "user:mdz");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("This coupon only applies to specific items that aren't in your cart");
    }
  });

  it("Flow 2 — restricted coupon accepted for a mixed cart, eligibleSubtotal excludes non-matching lines", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce(pizza20Row as never);

    const result = await findValidCoupon("PIZZA20", [milkshake90, pizza400], "user:mdz");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subtotal).toBe(490);
      expect(result.eligibleSubtotal).toBe(400);
      expect(calcDiscountAmount(result.eligibleSubtotal, result.coupon)).toBe(80);
    }
  });

  it("Flow 3 — restricted coupon on an all-eligible cart behaves like unrestricted", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce(pizza20Row as never);

    const result = await findValidCoupon("PIZZA20", [pizza400], "user:mdz");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subtotal).toBe(400);
      expect(result.eligibleSubtotal).toBe(400);
    }
  });

  it("Flow 4 — regression: unrestricted coupon (TEST10) still applies to the whole cart", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce({
      ...pizza20Row,
      id: "coupon_test10",
      code: "TEST10",
      percentOff: 10,
      restrictedCategories: [],
      restrictedItems: [],
      perCustomerLimit: 1,
    } as never);
    vi.mocked(prisma.couponRedemption.count).mockResolvedValueOnce(0);

    const result = await findValidCoupon("TEST10", [pizza420], "user:mdz");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eligibleSubtotal).toBe(420);
      expect(calcDiscountAmount(result.eligibleSubtotal, result.coupon)).toBe(42);
    }
  });

  it("Flow 5 — per-customer limit blocks a coupon already redeemed by this customer (SAVE5)", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce({
      ...pizza20Row,
      id: "coupon_save5",
      code: "SAVE5",
      type: "FIXED",
      percentOff: null,
      fixedOff: 5,
      minOrderValue: 15,
      usageLimit: 3,
      usageCount: 2,
      perCustomerLimit: 1,
      restrictedCategories: [],
      restrictedItems: [],
    } as never);
    // This customer already has 1 redemption, and perCustomerLimit is 1.
    vi.mocked(prisma.couponRedemption.count).mockResolvedValueOnce(1);

    const result = await findValidCoupon("SAVE5", [pizza420], "user:mdz");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("You've already used this coupon");
    }
  });

  it("minOrderValue is checked against the FULL cart subtotal, not the eligible-only subtotal", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce({
      ...pizza20Row,
      minOrderValue: 450, // above pizza's $400 alone, but below pizza+milkshake's $490
    } as never);

    const rejectedOnPizzaAlone = await findValidCoupon("PIZZA20", [pizza400], "user:mdz");
    expect(rejectedOnPizzaAlone.ok).toBe(false);

    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce({
      ...pizza20Row,
      minOrderValue: 450,
    } as never);
    const acceptedWithMilkshakeAdded = await findValidCoupon("PIZZA20", [pizza400, milkshake90], "user:mdz");
    expect(acceptedWithMilkshakeAdded.ok).toBe(true);
    if (acceptedWithMilkshakeAdded.ok) {
      // Still only the pizza line counts toward the discount base.
      expect(acceptedWithMilkshakeAdded.eligibleSubtotal).toBe(400);
    }
  });

  it("rejects an unknown coupon code", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValueOnce(null);
    const result = await findValidCoupon("NOTREAL", [pizza400], "user:mdz");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid coupon code");
  });
});

// ---------------------------------------------------------------------------
// consumeCoupon — Flow 6: what actually happens at order-creation time,
// inside the DB transaction. Mocks a Prisma.TransactionClient.
// ---------------------------------------------------------------------------
describe("consumeCoupon (mocked transaction)", () => {
  function fakeTx(overrides: Partial<{
    coupon: Record<string, unknown> | null;
    redemptionsByCustomer: number;
    updateManyCount: number;
  }> = {}) {
    const coupon = overrides.coupon ?? {
      id: "coupon_pizza20",
      isActive: true,
      perCustomerLimit: null,
      usageLimit: null,
    };
    return {
      coupon: {
        findUnique: vi.fn().mockResolvedValue(coupon),
        updateMany: vi.fn().mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
      },
      couponRedemption: {
        count: vi.fn().mockResolvedValue(overrides.redemptionsByCustomer ?? 0),
        create: vi.fn().mockResolvedValue({}),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("Flow 6 — successful redemption creates a CouponRedemption row with the exact discount amount", async () => {
    const tx = fakeTx();

    const ok = await consumeCoupon(tx, "coupon_pizza20", "order_123", "user:mdz", 80);

    expect(ok).toBe(true);
    expect(tx.couponRedemption.create).toHaveBeenCalledWith({
      data: {
        couponId: "coupon_pizza20",
        orderId: "order_123",
        customerKey: "user:mdz",
        discountAmount: 80,
      },
    });
  });

  it("increments usageCount via the atomic updateMany guard", async () => {
    const tx = fakeTx();
    await consumeCoupon(tx, "coupon_pizza20", "order_123", "user:mdz", 80);

    expect(tx.coupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "coupon_pizza20" }),
        data: { usageCount: { increment: 1 } },
      })
    );
  });

  it("refuses to redeem when the customer already hit their per-customer limit", async () => {
    const tx = fakeTx({
      coupon: { id: "coupon_save5", isActive: true, perCustomerLimit: 1, usageLimit: 3 },
      redemptionsByCustomer: 1, // already at the cap
    });

    const ok = await consumeCoupon(tx, "coupon_save5", "order_999", "user:mdz", 5);

    expect(ok).toBe(false);
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });

  it("refuses to redeem an inactive coupon", async () => {
    const tx = fakeTx({ coupon: { id: "coupon_x", isActive: false, perCustomerLimit: null, usageLimit: null } });
    const ok = await consumeCoupon(tx, "coupon_x", "order_1", "user:mdz", 10);
    expect(ok).toBe(false);
  });

  it("refuses when the atomic usage-cap update loses the race (updateMany affects 0 rows)", async () => {
    const tx = fakeTx({ updateManyCount: 0 });
    const ok = await consumeCoupon(tx, "coupon_pizza20", "order_1", "user:mdz", 80);
    expect(ok).toBe(false);
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });
});