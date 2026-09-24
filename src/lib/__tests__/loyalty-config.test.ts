import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { Prisma } from "@/generated/prisma/client";
import { pointsForSpend, tierClash } from "@/lib/loyalty-config";
import { earnSentence, formatSpend, LOYALTY_TIERS, tierRangeLabel, toTierDefs } from "@/lib/loyalty-tiers";

const money = (n: number) => new Prisma.Decimal(n);

describe("pointsForSpend", () => {
  it("is proportional and rounds down", () => {
    const rule = { spendAmount: money(1000), points: 10 };
    expect(pointsForSpend(money(250), rule)).toBe(2); // 2.5 → 2
    expect(pointsForSpend(money(1000), rule)).toBe(10);
    expect(pointsForSpend(money(99), rule)).toBe(0);
  });

  it("keeps the old default of 1 point per $10", () => {
    expect(pointsForSpend(money(26), { spendAmount: money(10), points: 1 })).toBe(2);
  });

  it("gives nothing without an active rule", () => {
    expect(pointsForSpend(money(500), null)).toBe(0);
  });
});

describe("tiers from the database", () => {
  it("sorts rows and turns bonus % into a multiplier", () => {
    const tiers = toTierDefs([
      { id: "b", name: "VIP", minPoints: 200, discountPercent: 5, bonusPercent: 25 },
      { id: "a", name: "Regular", minPoints: 0, discountPercent: 0, bonusPercent: 0 },
    ]);
    expect(tiers.map((t) => t.label)).toEqual(["Regular", "VIP"]);
    expect(tiers[1].pointsMultiplier).toBe(1.25);
  });

  it("labels each band up to where the next one starts", () => {
    expect(tierRangeLabel(LOYALTY_TIERS[0], LOYALTY_TIERS)).toBe("0–199 Points");
    expect(tierRangeLabel(LOYALTY_TIERS[3], LOYALTY_TIERS)).toBe("1,000+ Points");
  });
});

describe("tierClash", () => {
  const rows = [
    { id: "a", name: "Regular", minPoints: 0 },
    { id: "b", name: "Loyal", minPoints: 100 },
  ];

  it("refuses a duplicate name (any case) or starting points", () => {
    expect(tierClash(rows, { name: "loyal", minPoints: 300 }, null)).toMatch(/name/);
    expect(tierClash(rows, { name: "VIP", minPoints: 100 }, null)).toMatch(/Loyal/);
  });

  it("keeps 0 for the starting ranking", () => {
    expect(tierClash(rows, { name: "VIP", minPoints: 0 }, null)).toMatch(/starting/);
  });

  it("lets a ranking keep its own name and points when edited", () => {
    expect(tierClash(rows, { name: "Loyal", minPoints: 100 }, "b")).toBeNull();
  });
});

describe("wording", () => {
  it("matches the Figma sentence", () => {
    expect(earnSentence(1000, 10, "USD")).toBe("Spend $1,000 on food and earn 10 points");
    expect(formatSpend(12.5, "USD")).toBe("$12.50");
  });
});
