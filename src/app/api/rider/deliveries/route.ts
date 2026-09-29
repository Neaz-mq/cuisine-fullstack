import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { findActiveDeliveries, toActiveDelivery } from "@/lib/rider-panel";

/**
 * GET /api/rider/deliveries — the signed-in rider's active deliveries
 * (taken or assigned, not delivered, not cancelled). Rider panel → Active
 * Delivery polls this every 15 seconds; the first list comes from the
 * page itself, in the same shape (lib/rider-panel.ts toActiveDelivery).
 *
 * Only the rider's own orders — never anyone else's addresses.
 */
export async function GET() {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const rows = await findActiveDeliveries(authResult.user.id!);
  return NextResponse.json(rows.map(toActiveDelivery));
}
