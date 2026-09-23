import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  applyOffer,
  effectivePrice,
  lastOfferDay,
  nextISODate,
  offerStatus,
  zonedDayStart,
  zonedISODate,
  type LiveOffer,
} from "@/lib/product-offers";

const offer = (over: Partial<LiveOffer> = {}): LiveOffer => ({
  id: "offer1",
  menuItemId: "item1",
  type: "PERCENT",
  percentOff: 20,
  fixedOff: null,
  audience: "ALL",
  startsAt: new Date("2026-08-01T00:00:00Z"),
  endsAt: null,
  ...over,
});

describe("applyOffer", () => {
  it("rounds a percentage cut to the currency's minor units", () => {
    // 10.49 × 0.8 = 8.392 → 8.39
    expect(applyOffer("10.49", offer(), 2)?.toFixed(2)).toBe("8.39");
  });

  it("takes a fixed amount off", () => {
    expect(applyOffer("16.99", offer({ type: "FIXED", percentOff: null, fixedOff: "9.10" }), 2)?.toFixed(2)).toBe("7.89");
  });

  it("does not apply when a fixed cut would make the dish free", () => {
    expect(applyOffer("5", offer({ type: "FIXED", percentOff: null, fixedOff: "5" }), 2)).toBeNull();
    expect(applyOffer("5", offer({ type: "FIXED", percentOff: null, fixedOff: "8" }), 2)).toBeNull();
  });
});

describe("offerStatus", () => {
  const now = new Date("2026-08-03T12:00:00Z");
  it("reads the status from the dates", () => {
    expect(offerStatus({ startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: null }, now)).toBe("active");
    expect(offerStatus({ startsAt: new Date("2026-08-05T00:00:00Z"), endsAt: null }, now)).toBe("scheduled");
    expect(
      offerStatus({ startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-03T12:00:00Z") }, now)
    ).toBe("ended");
  });
});

describe("effectivePrice", () => {
  it("charges members-only offers to signed-in customers only", () => {
    const members = offer({ audience: "MEMBERS" });
    const guest = effectivePrice("10", members, false, 2);
    expect(guest.price.toFixed(2)).toBe("10.00");
    expect(guest.offer).toBeNull();
    expect(guest.memberOffer?.id).toBe("offer1");

    const member = effectivePrice("10", members, true, 2);
    expect(member.price.toFixed(2)).toBe("8.00");
    expect(member.originalPrice?.toFixed(2)).toBe("10.00");
  });
});

describe("dates in the restaurant's time zone", () => {
  it("starts a day at local midnight, not UTC midnight", () => {
    // Dhaka is UTC+6: Aug 6 00:00 there is Aug 5 18:00 UTC.
    expect(zonedDayStart("2026-08-06", "Asia/Dhaka").toISOString()).toBe("2026-08-05T18:00:00.000Z");
    // New York in August is UTC−4.
    expect(zonedDayStart("2026-08-06", "America/New_York").toISOString()).toBe("2026-08-06T04:00:00.000Z");
  });

  it("round-trips the last day of an offer", () => {
    const endsAt = zonedDayStart(nextISODate("2026-08-31"), "Asia/Dhaka");
    expect(zonedISODate(lastOfferDay(endsAt), "Asia/Dhaka")).toBe("2026-08-31");
  });
});
