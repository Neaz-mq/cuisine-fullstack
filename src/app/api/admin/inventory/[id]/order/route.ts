import { NextRequest, NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { orderRestockSchema } from "@/lib/validations/inventory";
import { placeSupplierOrder } from "@/lib/supplier-order";

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
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, orderRestockSchema);
  if (parsed instanceof NextResponse) return parsed;

  const result = await placeSupplierOrder({
    inventoryItemId: id,
    supplierId: parsed.supplierId,
    quantity: parsed.quantity,
    costPerUnit: parsed.costPerUnit,
    note: parsed.note,
    createdById: authResult.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      purchaseOrder: result.purchaseOrder,
      supplierName: result.supplierName,
      emailed: result.emailed,
      ...(result.emailError ? { emailError: result.emailError } : {}),
    },
    { status: 201 }
  );
}
