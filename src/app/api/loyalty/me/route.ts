import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTierForPoints } from "@/lib/loyalty-tiers";
import { MIN_REDEEMABLE_POINTS, POINTS_TO_DOLLAR_RATE } from "@/lib/loyalty-redemption";

/**
 * src/app/api/loyalty/me/route.ts
 *
 * GET -> the CURRENT logged-in user's own loyalty balance, tier, and the
 * redemption rate — nothing about any other user, so this is safe behind
 * only a session check (no admin scope needed, same trust boundary as
 * /api/orders/mine). Used by Carts.tsx to render "You have N points —
 * redeem up to $X" at checkout without guessing at a balance the server
 * hasn't confirmed.
 *
 * Guests (no session) get a 401 — the checkout page simply doesn't show
 * the points-redemption section at all in that case, same as it already
 * hides "My Orders"-style account features for guest checkout.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { loyaltyPoints: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const tier = getTierForPoints(user.loyaltyPoints);

    return NextResponse.json({
      points: user.loyaltyPoints,
      tier: {
        id: tier.id,
        label: tier.label,
        discountPercent: tier.discountPercent,
        pointsMultiplier: tier.pointsMultiplier,
      },
      redemption: {
        rate: POINTS_TO_DOLLAR_RATE,
        minPoints: MIN_REDEEMABLE_POINTS,
        canRedeem: user.loyaltyPoints >= MIN_REDEEMABLE_POINTS,
      },
    });
  } catch (error) {
    console.error("GET /api/loyalty/me error:", error);
    return NextResponse.json({ error: "Failed to load loyalty info" }, { status: 500 });
  }
}
