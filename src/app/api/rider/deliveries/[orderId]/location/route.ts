import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { riderLocationUpdateSchema } from "@/lib/validations/delivery";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { haversineKm } from "@/lib/delivery-zones";

/**
 * How far from the restaurant a rider can believably be. Deliveries here
 * are a few km; 50 km leaves plenty of room for a long trip.
 *
 * ⚠️ Why this check exists: the position comes from the rider's browser.
 * A phone uses GPS, but a laptop or PC has no GPS and guesses from its
 * internet address — and behind a VPN (Cloudflare WARP etc.) that address
 * can be in another country. The customer's live map then showed the
 * rider in the USA. A position that far away is never real, so it isn't
 * saved; the rider's screen explains what to fix instead.
 */
const MAX_RIDER_DISTANCE_KM = 50;

/**
 * POST /api/rider/deliveries/[orderId]/location
 *
 * The rider's own phone posts here every few seconds while
 * /admin/my-deliveries is open (see RiderDashboard.tsx's watchPosition
 * loop). Ownership-checked: a rider can only ever update the
 * DeliveryTracking row where riderId matches THEIR OWN session, never an
 * order assigned to someone else — no amount of guessing another order's
 * id lets a rider spoof its position.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;

  const { orderId } = await params;

  const parsed = await parseBody(req, riderLocationUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { lat, lng } = parsed;

  const tracking = await prisma.deliveryTracking.findUnique({
    where: { orderId },
    select: { riderId: true, deliveredAt: true },
  });
  if (!tracking || tracking.riderId !== riderId) {
    return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
  }
  if (tracking.deliveredAt) {
    return NextResponse.json(
      { error: "This delivery is already complete" },
      { status: 400 }
    );
  }

  const distanceKm = haversineKm(RESTAURANT_LOCATION, { lat, lng });
  if (distanceKm > MAX_RIDER_DISTANCE_KM) {
    return NextResponse.json(
      {
        error:
          "Your device reports a location far from the restaurant, so it wasn't shared with the customer.",
        reason: "too_far",
        distanceKm: Math.round(distanceKm),
      },
      { status: 422 }
    );
  }

  await prisma.deliveryTracking.update({
    where: { orderId },
    data: { riderLat: lat, riderLng: lng, riderLocationUpdatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
