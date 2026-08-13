/**
 * src/lib/menu-profitability.ts
 *
 * Food cost % and gross margin per menu item — computed entirely from
 * data the app already tracks (MenuItemIngredient recipe quantities +
 * InventoryItem.costPerUnit, both introduced for the Inventory Management
 * feature). No new schema, no new migration: this is a read-only view
 * over existing tables, same spirit as loyalty-tiers.ts deriving tier
 * from an existing balance instead of storing one.
 *
 * Pure functions only — no Prisma import here — so this file (and its
 * tests) never need a database connection. The Prisma-touching fetch
 * lives in the admin insights page itself, mirroring how
 * checkout-validation.test.ts and loyalty-tiers.test.ts keep the
 * arithmetic testable in isolation from the DB. lib/money.ts is the one
 * import, and it is itself pure.
 */
import { type Money, toMoney, ZERO, sum } from "@/lib/money";

export interface RecipeLine {
  /** Quantity of the ingredient consumed per ONE unit of the menu item sold.
   *  এখনো Float — পরিমাণ, টাকা নয়। migration-এর মন্তব্য দ্রষ্টব্য। */
  quantityRequired: number;
  /** InventoryItem.costPerUnit — latest known cost per unit of that ingredient. */
  costPerUnit: Money | number;
}

export interface FoodCostResult {
  /** Total ingredient cost to make ONE unit of the menu item. */
  foodCost: Money;
  /**
   * Food cost as a percentage of the selling price. Null when the price
   * is 0 (division by zero has no meaningful percentage) — callers should
   * treat null as "cannot compute", not as 0%.
   */
  foodCostPercent: number | null;
  /** Selling price minus food cost — the gross profit on ONE unit sold. */
  grossMargin: Money;
  /**
   * True when the item has no recipe configured (ingredients array was
   * empty) — distinct from a recipe that legitimately costs $0, so the UI
   * can show "No recipe set" instead of a misleading 100% margin.
   */
  hasRecipe: boolean;
}

/**
 * Food cost for one unit of a menu item, given its recipe (list of
 * ingredient quantity + that ingredient's current cost per unit) and its
 * selling price. Rounds the dollar figures to cents; leaves
 * foodCostPercent unrounded (the UI rounds it for display) so a caller
 * that wants to sort/compare percentages isn't working off pre-rounded
 * values.
 */
export function calculateFoodCost(
  recipe: RecipeLine[],
  price: Money | number
): FoodCostResult {
  const hasRecipe = recipe.length > 0;
  const sellingPrice = toMoney(price);

  // ইচ্ছাকৃতভাবে round করা হয় না। এটা রিপোর্টিং — বিক্রির চালান নয় —
  // আর ৫০০টা পদের উপর যোগ করার আগে প্রতিটাকে দুই দশমিকে কেটে ফেললে
  // মোট food cost বাস্তব থেকে সরে যেতো। UI যেখানে দেখাবে সেখানেই
  // formatMoney() দিয়ে round করবে।
  const foodCost = sum(...recipe.map((l) => toMoney(l.costPerUnit).times(l.quantityRequired)));

  const foodCostPercent = sellingPrice.greaterThan(ZERO)
    ? foodCost.dividedBy(sellingPrice).times(100).toNumber()
    : null;

  return {
    foodCost,
    foodCostPercent,
    grossMargin: sellingPrice.minus(foodCost),
    hasRecipe,
  };
}

/**
 * Health label for a food-cost percentage, used to color-code the
 * profitability table. Thresholds follow common restaurant-industry
 * guidance (ideal food cost is roughly 28-35% of the menu price); items
 * without a computable percentage (no recipe, or $0 price) are "unknown"
 * rather than silently sorted as if they were healthy.
 */
export type FoodCostHealth = "healthy" | "watch" | "critical" | "unknown";

const WATCH_THRESHOLD_PERCENT = 35;
const CRITICAL_THRESHOLD_PERCENT = 45;

export function getFoodCostHealth(foodCostPercent: number | null): FoodCostHealth {
  if (foodCostPercent === null) return "unknown";
  if (foodCostPercent >= CRITICAL_THRESHOLD_PERCENT) return "critical";
  if (foodCostPercent >= WATCH_THRESHOLD_PERCENT) return "watch";
  return "healthy";
}