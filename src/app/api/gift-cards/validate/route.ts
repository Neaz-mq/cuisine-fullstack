import { NextResponse } from "next/server";
import { findValidGiftCard, calcGiftCardAmountToApply } from "@/lib/gift-cards";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * src/app/api/gift-cards/validate/route.ts
 *
 * POST /api/gift-cards/validate -> public, unauthenticated. Lets the
 * checkout page preview how much of a gift card's balance will actually
 * apply to the current cart total before the customer submits the order.
 *
 * Takes the order's current total-so-far (after any coupon discount) so
 * calcGiftCardAmountToApply can show the real amount that will be
 * deducted — never more than the cart needs, never more than the card
 * has. This is a PREVIEW only — it does not debit the card. The card is
 * only actually redeemed when an order is created (see redeemGiftCard in
 * gift-cards.ts, called from /api/orders and
 * /api/checkout/create-session), inside the same DB transaction as the
 * order itself.
 */
export async function POST(request: Request) {
  try {
    // Gift card codes are guessable strings, same brute-force concern as
    // coupon codes — see coupons/validate/route.ts for the same rate
    // limit rationale.
    const rateLimitResult = checkRateLimit(request, "gift-card-validate", {
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
    const { code, orderTotal }: { code: string; orderTotal: number } = body;

    if (typeof orderTotal !== "number" || !Number.isFinite(orderTotal) || orderTotal < 0) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
    }

    const result = await findValidGiftCard(code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const amountToApply = calcGiftCardAmountToApply(orderTotal, result.giftCard.balance);

    return NextResponse.json({
      code: result.giftCard.code,
      balance: result.giftCard.balance,
      amountToApply,
    });
  } catch (error) {
    console.error("POST /api/gift-cards/validate error:", error);
    return NextResponse.json(
      { error: "Failed to validate gift card" },
      { status: 500 }
    );
  }
}
