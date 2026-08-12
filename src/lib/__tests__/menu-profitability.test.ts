import { describe, it, expect } from "vitest";
import { calculateFoodCost, getFoodCostHealth } from "@/lib/menu-profitability";

describe("calculateFoodCost", () => {
  it("sums quantityRequired x costPerUnit across the recipe", () => {
    // 250g rice @ $0.002/g + 200g chicken @ $0.008/g + 15g spices @ $0.02/g
    // = $0.50 + $1.60 + $0.30 = $2.40
    const result = calculateFoodCost(
      [
        { quantityRequired: 250, costPerUnit: 0.002 },
        { quantityRequired: 200, costPerUnit: 0.008 },
        { quantityRequired: 15, costPerUnit: 0.02 },
      ],
      12.99
    );
    expect(result.foodCost).toBeCloseTo(2.4, 2);
    expect(result.hasRecipe).toBe(true);
  });

  it("computes foodCostPercent relative to price", () => {
    // $4 food cost on a $10 item = 40%
    const result = calculateFoodCost([{ quantityRequired: 1, costPerUnit: 4 }], 10);
    expect(result.foodCostPercent).toBeCloseTo(40, 5);
    expect(result.grossMargin).toBeCloseTo(6, 2);
  });

  it("marks hasRecipe false for an empty recipe, distinct from a $0 recipe", () => {
    const noRecipe = calculateFoodCost([], 10);
    expect(noRecipe.hasRecipe).toBe(false);
    expect(noRecipe.foodCost).toBe(0);

    const zeroCostRecipe = calculateFoodCost([{ quantityRequired: 1, costPerUnit: 0 }], 10);
    expect(zeroCostRecipe.hasRecipe).toBe(true);
    expect(zeroCostRecipe.foodCost).toBe(0);
  });

  it("returns null foodCostPercent when price is 0, never divides by zero", () => {
    const result = calculateFoodCost([{ quantityRequired: 1, costPerUnit: 5 }], 0);
    expect(result.foodCostPercent).toBeNull();
    // Margin is still computable (price - foodCost), just the percent isn't.
    expect(result.grossMargin).toBeCloseTo(-5, 2);
  });

  it("rounds dollar figures to cents", () => {
    const result = calculateFoodCost(
      [{ quantityRequired: 3, costPerUnit: 0.10333 }],
      10
    );
    // 3 x 0.10333 = 0.30999 -> rounds to 0.31
    expect(result.foodCost).toBe(0.31);
  });
});

describe("getFoodCostHealth", () => {
  it("classifies below 35% as healthy", () => {
    expect(getFoodCostHealth(20)).toBe("healthy");
    expect(getFoodCostHealth(34.9)).toBe("healthy");
  });

  it("classifies 35%-44.9% as watch", () => {
    expect(getFoodCostHealth(35)).toBe("watch");
    expect(getFoodCostHealth(44.9)).toBe("watch");
  });

  it("classifies 45% and above as critical", () => {
    expect(getFoodCostHealth(45)).toBe("critical");
    expect(getFoodCostHealth(60)).toBe("critical");
  });

  it("classifies null (no recipe or $0 price) as unknown, not healthy", () => {
    expect(getFoodCostHealth(null)).toBe("unknown");
  });
});