import { describe, expect, it } from "vitest";
import {
  areaLabel,
  averageMinutes,
  averageRating,
  deliveryEarning,
  deliveryMinutes,
  earningsByDay,
  etaMinutes,
  formatMinutes,
  itemsLabel,
  paceHint,
  percentChange,
  sumEarnings,
  sevenDayTotals,
} from "@/lib/rider-stats";

describe("rider earnings", () => {
  it("counts delivery fee + tip, never the food", () => {
    expect(deliveryEarning({ deliveryFee: 5, tipAmount: 2.2 })).toBe(7.2);
    expect(deliveryEarning({ deliveryFee: { toNumber: () => 3.1 }, tipAmount: 0 })).toBe(3.1);
  });

  it("adds many deliveries without float drift", () => {
    const rows = Array.from({ length: 10 }, () => ({ deliveryFee: 0.1, tipAmount: 0.2 }));
    expect(sumEarnings(rows)).toBe(3);
    expect(sumEarnings([])).toBe(0);
  });

  it("groups by day, newest first", () => {
    const rows = [
      { deliveredAt: new Date(2026, 8, 28, 10), deliveryFee: 5, tipAmount: 1 },
      { deliveredAt: new Date(2026, 8, 29, 9), deliveryFee: 4, tipAmount: 0 },
      { deliveredAt: new Date(2026, 8, 29, 18), deliveryFee: 3, tipAmount: 2 },
    ];
    expect(earningsByDay(rows)).toEqual([
      { day: "2026-09-29", deliveries: 2, fees: 7, tips: 2, total: 9 },
      { day: "2026-09-28", deliveries: 1, fees: 5, tips: 1, total: 6 },
    ]);
  });
});

describe("percentChange", () => {
  it("rounds to a whole percent", () => {
    expect(percentChange(104, 100)).toBe(4);
    expect(percentChange(50, 100)).toBe(-50);
  });
  it("has nothing to say when the earlier figure was 0", () => {
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("delivery time", () => {
  const assignedAt = new Date("2026-09-29T10:00:00Z");
  it("counts from pick-up, not from acceptance", () => {
    expect(
      deliveryMinutes({
        assignedAt,
        pickedUpAt: new Date("2026-09-29T10:20:00Z"),
        deliveredAt: new Date("2026-09-29T10:38:00Z"),
      })
    ).toBe(18);
  });
  it("falls back to the assignment time", () => {
    expect(deliveryMinutes({ assignedAt, pickedUpAt: null, deliveredAt: new Date("2026-09-29T10:30:00Z") })).toBe(30);
  });
  it("averages to whole minutes, null with nothing delivered", () => {
    expect(
      averageMinutes([
        { assignedAt, pickedUpAt: null, deliveredAt: new Date("2026-09-29T10:10:00Z") },
        { assignedAt, pickedUpAt: null, deliveredAt: new Date("2026-09-29T10:25:00Z") },
      ])
    ).toBe(18);
    expect(averageMinutes([])).toBeNull();
  });
  it("describes the pace and formats long trips", () => {
    expect(paceHint(18)).toBe("Great pace");
    expect(paceHint(null)).toBe("No deliveries yet");
    expect(formatMinutes(18)).toBe("18 min");
    expect(formatMinutes(65)).toBe("1h 5m");
  });
});

describe("labels", () => {
  it("builds a short, repeat-free area", () => {
    expect(areaLabel({ address: "House 4, Road 7", city: "Uttara", state: "Dhaka" })).toBe("House 4, Uttara");
    expect(areaLabel({ address: "Char matha", city: "Bogura", state: "Bogura" })).toBe("Char matha, Bogura");
    expect(areaLabel({ address: null, city: "Bogura", state: "Rajshahi Division" })).toBe("Bogura, Rajshahi Division");
    expect(areaLabel({})).toBe("Address on the order");
  });
  it("pluralises items", () => {
    expect(itemsLabel(1)).toBe("1 Item");
    expect(itemsLabel(2)).toBe("2 Items");
  });
  it("averages ratings to one decimal", () => {
    expect(averageRating([5, 5, 4])).toBe(4.7);
    expect(averageRating([])).toBeNull();
  });
  it("estimates minutes away, at least one", () => {
    const here = { lat: 23.8103, lng: 90.4125 };
    expect(etaMinutes(here, here)).toBe(1);
    // ~3.3 km north at 20 km/h ≈ 10 minutes
    expect(etaMinutes(here, { lat: 23.84, lng: 90.4125 })).toBe(10);
  });
});

describe("sevenDayTotals", () => {
  it("puts each delivery on its day and keeps empty days", () => {
    const start = new Date(2026, 8, 23); // Sep 23, local midnight
    const days = sevenDayTotals(
      [
        { deliveredAt: new Date(2026, 8, 23, 10), deliveryFee: 2, tipAmount: 1 },
        { deliveredAt: new Date(2026, 8, 23, 22), deliveryFee: 2.5, tipAmount: 0 },
        { deliveredAt: new Date(2026, 8, 29, 23, 59), deliveryFee: 3, tipAmount: 0.1 },
        // outside the week — ignored
        { deliveredAt: new Date(2026, 8, 30, 0, 1), deliveryFee: 9, tipAmount: 9 },
        { deliveredAt: new Date(2026, 8, 22, 23), deliveryFee: 9, tipAmount: 9 },
      ],
      start
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ total: 5.5, deliveries: 2 });
    expect(days[3]).toMatchObject({ total: 0, deliveries: 0 });
    expect(days[6]).toMatchObject({ total: 3.1, deliveries: 1 });
    expect(days[6].date.getDate()).toBe(29);
  });
});
