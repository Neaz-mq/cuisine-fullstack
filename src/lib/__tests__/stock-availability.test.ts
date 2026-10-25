import { describe, expect, it } from "vitest";
import { calcDishStock, findCartShortages, stockBadge, type RecipeLine } from "@/lib/stock-availability";

const chicken = (qty: number): RecipeLine => ({ inventoryItemId: "chicken", name: "Chicken Breast", quantityRequired: qty });
const bun = (qty: number): RecipeLine => ({ inventoryItemId: "bun", name: "Burger Bun", quantityRequired: qty });

describe("calcDishStock", () => {
  it("no recipe = not limited", () => {
    expect(calcDishStock([], new Map())).toEqual({ servingsLeft: null, limitingIngredient: null });
  });

  it("20 Kg chicken at 0.5 Kg a serving = 40 servings", () => {
    expect(calcDishStock([chicken(0.5)], new Map([["chicken", 20]])).servingsLeft).toBe(40);
  });

  it("the scarcest ingredient decides", () => {
    const stock = new Map([["chicken", 20], ["bun", 3]]);
    expect(calcDishStock([chicken(0.5), bun(1)], stock)).toEqual({ servingsLeft: 3, limitingIngredient: "Burger Bun" });
  });

  it("negative or missing stock means sold out", () => {
    expect(calcDishStock([chicken(0.5)], new Map([["chicken", -2]])).servingsLeft).toBe(0);
    expect(calcDishStock([chicken(0.5)], new Map()).servingsLeft).toBe(0);
  });

  it("float noise does not lose a serving (0.3 / 0.1)", () => {
    expect(calcDishStock([chicken(0.1)], new Map([["chicken", 0.3]])).servingsLeft).toBe(3);
  });
});

describe("findCartShortages", () => {
  const recipes = new Map<string, RecipeLine[]>([
    ["grill", [chicken(0.5)]],
    ["wrap", [chicken(0.25)]],
  ]);

  it("passes when stock covers the cart", () => {
    expect(findCartShortages([{ menuItemId: "grill", quantity: 2 }], recipes, new Map([["chicken", 1]]))).toEqual([]);
  });

  it("blocks when one dish alone needs too much", () => {
    const out = findCartShortages([{ menuItemId: "grill", quantity: 3 }], recipes, new Map([["chicken", 1]]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ menuItemId: "grill", servingsLeft: 2 });
  });

  it("checks two dishes sharing an ingredient together", () => {
    // each fits alone (1 grill = 0.5, 3 wrap = 0.75 of 1 Kg) but not together (1.25)
    const cart = [{ menuItemId: "grill", quantity: 1 }, { menuItemId: "wrap", quantity: 3 }];
    expect(findCartShortages(cart, recipes, new Map([["chicken", 1]])).length).toBe(2);
  });

  it("ignores dishes with no recipe", () => {
    expect(findCartShortages([{ menuItemId: "soda", quantity: 99 }], recipes, new Map())).toEqual([]);
  });
});

describe("stockBadge", () => {
  it("labels sold out, low and fine", () => {
    expect(stockBadge(0)).toBe("sold-out");
    expect(stockBadge(3)).toBe("low");
    expect(stockBadge(6)).toBeNull();
    expect(stockBadge(null)).toBeNull();
  });
});
