import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findValidCoupon, calcDiscountAmount, getCustomerKey } from "@/lib/order-checkout-shared";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * src/app/api/coupons/validate/route.ts
 *
 * POST /api/coupons/validate -> public, unauthenticated. Lets the checkout
 * page preview a discount before submitting the order (so the customer
 * sees the real amount before clicking "Confirm your order"), including
 * every v2 rule that can be previewed: expiry, minimum order value, the
 * global usage cap, and — when we know who's asking (logged-in userId, or
 * the phone number they've typed into billing so far) — their personal
 * per-customer cap too.
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
    // Coupon codes are guessable strings, so this endpoint is an obvious
    // brute-force target (script through WELCOME1, WELCOME2, ... until one
    // sticks). A generous but real cap per IP keeps normal "typo, try
    // again" usage unaffected while making that kind of scripted guessing
    // impractical. See rate-limit.ts for the in-memory-vs-Redis tradeoff.
    const rateLimitResult = checkRateLimit(request, "coupon-validate", {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { code, subtotal, phone } = body as { code: string; subtotal: number; phone?: string };

    if (typeof subtotal !== "number" || subtotal <= 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const session = await auth();
    const customerKey = getCustomerKey(session?.user?.id, phone);

    const result = await findValidCoupon(code, subtotal, customerKey);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const discountAmount = calcDiscountAmount(subtotal, result.coupon);

    return NextResponse.json({
      code: result.coupon.code,
      type: result.coupon.type,
      percentOff: result.coupon.percentOff,
      fixedOff: result.coupon.fixedOff,
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
