import { describe, it, expect } from "vitest";
import {
  LOYALTY_TIERS,
  getTierForPoints,
  getNextTier,
  getTierProgress,
  calculatePointsEarned,
} from "@/lib/loyalty-tiers";

describe("getTierForPoints", () => {
  it("returns BRONZE for a brand-new customer with 0 points", () => {
    expect(getTierForPoints(0).id).toBe("BRONZE");
  });

  it("returns BRONZE for anything below the SILVER threshold", () => {
    expect(getTierForPoints(199).id).toBe("BRONZE");
  });

  it("returns SILVER exactly at its threshold (inclusive lower bound)", () => {
    expect(getTierForPoints(200).id).toBe("SILVER");
  });

  it("returns GOLD exactly at its threshold", () => {
    expect(getTierForPoints(500).id).toBe("GOLD");
  });

  it("returns PLATINUM at and above its threshold", () => {
    expect(getTierForPoints(1000).id).toBe("PLATINUM");
    expect(getTierForPoints(50000).id).toBe("PLATINUM");
  });

  it("never returns a tier for a negative balance below Bronze's floor", () => {
    // Defensive: balance should never go negative in practice, but the
    // function should degrade to the lowest tier rather than throw.
    expect(getTierForPoints(-10).id).toBe("BRONZE");
  });
});

describe("getNextTier", () => {
  it("returns SILVER after BRONZE", () => {
    expect(getNextTier(LOYALTY_TIERS[0])?.id).toBe("SILVER");
  });

  it("returns null after the top tier (PLATINUM)", () => {
    const platinum = LOYALTY_TIERS[LOYALTY_TIERS.length - 1];
    expect(getNextTier(platinum)).toBeNull();
  });
});

describe("getTierProgress", () => {
  it("computes 0% right at the start of a band", () => {
    const progress = getTierProgress(200); // exactly at SILVER's floor
    expect(progress.tier.id).toBe("SILVER");
    expect(progress.nextTier?.id).toBe("GOLD");
    expect(progress.progressPercent).toBe(0);
    expect(progress.pointsToNextTier).toBe(300); // 500 - 200
  });

  it("computes a mid-band percentage correctly", () => {
    // Bronze band is 0-200. 100 points in is exactly halfway.
    const progress = getTierProgress(100);
    expect(progress.tier.id).toBe("BRONZE");
    expect(progress.progressPercent).toBe(50);
    expect(progress.pointsToNextTier).toBe(100);
  });

  it("caps at 100% and has no next tier once at PLATINUM", () => {
    const progress = getTierProgress(5000);
    expect(progress.tier.id).toBe("PLATINUM");
    expect(progress.nextTier).toBeNull();
    expect(progress.progressPercent).toBe(100);
    expect(progress.pointsToNextTier).toBe(0);
  });
});

describe("calculatePointsEarned", () => {
  it("applies no bonus for a Bronze customer", () => {
    expect(calculatePointsEarned(40, 0)).toBe(40);
  });

  it("applies a 10% bonus for a Silver customer, floored", () => {
    // 40 * 1.1 = 44
    expect(calculatePointsEarned(40, 200)).toBe(44);
  });

  it("applies a 25% bonus for a Gold customer, floored down", () => {
    // 41 * 1.25 = 51.25 -> floors to 51
    expect(calculatePointsEarned(41, 500)).toBe(51);
  });

  it("applies a 50% bonus for a Platinum customer", () => {
    expect(calculatePointsEarned(40, 1000)).toBe(60);
  });

  it("uses the tier the customer was in BEFORE this order, not after", () => {
    // 190 points -> still Bronze even though this order's 15 base points
    // would push them past 200 (the Silver threshold).
    expect(calculatePointsEarned(15, 190)).toBe(15); // no bonus applied
  });

  it("returns 0 for an order that earned no base points, regardless of tier", () => {
    expect(calculatePointsEarned(0, 5000)).toBe(0);
  });
});
