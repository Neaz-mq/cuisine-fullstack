import { NextRequest } from "next/server";
import { createInventoryItemHandler } from "@/lib/inventory-api";

/**
 * POST /api/admin/kitchen/inventory — "Add Ingredient" in the Kitchen panel.
 *
 * Same handler as /api/admin/inventory, but behind the "kitchen" scope: a
 * KITCHEN role has no "inventory" scope (and should not get one — that scope
 * also opens costs, edits and delivery confirmations). This route is the
 * narrow door the Figma Kitchen > Inventory page needs: add an ingredient,
 * and optionally order it from the supplier.
 */
export async function POST(req: NextRequest) {
  return createInventoryItemHandler(req, "kitchen");
}
