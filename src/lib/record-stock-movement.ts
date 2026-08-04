import { prisma } from "@/lib/prisma";

type ManualMovementType = "WASTAGE" | "ADJUSTMENT" | "RETURN";

type RecordResult =
  | { ok: true; movement: { id: string; resultingStock: number } }
  | { ok: false; error: "Inventory item not found" };

/**
 * src/lib/record-stock-movement.ts
 *
 * Applies a single manual stock change (wastage, a physical-count
 * adjustment, or a return) atomically: increments/decrements
 * InventoryItem.currentStock and writes the matching StockMovement row
 * in one DB transaction, so the two can never drift apart. This is the
 * manual counterpart to advanceOrderToPreparing.ts (automatic
 * deductions) and receivePurchaseOrder (automatic purchase credits) —
 * same transaction shape, used by
 * POST /api/admin/inventory/[id]/movements.
 *
 * `signedQuantity` must already be correctly signed by the caller
 * (positive to add stock, negative to remove it) — this function doesn't
 * re-derive the sign from `type`, since ADJUSTMENT can legally go either
 * direction (see recordStockMovementSchema's `direction` field in
 * validations/inventory.ts, which is where that sign gets decided).
 */
export async function recordStockMovement(params: {
  inventoryItemId: string;
  type: ManualMovementType;
  signedQuantity: number;
  note: string;
  createdById: string;
}): Promise<RecordResult> {
  const { inventoryItemId, type, signedQuantity, note, createdById } = params;

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { currentStock: { increment: signedQuantity } },
      });

      return tx.stockMovement.create({
        data: {
          type,
          quantityChange: signedQuantity,
          resultingStock: updatedItem.currentStock,
          note,
          inventoryItemId,
          createdById,
        },
      });
    });

    return { ok: true, movement };
  } catch {
    // Prisma throws (record-not-found) when inventoryItemId doesn't
    // exist — the only realistic failure mode here besides a transient
    // DB error, which the caller's own error handling covers.
    return { ok: false, error: "Inventory item not found" };
  }
}