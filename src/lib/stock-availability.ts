/**
 * src/lib/stock-availability.ts
 *
 * "Can we actually make this dish right now?" — the logic behind
 *   1. auto Sold-Out (a dish whose ingredients ran out is hidden from ordering)
 *   2. the check at checkout that refuses an order the kitchen can't cook.
 *
 * Industry practice (Toast, Square, Lightspeed "86 list"): the owner's manual
 * Available/Unavailable switch is NEVER overwritten by the system. Sold-out is
 * DERIVED on every read from stock, so the moment a delivery is received the
 * dish is orderable again — nobody has to remember to switch it back on.
 *
 * ── "Available stock" = on hand − already promised ──────────────────────
 * Stock is only deducted when an order reaches PREPARING
 * (advance-order-to-preparing.ts). Orders that are PLACED but not yet
 * preparing have already been promised food, so they are subtracted here;
 * otherwise 10 customers could each order the last 2 burgers.
 *
 * Dishes WITHOUT a recipe are never limited (no stock data → no claim).
 *
 * The pure maths lives at the top (no Prisma, safe to unit-test and to import
 * from client code); the database part is at the bottom.
 */

export type RecipeLine = { inventoryItemId: string; name: string; quantityRequired: number };
export type DishRecipe = { menuItemId: string; lines: RecipeLine[] };

export type DishStock = {
  /** null = no recipe, so no limit. Otherwise how many servings can still be made. */
  servingsLeft: number | null;
  /** The ingredient that runs out first (only when servingsLeft is not null). */
  limitingIngredient: string | null;
};

/** A dish counts as "running low" at or below this many servings. */
export const LOW_SERVINGS_THRESHOLD = 5;

/** Float noise guard: 0.1 + 0.2 style leftovers must not turn 3 servings into 2. */
const EPSILON = 1e-9;

/**
 * Servings makeable from `available` stock (ingredient id → amount in the
 * item's own unit). Negative or missing stock counts as 0.
 */
export function calcDishStock(lines: RecipeLine[], available: Map<string, number>): DishStock {
  if (lines.length === 0) return { servingsLeft: null, limitingIngredient: null };

  let servingsLeft = Infinity;
  let limiting: string | null = null;
  for (const line of lines) {
    if (!(line.quantityRequired > 0)) continue; // a 0-quantity line limits nothing
    const have = Math.max(0, available.get(line.inventoryItemId) ?? 0);
    const servings = Math.floor(have / line.quantityRequired + EPSILON);
    if (servings < servingsLeft) {
      servingsLeft = servings;
      limiting = line.name;
    }
  }

  if (servingsLeft === Infinity) return { servingsLeft: null, limitingIngredient: null };
  return { servingsLeft, limitingIngredient: limiting };
}

export type CartLine = { menuItemId: string; quantity: number };

export type StockShortage = {
  menuItemId: string;
  /** How many servings of this dish can still be made (0 = sold out). */
  servingsLeft: number;
  /** Ingredient that is the bottleneck, for staff-facing messages. */
  limitingIngredient: string | null;
};

/**
 * Checks a WHOLE cart against available stock. Two dishes that share an
 * ingredient (two chicken dishes) are checked together — checking each line
 * alone would pass a cart that together needs more chicken than exists.
 *
 * Returns one entry per dish that can't be fully served; empty = cart is fine.
 */
export function findCartShortages(
  cart: CartLine[],
  recipes: Map<string, RecipeLine[]>,
  available: Map<string, number>
): StockShortage[] {
  // total quantity per dish (the same dish may appear on several lines)
  const qtyByDish = new Map<string, number>();
  for (const line of cart) {
    qtyByDish.set(line.menuItemId, (qtyByDish.get(line.menuItemId) ?? 0) + line.quantity);
  }

  // total ingredient demand of the whole cart
  const demand = new Map<string, number>();
  for (const [menuItemId, qty] of qtyByDish) {
    for (const line of recipes.get(menuItemId) ?? []) {
      demand.set(line.inventoryItemId, (demand.get(line.inventoryItemId) ?? 0) + line.quantityRequired * qty);
    }
  }

  const shortages: StockShortage[] = [];
  for (const [menuItemId] of qtyByDish) {
    const lines = recipes.get(menuItemId) ?? [];
    const short = lines.some((line) => {
      const have = Math.max(0, available.get(line.inventoryItemId) ?? 0);
      return (demand.get(line.inventoryItemId) ?? 0) > have + EPSILON;
    });
    if (!short) continue;

    const alone = calcDishStock(lines, available);
    shortages.push({
      menuItemId,
      servingsLeft: alone.servingsLeft ?? 0,
      limitingIngredient: alone.limitingIngredient,
    });
  }
  return shortages;
}

/** Customer-facing wording: "Sold out" / "Only 3 left" / nothing. */
export function stockBadge(servingsLeft: number | null): "sold-out" | "low" | null {
  if (servingsLeft === null) return null;
  if (servingsLeft <= 0) return "sold-out";
  if (servingsLeft <= LOW_SERVINGS_THRESHOLD) return "low";
  return null;
}
