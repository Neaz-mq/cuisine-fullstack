import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScopeAny } from "@/lib/require-admin";
import { hasPermission } from "@/lib/permissions";

/**
 * GET /api/admin/riders
 *
 * Active (non-deactivated) Role.DELIVERY staff, for the "Assign Rider"
 * dropdown on /admin/orders/[id]. Gated on the "orders" scope (same as
 * the rest of the order-management surface) rather than "myDeliveries" —
 * this is an admin action, not something a rider does for themselves.
 *
 * ALSO the "kitchen" scope: the kitchen board's "Ready to Delivery" button
 * opens the same dispatch modal (Figma), so a cook has to be able to pick a
 * rider. A kitchen-only viewer gets the minimum — id and name, no phone
 * and no email fallback — because choosing a rider needs nothing more.
 * (This is why the kitchen Staff page can stay chefs + cleaners only: riders
 * are listed here, not through Staff.)
 */
export async function GET() {
  const authResult = await requireApiScopeAny(["orders", "kitchen"]);
  if (authResult instanceof NextResponse) return authResult;
  const viewerRole = (authResult.user as { role?: string } | undefined)?.role;
  const fullDetail = hasPermission(viewerRole, "orders");

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
      // Kitchen-only viewer: never fall back to the rider's email, and no phone.
      name: r.name ?? (fullDetail ? r.email : "Rider"),
      phone: fullDetail ? (r.staffProfile?.phone ?? null) : null,
    }))
  );
}
