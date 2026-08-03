import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { notificationsQuerySchema } from "@/lib/validations/admin";
import { parseQuery } from "@/lib/validations/parse";

/**
 * GET /api/rider/notifications
 *
 * Rider-side counterpart to /api/admin/notifications. That route counts
 * new PLACED orders restaurant-wide — relevant to order-taking staff, not
 * to a DELIVERY rider (who can't even open /admin/orders, see the
 * "orders" scope check there). This route counts NEW DELIVERIES ASSIGNED
 * to the CURRENT rider instead — driven by DeliveryTracking.assignedAt,
 * scoped to riderId, same "since" cursor pattern as the admin version.
 *
 * assignedAt is only set on CREATE (see assign-rider/route.ts's upsert —
 * the `update` branch never touches it), so re-assigning the SAME rider
 * to an order they already had doesn't re-trigger a notification for it.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;

  const { searchParams } = new URL(req.url);
  const parsedQuery = parseQuery(searchParams, notificationsQuerySchema);
  if (parsedQuery instanceof NextResponse) return parsedQuery;
  const { since } = parsedQuery;

  const newAssignmentsCount = await prisma.deliveryTracking.count({
    where: {
      riderId,
      ...(since ? { assignedAt: { gt: new Date(since) } } : {}),
    },
  });

  const latestAssignment = await prisma.deliveryTracking.findFirst({
    where: { riderId },
    orderBy: { assignedAt: "desc" },
    select: { assignedAt: true },
  });

  return NextResponse.json({
    newAssignmentsCount,
    latestAssignedAt: latestAssignment?.assignedAt ?? null,
  });
}