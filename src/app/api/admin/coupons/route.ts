import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { validateCouponInput, CouponCreateInput } from "@/lib/order-checkout-shared";

export async function GET() {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  // _count.redemptions lets the admin list show "used N times" without a
  // separate query per coupon. restrictedCategories/restrictedItems (just
  // id+name/title) let the list show what a scoped coupon is limited to
  // without a follow-up request.
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

  const body = (await req.json()) as CouponCreateInput;
  const result = validateCouponInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { restrictedCategoryIds, restrictedItemIds, ...couponFields } = result.data;

  try {
    const coupon = await prisma.coupon.create({
      data: {
        ...couponFields,
        restrictedCategories: { connect: restrictedCategoryIds.map((id) => ({ id })) },
        restrictedItems: { connect: restrictedItemIds.map((id) => ({ id })) },
      },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A coupon with this code already exists, or one of the selected items/categories no longer exists." },
      { status: 409 }
    );
  }
}
