import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { canTransition } from "@/lib/order-state-machine";
import { sendOrderStatusEmail } from "@/lib/send-order-status-email";

/**
 * POST /api/rider/deliveries/[orderId]/pickup — Active Delivery → "Picked Up".
 *
 * The rider took this order from Available Orders while the kitchen was
 * preparing it; now the food is in their hands. The order becomes "Out
 * for delivery" — the same status (and the same customer email, live map
 * and chat) as when the restaurant assigns a rider from the Orders page.
 *
 * Only the rider holding the order. If the kitchen already dispatched it
 * (status is already "Out for delivery"), this simply succeeds.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;
  const { orderId } = await params;

  const tracking = await prisma.deliveryTracking.findUnique({
    where: { orderId },
    select: {
      riderId: true,
      deliveredAt: true,
      order: { select: { status: true, paymentMethod: true, paymentStatus: true } },
    },
  });
  if (!tracking || tracking.riderId !== riderId) {
    return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
  }
  if (tracking.deliveredAt || tracking.order.status === "DELIVERED") {
    return NextResponse.json({ error: "This order is already delivered." }, { status: 409 });
  }
  if (tracking.order.status === "OUT_FOR_DELIVERY") {
    return NextResponse.json({ ok: true, status: "OUT_FOR_DELIVERY" });
  }
  if (!canTransition(tracking.order.status, "OUT_FOR_DELIVERY") || tracking.order.status !== "PREPARING") {
    return NextResponse.json(
      { error: `This order is ${tracking.order.status.toLowerCase().replace(/_/g, " ")} — it can't go out.` },
      { status: 409 }
    );
  }
  if (tracking.order.paymentMethod === "ONLINE" && tracking.order.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "This order's online payment hasn't gone through yet. Ask the restaurant before leaving." },
      { status: 409 }
    );
  }

  // `status: "PREPARING"` in the where — if the order was cancelled a
  // moment ago, nothing is updated and the rider is told.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: "PREPARING" },
    data: { status: "OUT_FOR_DELIVERY", shippingMethod: "OWN_DELIVERY", dispatchedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This order just changed — please refresh." }, { status: 409 });
  }

  after(() => sendOrderStatusEmail(orderId, "OUT_FOR_DELIVERY"));

  return NextResponse.json({ ok: true, status: "OUT_FOR_DELIVERY" });
}
