import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updatePurchaseOrderSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
    },
  });

  if (!purchaseOrder) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  return NextResponse.json(purchaseOrder);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, updatePurchaseOrderSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { supplierId, note, items, markOrdered } = parsed;

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }
  // Editing the supplier/items, or flipping to ORDERED, only makes sense
  // for a DRAFT — once ORDERED, the supplier has already been told what
  // was ordered (see PurchaseOrderStatus.ORDERED's schema note), and
  // RECEIVED/CANCELLED are terminal states with their own dedicated
  // paths (the /receive endpoint, or simply leaving a cancelled PO as
  // history).
  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only a DRAFT purchase order can be edited" },
      { status: 409 }
    );
  }

  const totalCost = items
    ? items.reduce((sum, line) => sum + line.quantityOrdered * line.costPerUnit, 0)
    : undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: items.map((line) => ({
            purchaseOrderId: id,
            inventoryItemId: line.inventoryItemId,
            quantityOrdered: line.quantityOrdered,
            costPerUnit: line.costPerUnit,
          })),
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(supplierId ? { supplierId } : {}),
          ...(note !== undefined ? { note: note || null } : {}),
          ...(totalCost !== undefined ? { totalCost: Math.round(totalCost * 100) / 100 } : {}),
          ...(markOrdered ? { status: "ORDERED", orderedAt: new Date() } : {}),
        },
        include: { items: true },
      });
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Couldn't update purchase order — check the supplier and item ids." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  // Cancelling is the universal "stop" action for anything not already
  // RECEIVED — a DRAFT no one sent, or an ORDERED PO the supplier
  // couldn't fulfill. Never a hard delete: a cancelled PO stays visible
  // as a record of what didn't happen, same "keep the audit trail"
  // reasoning as everywhere else in this schema. RECEIVED is excluded —
  // reversing a receipt after stock has already been credited would need
  // its own explicit stock-reversal flow (see StockMovement's RETURN
  // type), not a silent status flip.
  if (existing.status === "RECEIVED") {
    return NextResponse.json(
      { error: "A received purchase order can't be cancelled — its stock has already been credited." },
      { status: 409 }
    );
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}