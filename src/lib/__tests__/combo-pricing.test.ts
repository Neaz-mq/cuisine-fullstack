import { describe, it, expect, vi } from "vitest";
import { toMoney, type Money } from "@/lib/money";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  comboChips,
  applyComboDiscounts,
  comboIncludes,
  comboStatuses,
  comboUnitPrice,
  pooledRating,
  priceCombo,
  type ComboComponent,
} from "@/lib/combo-pricing";
import type { LiveOffer } from "@/lib/product-offers";

const item = (over: Partial<ComboComponent> = {}): ComboComponent => ({
  id: "a",
  title: "Burger",
  price: "10.00",
  imageUrl: null,
  calories: 500,
  fatGrams: 20,
  proteinGrams: 30,
  prepTimeMinutes: 15,
  quantity: 1,
  ...over,
});

const offer = (over: Partial<LiveOffer> = {}): LiveOffer => ({
  id: "o1",
  menuItemId: "a",
  type: "PERCENT",
  percentOff: 20,
  fixedOff: null,
  audience: "ALL",
  startsAt: new Date("2026-08-01T00:00:00Z"),
  endsAt: null,
  ...over,
});

describe("priceCombo", () => {
  it("sums component prices × quantity with no discount when there are no offers", () => {
    const r = priceCombo(
      [item({ id: "a", price: "10.00" }), item({ id: "b", price: "3.50", quantity: 2 })],
      new Map(),
      false,
      "USD",
      2
    );
    expect(r.price).toBe("$17.00");
    expect(r.wasPrice).toBeNull();
    expect(r.discount).toBeNull();
    expect(r.lines.map((l) => [l.id, l.price, l.quantity])).toEqual([
      ["a", 10, 1],
      ["b", 3.5, 2],
    ]);
  });

  it("applies a live offer and reports the real saving", () => {
    const r = priceCombo(
      [item({ id: "a", price: "10.00" }), item({ id: "b", price: "10.00" })],
      new Map([["a", offer()]]),
      false,
      "USD",
      2
    );
    expect(r.price).toBe("$18.00");
    expect(r.wasPrice).toBe("$20.00");
    expect(r.discount).toBe("10%");
    expect(r.lines[0].price).toBe(8);
  });

  it("does not show a members-only offer to a guest", () => {
    const members = new Map([["a", offer({ audience: "MEMBERS" })]]);
    const guest = priceCombo([item()], members, false, "USD", 2);
    const member = priceCombo([item()], members, true, "USD", 2);
    expect(guest.discount).toBeNull();
    expect(guest.price).toBe("$10.00");
    expect(member.discount).toBe("20%");
    expect(member.price).toBe("$8.00");
  });
});

describe("comboChips", () => {
  it("uses the longest prep time and totals nutrition × quantity", () => {
    const chips = comboChips([
      item({ prepTimeMinutes: 10, calories: 400, fatGrams: 10.5, proteinGrams: 20 }),
      item({ id: "b", prepTimeMinutes: 25, calories: 100, fatGrams: 2, proteinGrams: 1, quantity: 2 }),
    ]);
    expect(chips).toEqual(["25 min", "600 kcal", "14.5 Fats", "22 Protein"]);
  });

  it("omits a figure when any component lacks it", () => {
    const chips = comboChips([item(), item({ id: "b", calories: null })]);
    expect(chips).toEqual(["15 min", "40 Fats", "60 Protein"]);
  });
});

describe("comboIncludes", () => {
  it("prefixes the quantity only when above one", () => {
    expect(comboIncludes([item(), item({ id: "b", title: "Fries", quantity: 2 })])).toEqual([
      "Burger",
      "2 × Fries",
    ]);
  });
});

describe("pooledRating", () => {
  it("weights by review count", () => {
    expect(pooledRating([{ average: 5, count: 1 }, { average: 4, count: 3 }])).toBe("4.3");
  });
  it("is null when nothing is reviewed", () => {
    expect(pooledRating([{ average: null, count: 0 }])).toBeNull();
  });
});

describe("comboStatuses", () => {
  const combo = (id: string, over: Partial<{ isActive: boolean; items: { title: string; isAvailable: boolean }[] }> = {}) => ({
    id,
    isActive: true,
    items: [{ title: "Burger", isAvailable: true }],
    ...over,
  });

  it("marks the first three displayable combos live and the rest waiting", () => {
    const m = comboStatuses([combo("a"), combo("b"), combo("c"), combo("d")]);
    expect([...m.values()].map((s) => s.kind)).toEqual(["live", "live", "live", "waiting"]);
  });

  it("hidden and unavailable combos do not use up a home page slot", () => {
    const m = comboStatuses([
      combo("a", { isActive: false }),
      combo("b", { items: [{ title: "Fries", isAvailable: false }] }),
      combo("c"),
    ]);
    expect(m.get("a")?.kind).toBe("hidden");
    expect(m.get("b")).toMatchObject({ kind: "unavailable", detail: "Fries is unavailable on the menu." });
    expect(m.get("c")?.kind).toBe("live");
  });
});

