import { prisma } from "@/lib/prisma";

type ReceiveResult =
  | { ok: true; purchaseOrder: { id: string; status: string } }
  | {
      ok: false;
      error:
        | "Purchase order not found"
        | "The supplier hasn't accepted this order yet"
        | "Only an order that is on the way can be received"
        | "Received items don't match this purchase order's line items";
    };

/** Thrown inside the transaction to roll it back when someone else got there first. */
class NotOnTheWayError extends Error {}

/**
 * src/lib/receive-purchase-order.ts
 *
 * Moves a PurchaseOrder from ON_THE_WAY ("On the Way") to RECEIVED
 * ("Delivered") and, in the same DB transaction: credits
 * InventoryItem.currentStock for each line by its
 * ACTUAL received quantity (not necessarily what was ordered — see
 * PurchaseOrderItem.quantityReceived's schema note on short deliveries),
 * writes one StockMovement (type: PURCHASE) per line actually received,
 * and rolls each line's costPerUnit forward onto
 * InventoryItem.costPerUnit (most-recent-purchase-price wins — see
 * PurchaseOrderItem.costPerUnit's schema note).
 *
 * `received` omitted = "everything arrived as ordered" (the one-click
 * "Confirm delivery" button). Pass it to record a short delivery.
 *
 * ⚠️ Only an order the SUPPLIER HAS ACCEPTED can be received (ON_THE_WAY).
 * A Pending order (ORDERED) is still waiting on them — crediting stock for
 * something nobody has agreed to deliver would make the Inventory screen lie.
 *
 * ⚠️ The status flip is the FIRST thing inside the transaction, as a
 * conditional update (… WHERE status = 'ON_THE_WAY'). The read-only guard
 * below gives a friendly error, but it can't stop two people pressing
 * "Confirm delivery" at the same moment — both would pass it and the stock
 * would be credited twice. With the claim inside the transaction, only one
 * of them gets count = 1; the other is rolled back untouched.
 *
 * Mirrors advanceOrderToPreparing.ts's shape: guard checks first
 * (outside the transaction, read-only), then a single $transaction that
 * has to succeed or fail as a unit.
 */
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  received: { inventoryItemId: string; quantityReceived: number }[] | undefined,
  receivedById: string
): Promise<ReceiveResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      items: {
        select: { id: true, inventoryItemId: true, costPerUnit: true, quantityOrdered: true },
      },
    },
  });

  if (!po) {
    return { ok: false, error: "Purchase order not found" };
  }
  if (po.status === "ORDERED") {
    return { ok: false, error: "The supplier hasn't accepted this order yet" };
  }
  if (po.status !== "ON_THE_WAY") {
    return { ok: false, error: "Only an order that is on the way can be received" };
  }

  // No explicit quantities = a full delivery, line by line as ordered.
  const lines =
    received ??
    po.items.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      quantityReceived: line.quantityOrdered,
    }));

  // Every line on the PO must be accounted for in the receiving payload —
  // even a genuinely short/failed line needs an explicit "0 received"
  // entry rather than being silently missing — and nothing outside the
  // PO's own lines is accepted.
  const poItemIds = new Set(po.items.map((i) => i.inventoryItemId));
  const receivedIds = new Set(lines.map((r) => r.inventoryItemId));
  const matches =
    poItemIds.size === receivedIds.size &&
    lines.length === receivedIds.size &&
    [...poItemIds].every((id) => receivedIds.has(id));
  if (!matches) {
    return {
      ok: false,
      error: "Received items don't match this purchase order's line items",
    };
  }

  const receivedByItemId = new Map(lines.map((r) => [r.inventoryItemId, r.quantityReceived]));

  let updated: { id: string; status: string };
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Claim the order first — see the note above the function.
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: purchaseOrderId, status: "ON_THE_WAY" },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      if (claimed.count !== 1) throw new NotOnTheWayError();

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

      return { id: purchaseOrderId, status: "RECEIVED" };
    });
  } catch (error) {
    if (error instanceof NotOnTheWayError) {
      return { ok: false, error: "Only an order that is on the way can be received" };
    }
    throw error;
  }

  return { ok: true, purchaseOrder: updated };
}
