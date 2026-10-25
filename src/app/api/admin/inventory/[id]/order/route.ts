import { NextRequest } from "next/server";
import { orderRestockHandler } from "@/lib/inventory-api";

/**
 * POST /api/admin/inventory/[id]/order
 *
 * The Restock modal's "Confirm Restock": order more of an ingredient from a
 * supplier. Creates a Pending purchase order and emails the supplier — it does
 * NOT touch stock (see orderRestockSchema and lib/supplier-order.ts).
 *
 * The old `/restock` route (stock arrived, add it now) is still there for
 * anything that already calls it; the Restock modal no longer does.
 *
 * 201 → { purchaseOrder, supplierName, emailed, emailError? }. `emailed: false`
 * is not an error — the order exists and the Recent Deliveries row offers
 * "Resend".
 *
 * The logic lives in lib/inventory-api.ts, shared with the kitchen panel's
 * /api/admin/kitchen/inventory/[id]/order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return orderRestockHandler(req, params, "inventory");
}
