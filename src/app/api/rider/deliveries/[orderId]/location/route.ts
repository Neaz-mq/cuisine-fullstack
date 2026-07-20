import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { riderLocationUpdateSchema } from "@/lib/validations/delivery";

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

  await prisma.deliveryTracking.update({
    where: { orderId },
    data: { riderLat: lat, riderLng: lng, riderLocationUpdatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
