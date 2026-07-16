import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Prisma } from "@/generated/prisma/client";
import { updateCouponSchema } from "@/lib/validations/coupon";
import { parseBody } from "@/lib/validations/parse";

/**
 * PATCH /api/admin/coupons/[id]
 *
 * Only a subset of fields is editable after creation. `code`, `type`,
 * `percentOff`, and `fixedOff` are permanently locked once a coupon
 * exists — a code that's already been shared/printed can't silently
 * change discount value out from under whoever has it. Delete (if unused)
 * and recreate instead if the discount itself needs to change.
 *
 * Everything else here is a business-terms knob real platforms do let
 * admins adjust after the fact — extend an expiring campaign, raise a
 * usage cap once a coupon overperforms, deactivate a coupon that's being
 * abused, etc. — so those stay editable at any time, used or not.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, updateCouponSchema);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  const data: Prisma.CouponUpdateInput = {};

  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.minOrderValue !== undefined) data.minOrderValue = body.minOrderValue;
  if (body.maxDiscountAmount !== undefined) data.maxDiscountAmount = body.maxDiscountAmount;
  if (body.startsAt !== undefined) data.startsAt = body.startsAt;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt;
  if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit;
  if (body.perCustomerLimit !== undefined) data.perCustomerLimit = body.perCustomerLimit;

  try {
    const updated = await prisma.coupon.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // usageCount (not a boolean flag) is now the source of truth for "has
  // this ever been redeemed" — a coupon can be used many times under v2,
  // so the guard is "any redemptions at all", same intent as v1's
  // usedByOrderId check but expressed as a count. Deactivate instead of
  // deleting so the CouponRedemption audit trail keeps a valid parent row.
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
  if (existing.usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "Can't delete — this coupon has already been redeemed at least once. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
