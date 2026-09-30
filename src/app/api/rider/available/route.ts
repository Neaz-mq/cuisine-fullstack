import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { ACTIVE_DELIVERY_WHERE, findAvailableOrders, getRiderPreferences, MAX_ACTIVE_DELIVERIES, withoutAddress } from "@/lib/rider-panel";

/**
 * GET /api/rider/available — Rider panel → Available Orders (polled every
 * 15 s): delivery orders the kitchen is preparing that no rider has yet,
 * plus how many the signed-in rider already holds (they can hold
 * MAX_ACTIVE_DELIVERIES at once).
 *
 * Before a rider takes an order they see the area, distance and what they
 * would earn — the full street address and phone number only once it's
 * theirs (Active Delivery).
 */
export async function GET() {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const prefs = await getRiderPreferences(authResult.user.id!);
  const [orders, activeCount] = await Promise.all([
    findAvailableOrders(50, prefs),
    prisma.deliveryTracking.count({ where: ACTIVE_DELIVERY_WHERE(authResult.user.id!) }),
  ]);

  return NextResponse.json({
    orders: orders.map(withoutAddress),
    activeCount,
    maxActive: MAX_ACTIVE_DELIVERIES,
  });
}
