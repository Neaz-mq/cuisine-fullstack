/**
 * src/lib/advance-order-to-preparing.ts
 *
 * Moves an order to PREPARING and, in the same DB transaction, deducts
 * every recipe ingredient (MenuItemIngredient) its line items consume
 * from InventoryItem.currentStock — writing one StockMovement
 * (ORDER_DEDUCTION) ledger row per ingredient actually consumed.
 *
 * Mirrors mark-order-delivered.ts's shape: a status transition plus a
 * side effect that has to succeed or fail together, pulled into its own
 * file so both the admin status dropdown (PATCH /api/orders/[id]) and any
 * future kitchen-board "start preparing" action share one implementation.
 */
import { prisma } from "@/lib/prisma";

type AdvanceResult =
  | { ok: true; order: { id: string; status: string }; deducted: boolean }
  | { ok: false; error: "Order not found" | "Cannot prepare a cancelled order" };

export async function advanceOrderToPreparing(orderId: string): Promise<AdvanceResult> {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      items: {
        select: {
          quantity: true,
          menuItem: {
            select: {
              ingredients: {
                select: { inventoryItemId: true, quantityRequired: true },
              },
            },
          },
        },
      },
    },
  });

  if (!existingOrder) {
    return { ok: false, error: "Order not found" };
  }
  if (existingOrder.status === "CANCELLED") {
    return { ok: false, error: "Cannot prepare a cancelled order" };
  }

  // Guard against double-deduction (e.g. an order bounced PREPARING ->
  // PLACED -> PREPARING again by mistake) by checking the ledger itself
  // rather than adding another boolean flag to Order — StockMovement is
  // already the source of truth for "did this happen", same reasoning as
  // the model-level comments on StockMovement/InventoryItem.
  const alreadyDeducted = await prisma.stockMovement.findFirst({
    where: { orderId, type: "ORDER_DEDUCTION" },
    select: { id: true },
  });

  // Aggregate how much of each InventoryItem this order consumes across
  // ALL its line items first — two different menu items in the same
  // order might both draw from the same ingredient (e.g. two dishes that
  // both use rice), and that should be one ledger row per ingredient, not
  // one per menu item that happens to use it.
  const required = new Map<string, number>();
  if (!alreadyDeducted) {
    for (const item of existingOrder.items) {
      for (const ingredient of item.menuItem.ingredients) {
        const needed = ingredient.quantityRequired * item.quantity;
        required.set(
          ingredient.inventoryItemId,
          (required.get(ingredient.inventoryItemId) ?? 0) + needed
        );
      }
    }
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: "PREPARING" },
      select: { id: true, status: true },
    });

    for (const [inventoryItemId, quantityChange] of required) {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { currentStock: { decrement: quantityChange } },
      });

      // currentStock is allowed to go negative here rather than blocking
      // the status change — by the time an order is marked PREPARING the
      // kitchen is already using the ingredients regardless of what the
      // ledger says. A negative currentStock is a signal for the
      // low-stock dashboard to investigate (stale reorderThreshold,
      // uncounted wastage, a missing PURCHASE entry), not something this
      // endpoint should refuse an order over.
      await tx.stockMovement.create({
        data: {
          type: "ORDER_DEDUCTION",
          quantityChange: -quantityChange,
          resultingStock: updatedItem.currentStock,
          inventoryItemId,
          orderId,
        },
      });
    }

    return order;
  });

  return { ok: true, order: updatedOrder, deducted: required.size > 0 };
}