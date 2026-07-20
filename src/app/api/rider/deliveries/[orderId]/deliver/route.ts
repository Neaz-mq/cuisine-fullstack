import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { markOrderDelivered } from "@/lib/mark-order-delivered";

/**
 * POST /api/rider/deliveries/[orderId]/deliver
 *
 * Rider's own "Mark Delivered" button. Ownership-checked the same way as
 * the location endpoint — a rider can only deliver an order that's
 * actually assigned to them. Shares markOrderDelivered() with the admin
 * order-status dropdown (PATCH /api/orders/[id]) so loyalty points and
 * DeliveryTracking.deliveredAt stay correct no matter which UI closed out
 * the order.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;

  const { orderId } = await params;

  const tracking = await prisma.deliveryTracking.findUnique({
    where: { orderId },
    select: { riderId: true },
  });
  if (!tracking || tracking.riderId !== riderId) {
    return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
  }

  const result = await markOrderDelivered(orderId);
  if (!result.ok) {
    const statusCode = result.error === "Order not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json(result.order);
}
