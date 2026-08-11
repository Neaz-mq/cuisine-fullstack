import { describe, it, expect } from "vitest";
import {
  clampPointsRedemption,
  pointsToDollars,
  POINTS_TO_DOLLAR_RATE,
  MIN_REDEEMABLE_POINTS,
} from "@/lib/loyalty-redemption";

describe("pointsToDollars", () => {
  it("converts points to dollars at the fixed rate", () => {
    expect(pointsToDollars(20)).toBe(1);
    expect(pointsToDollars(100)).toBe(5);
  });

  it("never produces a rounding artifact beyond 2 decimals", () => {
    expect(pointsToDollars(37)).toBe(37 * POINTS_TO_DOLLAR_RATE);
  });
});

describe("clampPointsRedemption", () => {
  it("redeems exactly what's requested when it fits comfortably", () => {
    const result = clampPointsRedemption(100, 500, 50);
    expect(result).toEqual({ points: 100, amount: 5 });
  });

  it("clamps to the customer's available balance", () => {
    const result = clampPointsRedemption(1000, 60, 50);
    expect(result.points).toBe(60);
    expect(result.amount).toBe(3);
  });

  it("clamps so the order can never go below $0", () => {
    // 500 points = $25, but the order only has $10 left to discount.
    const result = clampPointsRedemption(500, 500, 10);
    expect(result.amount).toBeLessThanOrEqual(10);
    expect(result.points).toBe(200); // 200 * 0.05 = $10 exactly
  });

  it("refuses to redeem below the minimum threshold", () => {
    const result = clampPointsRedemption(10, 500, 50);
    expect(result).toEqual({ points: 0, amount: 0 });
  });

  it("refuses when the customer's whole balance is below the minimum", () => {
    const result = clampPointsRedemption(100, MIN_REDEEMABLE_POINTS - 1, 50);
    expect(result).toEqual({ points: 0, amount: 0 });
  });

  it("returns zero for a non-positive request", () => {
    expect(clampPointsRedemption(0, 500, 50)).toEqual({ points: 0, amount: 0 });
    expect(clampPointsRedemption(-20, 500, 50)).toEqual({ points: 0, amount: 0 });
  });

  it("returns zero when there's nothing left on the order to discount", () => {
    expect(clampPointsRedemption(100, 500, 0)).toEqual({ points: 0, amount: 0 });
  });

  it("floors a fractional point request", () => {
    const result = clampPointsRedemption(100.7, 500, 50);
    expect(result.points).toBe(100);
  });
});
