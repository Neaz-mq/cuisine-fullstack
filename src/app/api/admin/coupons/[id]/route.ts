import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Prisma } from "@/generated/prisma";

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
  const body = await req.json();

  const data: Prisma.CouponUpdateInput = {};

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  if (body.minOrderValue !== undefined) {
    if (body.minOrderValue !== null && (typeof body.minOrderValue !== "number" || body.minOrderValue < 0)) {
      return NextResponse.json({ error: "Minimum order value must be zero or a positive number" }, { status: 400 });
    }
    data.minOrderValue = body.minOrderValue;
  }

  if (body.maxDiscountAmount !== undefined) {
    if (body.maxDiscountAmount !== null && (typeof body.maxDiscountAmount !== "number" || body.maxDiscountAmount <= 0)) {
      return NextResponse.json({ error: "Max discount cap must be a positive number" }, { status: 400 });
    }
    data.maxDiscountAmount = body.maxDiscountAmount;
  }

  if (body.startsAt !== undefined) {
    const parsed = body.startsAt ? new Date(body.startsAt) : null;
    if (body.startsAt && Number.isNaN(parsed?.getTime())) {
      return NextResponse.json({ error: "Start date is invalid" }, { status: 400 });
    }
    data.startsAt = parsed;
  }

  if (body.expiresAt !== undefined) {
    const parsed = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.expiresAt && Number.isNaN(parsed?.getTime())) {
      return NextResponse.json({ error: "Expiry date is invalid" }, { status: 400 });
    }
    data.expiresAt = parsed;
  }

  if (body.usageLimit !== undefined) {
    if (body.usageLimit !== null && (!Number.isInteger(body.usageLimit) || body.usageLimit < 1)) {
      return NextResponse.json({ error: "Usage limit must be a positive whole number" }, { status: 400 });
    }
    data.usageLimit = body.usageLimit;
  }

  if (body.perCustomerLimit !== undefined) {
    if (body.perCustomerLimit !== null && (!Number.isInteger(body.perCustomerLimit) || body.perCustomerLimit < 1)) {
      return NextResponse.json({ error: "Per-customer limit must be a positive whole number" }, { status: 400 });
    }
    data.perCustomerLimit = body.perCustomerLimit;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

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
