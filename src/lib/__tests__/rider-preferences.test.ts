import { describe, expect, it } from "vitest";
import { DEFAULT_RIDER_PREFERENCES, availableOrderFilter, matchesPreferences } from "@/lib/rider-preferences";
import { riderPreferencesSchema } from "@/lib/validations/delivery";

describe("rider delivery preferences", () => {
  it("adds no filter with the defaults", () => {
    expect(availableOrderFilter(DEFAULT_RIDER_PREFERENCES)).toEqual([]);
  });

  it("limits distance but keeps orders with no distance on file", () => {
    const prefs = { ...DEFAULT_RIDER_PREFERENCES, maxRadiusKm: 5 };
    expect(availableOrderFilter(prefs)).toEqual([
      { OR: [{ deliveryDistanceKm: null }, { deliveryDistanceKm: { lte: 5 } }] },
    ]);
    expect(matchesPreferences({ distanceKm: 4.9, paymentMethod: "COD" }, prefs)).toBe(true);
    expect(matchesPreferences({ distanceKm: 6.2, paymentMethod: "COD" }, prefs)).toBe(false);
    expect(matchesPreferences({ distanceKm: null, paymentMethod: "COD" }, prefs)).toBe(true);
  });

  it("hides cash orders for online-only riders", () => {
    const prefs = { ...DEFAULT_RIDER_PREFERENCES, acceptsCash: false };
    expect(availableOrderFilter(prefs)).toEqual([{ paymentMethod: "ONLINE" }]);
    expect(matchesPreferences({ distanceKm: 2, paymentMethod: "COD" }, prefs)).toBe(false);
    expect(matchesPreferences({ distanceKm: 2, paymentMethod: "ONLINE" }, prefs)).toBe(true);
  });

  it("only accepts the offered radius values", () => {
    const base = { acceptsCash: true, newOrderAlerts: true, earningsSummary: false };
    expect(riderPreferencesSchema.safeParse({ ...base, maxRadiusKm: 5 }).success).toBe(true);
    expect(riderPreferencesSchema.safeParse({ ...base, maxRadiusKm: null }).success).toBe(true);
    expect(riderPreferencesSchema.safeParse({ ...base, maxRadiusKm: 7 }).success).toBe(false);
  });
});
