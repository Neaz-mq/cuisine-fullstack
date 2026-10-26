/**
 * src/lib/sync-ingredient-tags.ts
 *
 * Keeps the customer-facing ingredient list on a dish (`MenuItem.ingredientTags`)
 * in step with the inventory item names it was built from.
 *
 * Why this exists: when a dish is saved, its recipe's ingredient NAMES are
 * copied into `ingredientTags` (that is the list customers see on the menu).
 * Without this, renaming "Test Chicken" → "Chicken Item" in Inventory would
 * leave "Test Chicken" on every dish that uses it, forever.
 *
 * Called from the inventory PATCH route, inside the same transaction as the
 * rename, so the two can never disagree.
 */
import type { Prisma } from "@/generated/prisma/client";

/**
 * Replaces `oldName` with `newName` in a tag list (case-insensitive match,
 * original position kept) and removes duplicates the rename may create —
 * e.g. a dish that already had a free-text "Chicken Item" tag.
 */
export function renameIngredientTag(tags: string[], oldName: string, newName: string): string[] {
  const from = oldName.trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const next = tag.trim().toLowerCase() === from ? newName.trim() : tag;
    const key = next.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(next);
  }
  return result;
}

/** Applies the rename to every dish whose recipe uses this inventory item. */
export async function syncIngredientTagsOnRename(
  tx: Prisma.TransactionClient,
  inventoryItemId: string,
  oldName: string,
  newName: string
): Promise<number> {
  if (oldName.trim().toLowerCase() === newName.trim().toLowerCase() && oldName === newName) return 0;

  const dishes = await tx.menuItem.findMany({
    where: { ingredients: { some: { inventoryItemId } } },
    select: { id: true, ingredientTags: true },
  });

  let updated = 0;
  for (const dish of dishes) {
    const next = renameIngredientTag(dish.ingredientTags, oldName, newName);
    const changed =
      next.length !== dish.ingredientTags.length || next.some((tag, i) => tag !== dish.ingredientTags[i]);
    if (!changed) continue;
    await tx.menuItem.update({ where: { id: dish.id }, data: { ingredientTags: next } });
    updated++;
  }
  return updated;
}
