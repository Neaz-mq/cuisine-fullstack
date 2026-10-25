/**
 * src/lib/stock-availability-db.ts
 *
 * The database half of stock-availability.ts: loads recipes + stock and
 * subtracts food already promised to open orders. Server-only.
 */
import { prisma } from "@/lib/prisma";
import {
  calcDishStock,
  findCartShortages,
  type CartLine,
  type DishStock,
  type RecipeLine,
  type StockShortage,
} from "@/lib/stock-availability";

/**
 * An ONLINE order that hasn't been paid yet still "holds" its food while the
 * customer is on Stripe's page — but only for this long. After that it's an
 * abandoned cart and must not lock up stock forever.
 */
const UNPAID_ONLINE_HOLD_MS = 30 * 60 * 1000;

async function loadRecipes(menuItemIds?: string[]): Promise<Map<string, RecipeLine[]>> {
  const rows = await prisma.menuItemIngredient.findMany({
    where: menuItemIds ? { menuItemId: { in: menuItemIds } } : undefined,
    select: {
      menuItemId: true,
      quantityRequired: true,
      inventoryItem: { select: { id: true, name: true } },
    },
  });

  const recipes = new Map<string, RecipeLine[]>();
  for (const row of rows) {
    const list = recipes.get(row.menuItemId) ?? [];
    list.push({
      inventoryItemId: row.inventoryItem.id,
      name: row.inventoryItem.name,
      quantityRequired: row.quantityRequired,
    });
    recipes.set(row.menuItemId, list);
  }
  return recipes;
}

/**
 * On-hand stock minus what open orders have already been promised.
 * Keyed by inventory item id, in each item's own unit.
 */
async function loadAvailableStock(inventoryItemIds: string[]): Promise<Map<string, number>> {
  const available = new Map<string, number>();
  if (inventoryItemIds.length === 0) return available;

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: inventoryItemIds } },
    select: { id: true, currentStock: true, isActive: true },
  });
  // An inactive (discontinued) ingredient counts as none left.
  for (const item of items) available.set(item.id, item.isActive ? item.currentStock : 0);

  // Food promised to orders that haven't hit PREPARING yet (stock not deducted).
  const holdCutoff = new Date(Date.now() - UNPAID_ONLINE_HOLD_MS);
  const openOrderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: "PLACED",
        stockDeductedAt: null,
        OR: [
          { paymentMethod: "COD" },
          { paymentStatus: "PAID" },
          { paymentMethod: "ONLINE", paymentStatus: "PENDING", createdAt: { gte: holdCutoff } },
        ],
      },
      menuItem: { ingredients: { some: { inventoryItemId: { in: inventoryItemIds } } } },
    },
    select: {
      quantity: true,
      menuItem: { select: { ingredients: { select: { inventoryItemId: true, quantityRequired: true } } } },
    },
  });

  for (const orderItem of openOrderItems) {
    for (const line of orderItem.menuItem.ingredients) {
      if (!available.has(line.inventoryItemId)) continue;
      available.set(
        line.inventoryItemId,
        (available.get(line.inventoryItemId) ?? 0) - line.quantityRequired * orderItem.quantity
      );
    }
  }
  return available;
}

/**
 * Servings left for each dish. Dishes without a recipe are simply absent from
 * the map's "limited" entries — they come back as `servingsLeft: null`.
 * Pass no ids to compute every dish that has a recipe.
 */
export async function getDishStockMap(menuItemIds?: string[]): Promise<Map<string, DishStock>> {
  const recipes = await loadRecipes(menuItemIds);
  const inventoryIds = [...new Set([...recipes.values()].flat().map((l) => l.inventoryItemId))];
  const available = await loadAvailableStock(inventoryIds);

  const result = new Map<string, DishStock>();
  for (const [menuItemId, lines] of recipes) result.set(menuItemId, calcDishStock(lines, available));
  return result;
}

/** Convenience for one dish. */
export function dishStockOf(map: Map<string, DishStock>, menuItemId: string): DishStock {
  return map.get(menuItemId) ?? { servingsLeft: null, limitingIngredient: null };
}

/** Checkout guard — which dishes in this cart can't be served from current stock. */
export async function findStockShortages(cart: CartLine[]): Promise<StockShortage[]> {
  const ids = [...new Set(cart.map((line) => line.menuItemId))];
  const recipes = await loadRecipes(ids);
  const inventoryIds = [...new Set([...recipes.values()].flat().map((l) => l.inventoryItemId))];
  const available = await loadAvailableStock(inventoryIds);
  return findCartShortages(cart, recipes, available);
}
