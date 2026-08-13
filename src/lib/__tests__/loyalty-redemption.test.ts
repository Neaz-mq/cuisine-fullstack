import { describe, it, expect } from "vitest";
import {
  clampPointsRedemption,
  pointsToDollars,
  MIN_REDEEMABLE_POINTS,
} from "@/lib/loyalty-redemption";

/**
 * pointsToDollars আর clampPointsRedemption(...).amount এখন Prisma
 * Decimal ফেরত দেয়, number নয় — money model migration-এর অংশ।
 *
 * expect(decimal).toBe(5) কখনো পাশ করে না (toBe reference সমতা দেখে,
 * Decimal একটা object), আর toEqual-এ Decimal নিজের toJSON দিয়ে string
 * হয়ে যায় ("5")। তাই assertion-এ amount() দিয়ে number-এ নামানো হয়,
 * আর গোটা object তুলনার বদলে field ধরে ধরে মেলানো হয়।
 */
const amount = (d: { toNumber(): number }) => d.toNumber();

describe("pointsToDollars", () => {
  it("converts points to dollars at the fixed rate", () => {
    expect(amount(pointsToDollars(20))).toBe(1);
    expect(amount(pointsToDollars(100))).toBe(5);
  });

  /**
   * তুলনাটা আর `37 * POINTS_TO_DOLLAR_RATE`-এর সাথে করা হয় না, আসল
   * উত্তরের সাথেই — কারণ ওই expression নিজেই float, আর float-কে
   * float দিয়ে যাচাই করলে দুই দিকেরই একই ভুল হলে test সবুজই থাকে।
   *
   * ৩৭ বেছে নেওয়া হয়েছে কারণ ২০-এর গুণিতক নয়, তাই ভগ্নাংশ তৈরি করে।
   * Decimal-এ ১.৮৫ মানে ঠিক ১.৮৫।
   */
  it("produces an exact decimal at an awkward point count", () => {
    expect(amount(pointsToDollars(37))).toBe(1.85);
    expect(pointsToDollars(37).toFixed(2)).toBe("1.85");
  });
});

describe("clampPointsRedemption", () => {
  it("redeems exactly what's requested when it fits comfortably", () => {
    const result = clampPointsRedemption(100, 500, 50);
    expect(result.points).toBe(100);
    expect(amount(result.amount)).toBe(5);
  });

  it("clamps to the customer's available balance", () => {
    const result = clampPointsRedemption(1000, 60, 50);
    expect(result.points).toBe(60);
    expect(amount(result.amount)).toBe(3);
  });

  it("clamps so the order can never go below $0", () => {
    // 500 points = $25, but the order only has $10 left to discount.
    const result = clampPointsRedemption(500, 500, 10);
    expect(amount(result.amount)).toBeLessThanOrEqual(10);
    expect(result.points).toBe(200); // 200 * 0.05 = $10 exactly
  });

  it("refuses to redeem below the minimum threshold", () => {
    const result = clampPointsRedemption(10, 500, 50);
    expect(result.points).toBe(0);
    expect(amount(result.amount)).toBe(0);
  });

  it("refuses when the customer's whole balance is below the minimum", () => {
    const result = clampPointsRedemption(100, MIN_REDEEMABLE_POINTS - 1, 50);
    expect(result.points).toBe(0);
    expect(amount(result.amount)).toBe(0);
  });

  it("returns zero for a non-positive request", () => {
    for (const requested of [0, -20]) {
      const result = clampPointsRedemption(requested, 500, 50);
      expect(result.points).toBe(0);
      expect(amount(result.amount)).toBe(0);
    }
  });

  it("returns zero when there's nothing left on the order to discount", () => {
    const result = clampPointsRedemption(100, 500, 0);
    expect(result.points).toBe(0);
    expect(amount(result.amount)).toBe(0);
  });

  it("floors a fractional point request", () => {
    const result = clampPointsRedemption(100.7, 500, 50);
    expect(result.points).toBe(100);
  });
});