describe("priceCombo with a combo discount", () => {
  it("takes the percent off every unit and reports it as the saving", () => {
    const r = priceCombo(
      [item({ id: "a", price: "5.69" }), item({ id: "b", price: "2.00" }), item({ id: "c", price: "2.49" })],
      new Map(),
      false,
      "USD",
      2,
      10
    );
    // 5.12 + 1.80 + 2.24 (each unit rounded on its own, like checkout)
    expect(r.price).toBe("$9.16");
    expect(r.wasPrice).toBe("$10.18");
    expect(r.discount).toBe("10%");
  });
});

describe("applyComboDiscounts", () => {
  type Line = { menuItemId: string; quantity: number; price: Money; originalPrice: Money | null };
  const line = (menuItemId: string, quantity: number, price: string): Line => ({
    menuItemId,
    quantity,
    price: toMoney(price),
    originalPrice: null,
  });
  const rule = (id: string, discountPercent: number, items: [string, number][]) => ({
    id,
    discountPercent,
    items: items.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
  });
  const view = (lines: Line[]) =>
    lines.map((l) => [l.menuItemId, l.quantity, l.price.toString()]);

  const trio = rule("c1", 10, [["burger", 1], ["fries", 1], ["cola", 1]]);
  const cart = () => [line("burger", 1, "5.69"), line("fries", 1, "2.00"), line("cola", 1, "2.49")];

  it("discounts a cart holding every combo item and records the saving", () => {
    const r = applyComboDiscounts(cart(), [trio], 2);
    expect(view(r.lines)).toEqual([["burger", 1, "5.12"], ["fries", 1, "1.8"], ["cola", 1, "2.24"]]);
    expect(r.lines[0].originalPrice?.toString()).toBe("5.69");
    expect(r.savings.toString()).toBe("1.02");
  });

  it("gives nothing when one item is missing", () => {
    const r = applyComboDiscounts(cart().slice(0, 2), [trio], 2);
    expect(view(r.lines)).toEqual([["burger", 1, "5.69"], ["fries", 1, "2"]]);
    expect(r.savings.toString()).toBe("0");
  });

  it("splits a line when only some of its units complete a set", () => {
    const r = applyComboDiscounts(
      [line("burger", 2, "5.69"), line("fries", 1, "2.00"), line("cola", 1, "2.49")],
      [trio],
      2
    );
    expect(view(r.lines)).toEqual([
      ["burger", 1, "5.12"],
      ["burger", 1, "5.69"],
      ["fries", 1, "1.8"],
      ["cola", 1, "2.24"],
    ]);
  });

  it("applies once per full set", () => {
    const r = applyComboDiscounts(
      [line("burger", 3, "5.69"), line("fries", 2, "2.00"), line("cola", 2, "2.49")],
      [trio],
      2
    );
    expect(view(r.lines)).toEqual([
      ["burger", 2, "5.12"],
      ["burger", 1, "5.69"],
      ["fries", 2, "1.8"],
      ["cola", 2, "2.24"],
    ]);
  });

  it("honours combo quantities (2 × fries per set)", () => {
    const r = applyComboDiscounts(
      [line("burger", 1, "5.00"), line("fries", 3, "2.00")],
      [rule("c2", 20, [["burger", 1], ["fries", 2]])],
      2
    );
    expect(view(r.lines)).toEqual([["burger", 1, "4"], ["fries", 2, "1.6"], ["fries", 1, "2"]]);
  });

  it("lets the first combo claim shared items; a unit is never discounted twice", () => {
    const burgerCola = rule("c3", 50, [["burger", 1], ["cola", 1]]);
    const r = applyComboDiscounts(cart(), [trio, burgerCola], 2);
    expect(view(r.lines)).toEqual([["burger", 1, "5.12"], ["fries", 1, "1.8"], ["cola", 1, "2.24"]]);
  });

  it("ignores a combo with 0% and does not change the input", () => {
    const input = cart();
    const r = applyComboDiscounts(input, [rule("c4", 0, [["burger", 1]])], 2);
    expect(view(r.lines)).toEqual(view(input));
    expect(input[0].price.toString()).toBe("5.69");
  });
});

describe("comboUnitPrice", () => {
  it("rounds to the currency's minor units", () => {
    expect(comboUnitPrice("5.69", 10, 2).toString()).toBe("5.12");
    expect(comboUnitPrice("5.69", 10, 0).toString()).toBe("5");
  });
});