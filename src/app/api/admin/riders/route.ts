import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

/**
 * GET /api/admin/riders
 *
 * Active (non-deactivated) Role.DELIVERY staff, for the "Assign Rider"
 * dropdown on /admin/orders/[id]. Gated on the "orders" scope (same as
 * the rest of the order-management surface) rather than "myDeliveries" —
 * this is an admin action, not something a rider does for themselves.
 */
export async function GET() {
  const authResult = await requireApiScope("orders");
  if (authResult instanceof NextResponse) return authResult;

  const riders = await prisma.user.findMany({
    where: {
      role: "DELIVERY",
      OR: [{ staffProfile: { isActive: true } }, { staffProfile: null }],
    },
    select: { id: true, name: true, email: true, staffProfile: { select: { phone: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    riders.map((r) => ({
      id: r.id,
      name: r.name ?? r.email,
      phone: r.staffProfile?.phone ?? null,
    }))
  );
}
