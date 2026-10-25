/**
 * src/lib/recipe-units.ts
 *
 * Recipe quantity unit helpers — industry style: a cook writes "500 g" in the
 * recipe even though the pantry tracks the item in Kg. Stock is ALWAYS stored
 * and deducted in the InventoryItem's own unit (see advance-order-to-preparing.ts),
 * so the recipe form converts what the cook typed into that unit before saving.
 *
 * Only same-family conversion is allowed (g ↔ Kg, ml ↔ L). Mass can't become
 * volume without a density, and pieces can't become either.
 */

export type RecipeUnit = "GRAM" | "KILOGRAM" | "MILLILITER" | "LITER" | "PIECE";

const FAMILY: Record<RecipeUnit, { family: "mass" | "volume" | "count"; perSmallest: number }> = {
  GRAM: { family: "mass", perSmallest: 1 },
  KILOGRAM: { family: "mass", perSmallest: 1000 },
  MILLILITER: { family: "volume", perSmallest: 1 },
  LITER: { family: "volume", perSmallest: 1000 },
  PIECE: { family: "count", perSmallest: 1 },
};

export function isRecipeUnit(value: string): value is RecipeUnit {
  return value in FAMILY;
}

/** Units a recipe line may be entered in for an inventory item tracked in `stockUnit`. */
export function compatibleUnits(stockUnit: RecipeUnit): RecipeUnit[] {
  const { family } = FAMILY[stockUnit];
  return (Object.keys(FAMILY) as RecipeUnit[]).filter((unit) => FAMILY[unit].family === family);
}

/** Float-noise-free rounding (0.1 + 0.2 style artefacts) — 6 decimals is plenty for kitchen use. */
export function roundQuantity(value: number): number {
  return Number(value.toFixed(6));
}

/** Convert between two units of the same family. Returns NaN for incompatible units. */
export function convertQuantity(quantity: number, from: RecipeUnit, to: RecipeUnit): number {
  if (FAMILY[from].family !== FAMILY[to].family) return NaN;
  return roundQuantity((quantity * FAMILY[from].perSmallest) / FAMILY[to].perSmallest);
}

/**
 * How to SHOW a stored quantity: 0.5 Kg reads better as 500 g, 0.25 L as 250 ml.
 * Anything else stays in the stock unit.
 */
export function toDisplayQuantity(
  quantity: number,
  stockUnit: RecipeUnit
): { value: number; unit: RecipeUnit } {
  if (stockUnit === "KILOGRAM" && quantity > 0 && quantity < 1) {
    return { value: convertQuantity(quantity, "KILOGRAM", "GRAM"), unit: "GRAM" };
  }
  if (stockUnit === "LITER" && quantity > 0 && quantity < 1) {
    return { value: convertQuantity(quantity, "LITER", "MILLILITER"), unit: "MILLILITER" };
  }
  return { value: roundQuantity(quantity), unit: stockUnit };
}
