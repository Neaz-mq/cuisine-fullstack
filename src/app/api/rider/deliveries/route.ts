import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

/**
 * GET /api/rider/deliveries
 *
 * A rider's own active (not yet delivered) assignments — this is the
 * entire dataset /admin/my-deliveries needs. Deliberately scoped to
 * `riderId: session.user.id` at the query level, not filtered client-side
 * — a rider account should never even receive another rider's orders in
 * the response body, regardless of what the UI does with it.
 */
export async function GET() {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;

  const deliveries = await prisma.deliveryTracking.findMany({
    where: { riderId, deliveredAt: null },
    orderBy: { assignedAt: "asc" },
    select: {
      orderId: true,
      destLat: true,
      destLng: true,
      riderLat: true,
      riderLng: true,
      riderLocationUpdatedAt: true,
      assignedAt: true,
      order: {
        select: {
          status: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          apartment: true,
          city: true,
          state: true,
          zip: true,
          totalAmount: true,
          paymentMethod: true,
        },
      },
    },
  });

  return NextResponse.json(
    deliveries
      // A cancelled order can still have an open DeliveryTracking row if
      // it was cancelled after dispatch — don't show it as an active job.
      .filter((d) => d.order.status !== "CANCELLED")
      .map((d) => ({
        orderId: d.orderId,
        status: d.order.status,
        customerName: `${d.order.firstName} ${d.order.lastName}`,
        phone: d.order.phone,
        address: [d.order.address, d.order.apartment, d.order.city, d.order.state, d.order.zip]
          .filter(Boolean)
          .join(", "),
        totalAmount: d.order.totalAmount,
        paymentMethod: d.order.paymentMethod,
        destLat: d.destLat,
        destLng: d.destLng,
        assignedAt: d.assignedAt,
      }))
  );
}
