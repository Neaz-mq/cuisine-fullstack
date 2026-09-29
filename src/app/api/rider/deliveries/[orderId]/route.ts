import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

/**
 * DELETE /api/rider/deliveries/[orderId] — Active Delivery → "Release".
 *
 * Gives back an order the rider took from Available Orders, before
 * picking it up (a flat tyre, took one too many …). It goes back to
 * Available Orders for another rider.
 *
 * Only for orders the rider took themselves and hasn't picked up: an
 * order the restaurant assigned is the restaurant's call to move, and
 * once the food has left, the customer is already watching the map.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;
  const { orderId } = await params;

  const tracking = await prisma.deliveryTracking.findUnique({
    where: { orderId },
    select: { riderId: true, selfAssigned: true, deliveredAt: true, order: { select: { status: true } } },
  });
  if (!tracking || tracking.riderId !== riderId) {
    return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
  }
  if (!tracking.selfAssigned) {
    return NextResponse.json(
      { error: "The restaurant assigned this order to you — ask them to move it." },
      { status: 409 }
    );
  }
  if (tracking.deliveredAt || tracking.order.status !== "PREPARING") {
    return NextResponse.json({ error: "You've already picked this order up." }, { status: 409 });
  }

  // Only while still not picked up (status in the where), in case the
  // kitchen dispatched it this very moment.
  const { count } = await prisma.deliveryTracking.deleteMany({
    where: { orderId, riderId, deliveredAt: null, order: { status: "PREPARING" } },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This order just changed — please refresh." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
