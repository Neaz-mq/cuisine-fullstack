import { NextRequest } from "next/server";
import { orderRestockHandler } from "@/lib/inventory-api";

/**
 * POST /api/admin/kitchen/inventory/[id]/order — "Restock" in the Kitchen
 * panel. Creates a Pending purchase order and emails the supplier; it does
 * NOT change stock. Stock only rises when someone with the "inventory" scope
 * confirms the delivery, so the kitchen can ask for more but cannot edit the
 * numbers.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return orderRestockHandler(req, params, "kitchen");
}
