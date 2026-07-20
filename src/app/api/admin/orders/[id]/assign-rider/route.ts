import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { assignRiderSchema } from "@/lib/validations/delivery";
import { geocodeAddress } from "@/lib/geocode";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";

/**
 * POST /api/admin/orders/[id]/assign-rider
 *
 * Assigns (or reassigns) a Role.DELIVERY staff member to a DELIVERY order,
 * geocodes the order's address once, creates/updates the DeliveryTracking
 * row, and flips the order to OUT_FOR_DELIVERY. From that point on:
 *   - the rider sees this order on /admin/my-deliveries and starts
 *     broadcasting their live position (POST .../location)
 *   - the customer's /track/[orderId] page shows a live map
 *
 * Reassignment (calling this again for the same order with a different
 * riderId) is intentionally allowed — e.g. the original rider called in
 * sick — and simply overwrites the existing DeliveryTracking row rather
 * than erroring, resetting the rider's last-known position to the
 * restaurant until the new rider's phone reports a real one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("orders");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, assignRiderSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { riderId } = parsed;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      orderType: true,
      status: true,
      address: true,
      apartment: true,
      city: true,
      state: true,
      zip: true,
      country: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.orderType !== "DELIVERY") {
    return NextResponse.json(
      { error: "Only delivery orders can be assigned a rider" },
      { status: 400 }
    );
  }
  if (order.status === "DELIVERED" || order.status === "CANCELLED") {
    return NextResponse.json(
      { error: `Cannot assign a rider — order is already ${order.status.toLowerCase()}` },
      { status: 400 }
    );
  }

  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    select: { role: true, staffProfile: { select: { isActive: true } } },
  });
  if (!rider || rider.role !== "DELIVERY") {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }
  if (rider.staffProfile?.isActive === false) {
    return NextResponse.json({ error: "This rider account is deactivated" }, { status: 400 });
  }

  const geocoded = await geocodeAddress(order);
  if (!geocoded) {
    return NextResponse.json(
      { error: "Could not locate this address on the map — check it and try again" },
      { status: 422 }
    );
  }

  const [, updatedOrder] = await prisma.$transaction([
    prisma.deliveryTracking.upsert({
      where: { orderId: id },
      create: {
        orderId: id,
        riderId,
        riderLat: RESTAURANT_LOCATION.lat,
        riderLng: RESTAURANT_LOCATION.lng,
        destLat: geocoded.lat,
        destLng: geocoded.lng,
      },
      update: {
        riderId,
        // Reset rider position to the restaurant on reassignment — the
        // new rider hasn't reported a real position yet, and leaving the
        // PREVIOUS rider's last coordinates (or the customer's own
        // address) would be actively misleading. A delivery always
        // starts from the restaurant, never from the destination.
        riderLat: RESTAURANT_LOCATION.lat,
        riderLng: RESTAURANT_LOCATION.lng,
        riderLocationUpdatedAt: new Date(),
        destLat: geocoded.lat,
        destLng: geocoded.lng,
        deliveredAt: null,
      },
    }),
    prisma.order.update({
      where: { id },
      data: {
        status: "OUT_FOR_DELIVERY",
        shippingMethod: "OWN_DELIVERY",
      },
    }),
  ]);

  return NextResponse.json(updatedOrder);
}