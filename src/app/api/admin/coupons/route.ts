import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { couponFormSchema } from "@/lib/validations/coupon";
import { couponDataFromForm } from "@/lib/coupon-admin";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

/**
 * GET  /api/admin/coupons  every coupon, newest first (with redemption
 *                          counts and restrictions).
 * POST /api/admin/coupons  "Create New Coupon" on /admin/coupons.
 *
 * Checkout re-checks every rule of a coupon when it is used
 * (findValidCoupon / consumeCoupon in src/lib/order-checkout-shared.ts);
 * this route only makes sure what's saved is complete and sensible.
 */
export async function GET() {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { redemptions: true } },
      restrictedCategories: { select: { id: true, name: true } },
      restrictedItems: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, couponFormSchema);
  if (parsed instanceof NextResponse) return parsed;

  const built = await couponDataFromForm(parsed, null);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  try {
    const coupon = await prisma.coupon.create({
      data: {
        ...built.data,
        restrictedCategories: { connect: parsed.restrictedCategoryIds.map((id) => ({ id })) },
        restrictedItems: { connect: (parsed.restrictedItemIds ?? []).map((id) => ({ id })) },
      },
      select: { id: true, code: true },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: `The code ${parsed.code} is already used by another coupon.` },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/coupons error:", error);
    return NextResponse.json(
      { error: "Couldn't save the coupon. One of the chosen categories may no longer exist." },
      { status: 400 }
    );
  }
}
