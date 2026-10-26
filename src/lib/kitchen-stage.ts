/**
 * src/lib/kitchen-stage.ts
 *
 * Which column of the Kitchen Display an order belongs to.
 *
 * The kitchen only ever sees an order AFTER the admin has pressed
 * "Move to Kitchen" on the Orders list. That press moves the order from
 * PLACED to PREPARING (stock is deducted there, see
 * advance-order-to-preparing.ts). Orders that are still PLACED are waiting
 * for admin approval and are NOT part of the kitchen at all.
 *
 * Inside the kitchen an order then goes through three stages:
 *
 *   QUEUED     status PREPARING, kitchenStartedAt = null
 *              -> "Recent Order" column (admin sent it, nobody has started)
 *   PREPARING  status PREPARING, kitchenStartedAt set
 *              -> "Preparing" column (kitchen pressed "Start Preparing")
 *   READY      status READY
 *              -> "Ready" column
 *
 * `kitchenStartedAt` is the only extra piece of state; it is written by
 * POST /api/admin/kitchen/orders/[id]/start.
 */
export type KitchenStage = "QUEUED" | "PREPARING" | "READY";

export function kitchenStageOf(order: {
  status: string;
  kitchenStartedAt?: Date | string | null;
}): KitchenStage | null {
  if (order.status === "READY") return "READY";
  if (order.status === "PREPARING") {
    return order.kitchenStartedAt ? "PREPARING" : "QUEUED";
  }
  // PLACED (not approved yet), OUT_FOR_DELIVERY, DELIVERED, CANCELLED:
  // not on the kitchen board.
  return null;
}

/** The toolbar's `status` URL param -> the board stage it filters on. */
export const KITCHEN_FILTER_TO_STAGE: Record<
  "placed" | "preparing" | "ready",
  KitchenStage
> = {
  placed: "QUEUED",
  preparing: "PREPARING",
  ready: "READY",
};

/**
 * The status the CUSTOMER should see.
 *
 * The moment the admin presses "Move to Kitchen" the order is PREPARING in
 * the database (stock is deducted there), but the kitchen has not started
 * cooking until it presses "Start Preparing" (kitchenStartedAt). Until then
 * the customer still sees the order as placed; "Preparing" appears only once
 * the kitchen really starts. Every other status is shown as it is.
 */
export function customerFacingStatus<S extends string>(
  status: S,
  kitchenStartedAt?: Date | string | null
): S | "PLACED" {
  return status === "PREPARING" && !kitchenStartedAt ? "PLACED" : status;
}