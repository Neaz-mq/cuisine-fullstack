import { NextResponse } from "next/server";
import { findValidCoupon, calcDiscountAmount } from "@/lib/order-checkout-shared";

/**
 * src/app/api/coupons/validate/route.ts
 *
 * POST /api/coupons/validate -> public, unauthenticated. Lets the checkout
 * page preview a discount before submitting the order (so the customer
 * sees the real amount before clicking "Confirm your order").
 *
 * This is a PREVIEW only — it does not consume the coupon. The coupon is
 * only actually spent when an order is created (see consumeCoupon in
 * order-checkout-shared.ts, called from /api/orders and
 * /api/checkout/create-session), inside the same DB transaction as the
 * order itself. That's also where the discount is authoritatively
 * recomputed from server-resolved item prices — the `subtotal` this route
 * returns a preview against is client-reported and only used for display,
 * never trusted for the actual charge.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, subtotal } = body as { code: string; subtotal: number };

    if (typeof subtotal !== "number" || subtotal <= 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const result = await findValidCoupon(code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const discountAmount = calcDiscountAmount(subtotal, result.coupon.percentOff);

    return NextResponse.json({
      code: result.coupon.code,
      percentOff: result.coupon.percentOff,
      discountAmount,
    });
  } catch (error) {
    console.error("POST /api/coupons/validate error:", error);
    return NextResponse.json(
      { error: "Failed to validate coupon" },
      { status: 500 }
    );
  }
}