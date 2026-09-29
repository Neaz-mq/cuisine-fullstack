import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { geocodeAddressDetailed } from "@/lib/geocode";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { checkRateLimit } from "@/lib/rate-limit";
import { ACTIVE_DELIVERY_WHERE, AVAILABLE_ORDER_WHERE, MAX_ACTIVE_DELIVERIES } from "@/lib/rider-panel";

/**
 * POST /api/rider/available/[orderId] — Available Orders → "Accept Order".
 *
 * The rider takes the order. It is theirs from now on (it leaves
 * everyone's Available Orders and shows in their Active Delivery), but it
 * stays "Preparing": the customer hears "Out for delivery" only when the
 * rider presses Picked Up (…/deliveries/[orderId]/pickup), or when the
 * kitchen dispatches it to them.
 *
 * Two riders pressing Accept at the same moment: DeliveryTracking has one
 * row per order (orderId is unique), so the second insert fails and that
 * rider is told someone else was faster.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;
  const { orderId } = await params;

  const rate = checkRateLimit(req, "rider-accept", { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tries — wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  // Only riders take orders (the owner/manager assign from Orders instead).
  const rider = await prisma.user.findUnique({ where: { id: riderId }, select: { role: true } });
  if (rider?.role !== "DELIVERY") {
    return NextResponse.json({ error: "Only riders can take orders." }, { status: 403 });
  }

  const activeCount = await prisma.deliveryTracking.count({ where: ACTIVE_DELIVERY_WHERE(riderId) });
  if (activeCount >= MAX_ACTIVE_DELIVERIES) {
    return NextResponse.json(
      { error: `You already have ${activeCount} deliveries. Finish one before taking another.` },
      { status: 409 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, ...AVAILABLE_ORDER_WHERE },
    select: {
      address: true,
      apartment: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });
  if (!order) {
    return NextResponse.json(
      { error: "This order isn't available any more — another rider may have taken it." },
      { status: 409 }
    );
  }

  // Where the customer is, for Navigate and the live map. Same as the
  // restaurant's own dispatch: the checkout pin when there is one, else
  // look the address up; if that fails the rider goes by the written
  // address (never a reason not to take the order).
  let destination: { lat: number; lng: number } | null = null;
  if (order.deliveryLat !== null && order.deliveryLng !== null) {
    destination = { lat: order.deliveryLat, lng: order.deliveryLng };
  } else {
    const outcome = await geocodeAddressDetailed(order);
    if (outcome.ok) destination = outcome.result;
  }

  try {
    await prisma.$transaction([
      prisma.deliveryTracking.create({
        data: {
          orderId,
          riderId,
          selfAssigned: true,
          riderLat: RESTAURANT_LOCATION.lat,
          riderLng: RESTAURANT_LOCATION.lng,
          destLat: destination?.lat ?? null,
          destLng: destination?.lng ?? null,
        },
      }),
      prisma.order.update({ where: { id: orderId }, data: { shippingMethod: "OWN_DELIVERY" } }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Another rider just took this order." }, { status: 409 });
    }
    console.error("[rider/available] accept failed:", error);
    return NextResponse.json({ error: "Couldn't take this order. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
