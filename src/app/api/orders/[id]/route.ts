import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScopeAny } from "@/lib/require-admin";
import { orderStatusUpdateSchema } from "@/lib/validations/order";
import { parseBody } from "@/lib/validations/parse";
import { markOrderDelivered } from "@/lib/mark-order-delivered";

// Public, unauthenticated lookup for the /track/[orderId] page. Guest
// checkout customers have no account to log into, so tracking has to work
// without a session — the unguessable cuid order id is effectively the
// access token here (same pattern most delivery apps use for tracking
// links). Deliberately selects only tracking-relevant fields — not phone,
// full address, or email — to limit what's exposed on an endpoint with no
// auth check.
//
// deliveryTracking is included for the same reason but goes further:
// riderId/rider name/phone are NEVER selected here, only the coordinates
// and timestamp the live map needs. A guest with just the order link
// should be able to see "your rider is here on the map", not who they are.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      totalAmount: true,
      firstName: true,
      city: true,
      orderType: true,
      shippingMethod: true,
      table: { select: { label: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          menuItem: { select: { title: true } },
        },
      },
      deliveryTracking: {
        select: {
          riderLat: true,
          riderLng: true,
          riderLocationUpdatedAt: true,
          destLat: true,
          destLng: true,
          deliveredAt: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScopeAny(["orders", "kitchen"]);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, orderStatusUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { status } = parsed;

  // DELIVERED goes through the shared helper (loyalty points + closing
  // out DeliveryTracking) — same code path a rider's own "Mark Delivered"
  // button uses, see POST /api/rider/deliveries/[orderId]/deliver.
  if (status === "DELIVERED") {
    const result = await markOrderDelivered(id);
    if (!result.ok) {
      const statusCode = result.error === "Order not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }
    return NextResponse.json(result.order);
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
