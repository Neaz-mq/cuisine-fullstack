import { prisma } from "@/lib/prisma";

type ReceiveResult =
  | { ok: true; purchaseOrder: { id: string; status: string } }
  | {
      ok: false;
      error:
        | "Purchase order not found"
        | "Only an ORDERED purchase order can be received"
        | "Received items don't match this purchase order's line items";
    };

/**
 * src/lib/receive-purchase-order.ts
 *
 * Moves a PurchaseOrder from ORDERED to RECEIVED and, in the same DB
 * transaction: credits InventoryItem.currentStock for each line by its
 * ACTUAL received quantity (not necessarily what was ordered — see
 * PurchaseOrderItem.quantityReceived's schema note on short deliveries),
 * writes one StockMovement (type: PURCHASE) per line actually received,
 * and rolls each line's costPerUnit forward onto
 * InventoryItem.costPerUnit (most-recent-purchase-price wins — see
 * PurchaseOrderItem.costPerUnit's schema note).
 *
 * Mirrors advanceOrderToPreparing.ts's shape: guard checks first
 * (outside the transaction, read-only), then a single $transaction that
 * has to succeed or fail as a unit.
 */
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  received: { inventoryItemId: string; quantityReceived: number }[],
  receivedById: string
): Promise<ReceiveResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      items: { select: { id: true, inventoryItemId: true, costPerUnit: true } },
    },
  });

  if (!po) {
    return { ok: false, error: "Purchase order not found" };
  }
  if (po.status !== "ORDERED") {
    return { ok: false, error: "Only an ORDERED purchase order can be received" };
  }

  // Every line on the PO must be accounted for in the receiving payload —
  // even a genuinely short/failed line needs an explicit "0 received"
  // entry rather than being silently missing — and nothing outside the
  // PO's own lines is accepted.
  const poItemIds = new Set(po.items.map((i) => i.inventoryItemId));
  const receivedIds = new Set(received.map((r) => r.inventoryItemId));
  const matches =
    poItemIds.size === receivedIds.size && [...poItemIds].every((id) => receivedIds.has(id));
  if (!matches) {
    return {
      ok: false,
      error: "Received items don't match this purchase order's line items",
    };
  }

  const receivedByItemId = new Map(received.map((r) => [r.inventoryItemId, r.quantityReceived]));

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of po.items) {
      const quantityReceived = receivedByItemId.get(line.inventoryItemId)!;

      await tx.purchaseOrderItem.update({
        where: { id: line.id },
        data: { quantityReceived },
      });

      // A 0-received line updates the PO record above (so the shortfall
      // is visible on the PO itself) but doesn't touch stock or write a
      // StockMovement row — there's nothing to credit.
      if (quantityReceived > 0) {
        const updatedItem = await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            currentStock: { increment: quantityReceived },
            costPerUnit: line.costPerUnit,
          },
        });

        await tx.stockMovement.create({
          data: {
            type: "PURCHASE",
            quantityChange: quantityReceived,
            resultingStock: updatedItem.currentStock,
            inventoryItemId: line.inventoryItemId,
            createdById: receivedById,
          },
        });
      }
    }

    return tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "RECEIVED", receivedAt: new Date() },
      select: { id: true, status: true },
    });
  });

  return { ok: true, purchaseOrder: updated };
}