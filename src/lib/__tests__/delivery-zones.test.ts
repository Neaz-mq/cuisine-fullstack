import { describe, it, expect } from "vitest";
import {
  DEFAULT_DELIVERY_ZONES,
  normalizeDeliveryZones,
  resolveDeliveryZone,
  haversineKm,
  distanceBarRatio,
  formatKm,
} from "@/lib/delivery-zones";

/**
 * src/lib/__tests__/delivery-zones.test.ts
 *
 * এই file-টা database ছোঁয় না, network ছোঁয় না — delivery-zones.ts
 * ইচ্ছাকৃতভাবে বিশুদ্ধ রাখা হয়েছে বলেই সেটা সম্ভব। pricing.test.ts-এ
 * একই কারণ লেখা আছে।
 *
 * সবচেয়ে জরুরি দুটো নিশ্চয়তা এখানে:
 *
 *   ১. সিঁড়িতে কখনো ফাঁক থাকতে পারে না — অর্থাৎ কোনো দূরত্বেই
 *      "কোনো ধাপ মিলল না, ফি শূন্য" হতে পারে না।
 *   ২. তালিকার বাইরে যাওয়া আর ফি শূন্য হওয়া দুটো আলাদা ফল।
 */

const zones = normalizeDeliveryZones(DEFAULT_DELIVERY_ZONES);

describe("normalizeDeliveryZones", () => {
  it("derives fromKm and labels from the ladder", () => {
    expect(zones.map((z) => z.label)).toEqual([
      "0–1 Km",
      "1–3 Km",
      "3–5 Km",
      "5–8 Km",
      "8+ Km",
    ]);
    expect(zones.map((z) => z.fee)).toEqual([2, 5, 7, 10, 14]);
  });

  it("sorts an out-of-order ladder and keeps the open-ended step last", () => {
    const out = normalizeDeliveryZones([
      { upToKm: null, fee: 14 },
      { upToKm: 3, fee: 5 },
      { upToKm: 1, fee: 2 },
    ]);
    expect(out.map((z) => z.upToKm)).toEqual([1, 3, null]);
  });

  it("drops entries that could never match or price correctly", () => {
    const out = normalizeDeliveryZones([
      { upToKm: 1, fee: 2 },
      { upToKm: -4, fee: 5 }, // negative distance
      { upToKm: 3, fee: -1 }, // negative fee
      { upToKm: "5", fee: 7 }, // wrong type (hand-written SQL / bad JSON)
      null,
      { upToKm: null, fee: 14 },
    ]);
    expect(out.map((z) => z.upToKm)).toEqual([1, null]);
  });

  it("keeps only the first open-ended step", () => {
    const out = normalizeDeliveryZones([
      { upToKm: 2, fee: 3 },
      { upToKm: null, fee: 10 },
      { upToKm: null, fee: 99 },
    ]);
    expect(out.filter((z) => z.upToKm === null)).toHaveLength(1);
    expect(out[out.length - 1].fee).toBe(10);
  });

  it("falls back to the defaults rather than returning an empty ladder", () => {
    // ⚠️ খালি তালিকা ফেরত দিলে resolveDeliveryZone প্রতিটা অর্ডারে
    // OUT_OF_RANGE বলত — অর্থাৎ একটা নোংরা settings row গোটা
    // checkout বন্ধ করে দিত।
    expect(normalizeDeliveryZones(null)).toHaveLength(DEFAULT_DELIVERY_ZONES.length);
    expect(normalizeDeliveryZones([])).toHaveLength(DEFAULT_DELIVERY_ZONES.length);
    expect(normalizeDeliveryZones("not an array")).toHaveLength(DEFAULT_DELIVERY_ZONES.length);
  });
});

describe("resolveDeliveryZone", () => {
  it("matches the Figma example: 3.9 km falls in the 3–5 Km step at 7", () => {
    const match = resolveDeliveryZone(3.9, zones);
    expect(match.ok).toBe(true);
    if (match.ok) {
      expect(match.zone.label).toBe("3–5 Km");
      expect(match.zone.fee).toBe(7);
    }
  });

  it("treats an exact boundary as belonging to the lower step", () => {
    // খদ্দের চিপে "0–1 Km" পড়েন; ঠিক ১.০-তে পরের ধাপের দাম নেওয়া
    // অন্যায্য মনে হতো।
    const match = resolveDeliveryZone(1, zones);
    expect(match.ok && match.zone.label).toBe("0–1 Km");
  });

  it("puts anything past the last bounded step in the open-ended one", () => {
    const justOver = resolveDeliveryZone(8.01, zones);
    expect(justOver.ok && justOver.zone.label).toBe("8+ Km");

    const far = resolveDeliveryZone(120, zones);
    expect(far.ok && far.zone.fee).toBe(14);
  });

  it("never returns a gap — every non-negative distance matches some step", () => {
    for (let km = 0; km <= 20; km += 0.25) {
      expect(resolveDeliveryZone(km, zones).ok).toBe(true);
    }
  });

  it("reports OUT_OF_RANGE when the ladder has no open-ended step", () => {
    const bounded = normalizeDeliveryZones([
      { upToKm: 1, fee: 2 },
      { upToKm: 5, fee: 7 },
    ]);
    const match = resolveDeliveryZone(9, bounded);
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.maxKm).toBe(5);
  });

  it("treats a nonsense distance as zero rather than throwing", () => {
    // ⚠️ শূন্য ধরা হয় বলে সবচেয়ে **সস্তা** ধাপটা বসে, সবচেয়ে দামিটা
    // নয়। খারাপ ডেটার কারণে খদ্দেরকে বেশি চার্জ করার চেয়ে কম চার্জ
    // করা ভালো — ভুলটা তখন দোকানের ক্ষতি, খদ্দেরের নয়।
    const nan = resolveDeliveryZone(Number.NaN, zones);
    expect(nan.ok && nan.zone.label).toBe("0–1 Km");

    const negative = resolveDeliveryZone(-3, zones);
    expect(negative.ok && negative.zone.label).toBe("0–1 Km");
  });
});

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    const p = { lat: 24.84491, lng: 89.37532 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 6);
  });

  it("matches a known distance (Bogura → Dhaka, roughly 200 km)", () => {
    const bogura = { lat: 24.84491, lng: 89.37532 };
    const dhaka = { lat: 23.8103, lng: 90.4125 };
    expect(haversineKm(bogura, dhaka)).toBeGreaterThan(150);
    expect(haversineKm(bogura, dhaka)).toBeLessThan(200);
  });

  it("is symmetric", () => {
    const a = { lat: 24.84, lng: 89.37 };
    const b = { lat: 24.9, lng: 89.4 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });

  it("gives about 1.11 km per 0.01° of latitude", () => {
    const a = { lat: 24.0, lng: 89.0 };
    const b = { lat: 24.01, lng: 89.0 };
    expect(haversineKm(a, b)).toBeCloseTo(1.11, 1);
  });
});

describe("distanceBarRatio", () => {
  it("scales against the last bounded step, not the open-ended one", () => {
    expect(distanceBarRatio(4, zones)).toBeCloseTo(0.5, 5); // 4 / 8
  });

  it("clamps at both ends", () => {
    expect(distanceBarRatio(0, zones)).toBe(0);
    expect(distanceBarRatio(50, zones)).toBe(1);
  });
});

describe("formatKm", () => {
  it("drops a pointless trailing zero", () => {
    expect(formatKm(3)).toBe("3");
    expect(formatKm(3.9)).toBe("3.9");
    expect(formatKm(3.94)).toBe("3.9");
  });
});
