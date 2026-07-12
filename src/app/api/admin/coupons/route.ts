import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCouponInput, CouponCreateInput } from "@/lib/order-checkout-shared";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // _count.redemptions lets the admin list show "used N times" without a
  // separate query per coupon.
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as CouponCreateInput;
  const result = validateCouponInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const coupon = await prisma.coupon.create({ data: result.data });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A coupon with this code already exists." },
      { status: 409 }
    );
  }
}
