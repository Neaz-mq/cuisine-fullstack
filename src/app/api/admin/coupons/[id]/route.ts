import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Prisma } from "@/generated/prisma/client";
import { couponFormSchema, updateCouponSchema } from "@/lib/validations/coupon";
import { parseBody } from "@/lib/validations/parse";
import { couponDataFromForm } from "@/lib/coupon-admin";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

/**
 * PATCH /api/admin/coupons/[id]
 *
 * Two shapes:
 *   - the whole coupon (has `code`) — "Edit" in the /admin/coupons modal;
 *   - a few fields only (e.g. { isActive: false }) — the older partial
 *     update, still used for "Deactivate".
 *
 * A code that customers have already used can't be renamed: their orders
 * and receipts show it, and anyone who saved it would find it gone.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.clone().json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const isFullEdit = typeof json === "object" && json !== null && "code" in json;

  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { code: true, usageCount: true, startsAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  if (isFullEdit) {
    const parsed = await parseBody(req, couponFormSchema);
    if (parsed instanceof NextResponse) return parsed;

    if (parsed.code !== existing.code && existing.usageCount > 0) {
      return NextResponse.json(
        { error: `${existing.code} has already been used, so its code can't be changed. Create a new coupon instead.` },
        { status: 409 }
      );
    }

    const built = await couponDataFromForm(parsed, existing);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

    try {
      const updated = await prisma.coupon.update({
        where: { id },
        data: {
          ...built.data,
          restrictedCategories: { set: parsed.restrictedCategoryIds.map((categoryId) => ({ id: categoryId })) },
          ...(parsed.restrictedItemIds
            ? { restrictedItems: { set: parsed.restrictedItemIds.map((itemId) => ({ id: itemId })) } }
            : {}),
        },
        select: { id: true, code: true },
      });
      return NextResponse.json(updated);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json(
          { error: `The code ${parsed.code} is already used by another coupon.` },
          { status: 409 }
        );
      }
      console.error("PATCH /api/admin/coupons/[id] error:", error);
      return NextResponse.json({ error: "Couldn't save the coupon. Please try again." }, { status: 400 });
    }
  }

  // ── Partial update ──────────────────────────────────────────────────────
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

  const updated = await prisma.coupon.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/coupons/[id]
 *
 * Only a coupon nobody has used yet can be deleted. A used one is part of
 * past orders (CouponRedemption), so the page offers "Deactivate" instead.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.coupon.findUnique({ where: { id }, select: { usageCount: true } });
  if (!existing) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
  if (existing.usageCount > 0) {
    return NextResponse.json(
      { error: "Can't delete — this coupon has already been redeemed at least once. Deactivate it instead." },
      { status: 409 }
    );
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
