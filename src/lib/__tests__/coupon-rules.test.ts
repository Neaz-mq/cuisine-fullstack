import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: { findUnique: vi.fn() },
    couponRedemption: { count: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    productOffer: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { calcDiscountAmount, findValidCoupon, type CouponInfo } from "@/lib/order-checkout-shared";
import { calculateOrderPricing, type PricingSettings } from "@/lib/pricing";
import { toMoney } from "@/lib/money";

const mocked = prisma as unknown as {
  coupon: { findUnique: ReturnType<typeof vi.fn> };
  couponRedemption: { count: ReturnType<typeof vi.fn> };
  order: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const baseCoupon = {
  id: "c1",
  code: "WELCOME20",
  type: "PERCENT",
  percentOff: 20,
  fixedOff: null,
  maxDiscountAmount: null,
  minOrderValue: null,
  startsAt: null,
  expiresAt: null,
  usageLimit: null,
  usageCount: 0,
  perCustomerLimit: 1,
  isActive: true,
  audience: "ALL",
  restrictedCategories: [],
  restrictedItems: [],
};

const items = [{ menuItemId: "m1", categoryId: "cat1", price: toMoney(10), quantity: 2 }];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.couponRedemption.count.mockResolvedValue(0);
});

describe("coupon audience", () => {
  it("refuses a first-time coupon for a customer who ordered before", async () => {
    mocked.coupon.findUnique.mockResolvedValue({ ...baseCoupon, audience: "NEW_CUSTOMERS" });
    mocked.order.count.mockResolvedValue(2);
    const result = await findValidCoupon("WELCOME20", items, "user:u1");
    expect(result).toEqual({ ok: false, error: "This coupon is for first-time customers only" });
  });

  it("allows a first-time coupon for a new customer", async () => {
    mocked.coupon.findUnique.mockResolvedValue({ ...baseCoupon, audience: "NEW_CUSTOMERS" });
    mocked.order.count.mockResolvedValue(0);
    const result = await findValidCoupon("WELCOME20", items, "user:u1");
    expect(result.ok).toBe(true);
  });

  it("matches guests by phone digits", async () => {
    mocked.coupon.findUnique.mockResolvedValue({ ...baseCoupon, audience: "NEW_CUSTOMERS" });
    mocked.order.findMany.mockResolvedValue([{ phone: "+880 1711-000000" }]);
    const result = await findValidCoupon("WELCOME20", items, "phone:+8801711000000");
    expect(result.ok).toBe(false);
  });

  it("needs a signed-in account for a members coupon", async () => {
    mocked.coupon.findUnique.mockResolvedValue({ ...baseCoupon, audience: "MEMBERS" });
    const guest = await findValidCoupon("WELCOME20", items, "phone:+8801711000000");
    expect(guest.ok).toBe(false);
    const member = await findValidCoupon("WELCOME20", items, "user:u1");
    expect(member.ok).toBe(true);
  });
});

describe("free delivery coupons", () => {
  it("is refused on dine-in orders", async () => {
    mocked.coupon.findUnique.mockResolvedValue({ ...baseCoupon, type: "FREE_DELIVERY", percentOff: null });
    const result = await findValidCoupon("FREESHIP", items, "user:u1", { orderType: "DINE_IN" });
    expect(result).toEqual({ ok: false, error: "This coupon is for delivery orders only" });
  });

  it("takes nothing off the food", () => {
    const coupon = { ...baseCoupon, type: "FREE_DELIVERY" } as unknown as CouponInfo;
    expect(calcDiscountAmount(20, coupon).toNumber()).toBe(0);
  });

  it("waives the delivery fee in pricing", () => {
    const settings: PricingSettings = {
      currency: "USD",
      currencyMinorUnits: 2,
      taxEnabled: false,
      taxName: "Tax",
      taxMode: "EXCLUSIVE",
      taxRateDineIn: 0,
      taxRateDelivery: 0,
      serviceChargeRate: 0,
      serviceChargeTaxable: false,
      deliveryFeeFlat: 3.5,
      deliveryFeeTaxable: false,
      tipEnabled: false,
    };
    const priced = calculateOrderPricing(
      { orderType: "DELIVERY", items: [{ price: 10, quantity: 2 }], freeDelivery: true },
      settings
    );
    expect(priced.deliveryFee.toNumber()).toBe(0);
    expect(priced.deliveryFeeWaived.toNumber()).toBe(3.5);
    expect(priced.totalAmount.toNumber()).toBe(20);
  });
});
