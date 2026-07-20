/**
 * src/lib/mark-order-delivered.ts
 *
 * The "award loyalty points on first DELIVERED" logic used to live only
 * inside PATCH /api/orders/[id] (the admin order-status dropdown). Now
 * that riders can ALSO mark an order delivered from their own dashboard
 * (POST /api/rider/deliveries/[orderId]/deliver), that logic is pulled
 * out here so both call sites share one implementation — otherwise a
 * future change to the points formula only fixed in one place would
 * silently break the other.
 */
import { prisma } from "@/lib/prisma";

// 1 loyalty point per $10 spent, rounded down. Kept in sync with the
// same constant name/value that used to live inline in
// PATCH /api/orders/[id] — do not change independently of that history.
const POINTS_PER_CURRENCY_UNIT = 10;

/**
 * Moves an order to DELIVERED, awarding loyalty points exactly once (only
 * for orders placed by a logged-in user, and only the first time they
 * reach DELIVERED — `pointsAwarded` guards against double-crediting if a
 * status is reverted and re-delivered by mistake).
 *
 * Also closes out DeliveryTracking.deliveredAt when the order has a rider
 * assigned, so the rider's dashboard and the customer's live map both
 * know the delivery is over and can stop polling for position updates.
 */
export async function markOrderDelivered(orderId: string) {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, totalAmount: true, pointsAwarded: true, status: true },
  });

  if (!existingOrder) {
    return { ok: false as const, error: "Order not found" as const };
  }
  if (existingOrder.status === "CANCELLED") {
    return { ok: false as const, error: "Cannot deliver a cancelled order" as const };
  }

  const shouldAwardPoints =
    !existingOrder.pointsAwarded && !!existingOrder.userId;

  const pointsEarned = shouldAwardPoints
    ? Math.floor(existingOrder.totalAmount / POINTS_PER_CURRENCY_UNIT)
    : 0;

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "DELIVERED", pointsAwarded: shouldAwardPoints ? true : undefined },
    }),
    ...(shouldAwardPoints && pointsEarned > 0
      ? [
          prisma.user.update({
            where: { id: existingOrder.userId as string },
            data: { loyaltyPoints: { increment: pointsEarned } },
          }),
          prisma.loyaltyTransaction.create({
            data: {
              points: pointsEarned,
              reason: "ORDER_DELIVERED" as const,
              userId: existingOrder.userId as string,
              orderId,
            },
          }),
        ]
      : []),
    // No-op if there's no DeliveryTracking row for this order (e.g.
    // Uber Eats / Food Panda orders) — updateMany matches zero rows
    // instead of throwing, unlike update().
    prisma.deliveryTracking.updateMany({
      where: { orderId },
      data: { deliveredAt: new Date() },
    }),
  ]);

  return { ok: true as const, order: updated };
}
