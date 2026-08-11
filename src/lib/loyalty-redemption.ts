import type { Prisma } from "@/generated/prisma/client";

/**
 * src/lib/loyalty-redemption.ts
 *
 * Lets a logged-in customer spend their loyaltyPoints balance for a
 * dollar-for-dollar-equivalent discount at checkout — mirrors the
 * gift-card pattern in lib/gift-cards.ts wherever the two concepts
 * overlap (a pure clamp function usable both for display and as the
 * authoritative server calculation, an atomic claim inside the same
 * transaction as order creation, a race-safe error the API routes catch).
 *
 * Guest checkout (userId = null) never redeems points — there's no
 * account to hold a balance on — so every function here is a no-op for
 * guests; callers simply never invoke them when session.user.id is null.
 */

// 20 points = $1. Deliberately worse than the $10-spent-per-1-point
// earn rate (i.e. earning is "cheaper" for the business than redeeming
// is "expensive" for the customer) — the same asymmetry every points
// program from airlines to coffee shops relies on to keep the economics
// sane. Chosen so `points * RATE` always lands on a clean 2-decimal
// dollar amount for any integer point count — no extra cent-rounding
// logic needed beyond the final Math.round below.
export const POINTS_TO_DOLLAR_RATE = 0.05;

// Below this, a redemption isn't worth the UI/ledger noise of a $0.50
// discount. A customer with fewer points than this simply can't redeem
// yet — same idea as a gift card with a $0 balance not being usable.
export const MIN_REDEEMABLE_POINTS = 20;

export function pointsToDollars(points: number): number {
  return Math.round(points * POINTS_TO_DOLLAR_RATE * 100) / 100;
}

/** Inverse of pointsToDollars, floored — "how many whole points would
 * this dollar amount cost", used when clamping a redemption down to what
 * the remaining order total can actually absorb. */
function dollarsToPoints(dollars: number): number {
  return Math.floor(dollars / POINTS_TO_DOLLAR_RATE);
}

export interface PointsRedemption {
  points: number;
  amount: number;
}

/**
 * Clamps a requested point redemption to what's actually usable — never
 * more than the customer's balance, never more than
 * MIN_REDEEMABLE_POINTS lets it be a redemption at all, and never enough
 * to take the order below $0 (an order can't have negative total, same
 * rule as calcGiftCardAmountToApply for gift cards). Silently clamps
 * rather than erroring, same as the gift-card equivalent — the customer
 * only ever sees the resulting `amount`, both in the live checkout
 * preview and in what the server actually applies.
 *
 * `orderTotalAfterOtherDiscounts` must already reflect any coupon and
 * tier discount applied first (see calcTierDiscountAmount in
 * loyalty-tiers.ts) — points spend down what's left, they don't stack a
 * second discount on top of dollars already discounted elsewhere.
 */
export function clampPointsRedemption(
  requestedPoints: number,
  availablePoints: number,
  orderTotalAfterOtherDiscounts: number
): PointsRedemption {
  if (
    !Number.isFinite(requestedPoints) ||
    requestedPoints <= 0 ||
    availablePoints < MIN_REDEEMABLE_POINTS ||
    orderTotalAfterOtherDiscounts <= 0
  ) {
    return { points: 0, amount: 0 };
  }

  const maxAffordablePoints = dollarsToPoints(orderTotalAfterOtherDiscounts);
  const points = Math.min(
    Math.floor(requestedPoints),
    Math.floor(availablePoints),
    maxAffordablePoints
  );

  if (points < MIN_REDEEMABLE_POINTS) {
    return { points: 0, amount: 0 };
  }

  return { points, amount: pointsToDollars(points) };
}

/**
 * Atomically debits `points` from a user's loyaltyPoints balance and
 * records the redemption inside an existing transaction. Must run in the
 * SAME transaction as the Order row it's being attached to — if order
 * creation later fails and the transaction rolls back, the debit (and
 * the LoyaltyTransaction row) rolls back with it, so points aren't spent
 * on a failed order. Same concurrency guarantee as redeemGiftCard in
 * lib/gift-cards.ts: the updateMany's WHERE clause re-checks
 * `loyaltyPoints >= points` at the DB level, and its affected-row count
 * tells us whether THIS call actually won against a concurrent
 * redemption (e.g. two tabs checking out at once) of the same balance.
 */
export async function redeemLoyaltyPoints(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  points: number,
  amount: number
): Promise<boolean> {
  if (points <= 0) return false;

  const claim = await tx.user.updateMany({
    where: { id: userId, loyaltyPoints: { gte: points } },
    data: { loyaltyPoints: { decrement: points } },
  });
  if (claim.count !== 1) return false;

  await tx.loyaltyTransaction.create({
    data: {
      points: -points,
      reason: "POINTS_REDEEMED",
      note: `Redeemed for $${amount.toFixed(2)} off order`,
      userId,
      orderId,
    },
  });

  return true;
}

/**
 * Credits previously-redeemed points back when an order carrying a
 * redemption is cancelled — the reverse of redeemLoyaltyPoints above,
 * same idea as refundGiftCard in lib/cancel-order.ts. Reuses the
 * MANUAL_ADJUSTMENT reason (rather than a negative POINTS_REDEEMED) for
 * the credit entry, matching how reverseLoyaltyPoints already reverses an
 * ORDER_DELIVERED credit with a MANUAL_ADJUSTMENT debit — "adjustment"
 * is the ledger's vocabulary for "something un-did an earlier entry".
 */
export async function reverseLoyaltyPointsRedemption(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string | null,
  pointsRedeemed: number
): Promise<number> {
  if (pointsRedeemed <= 0 || !userId) return 0;

  await tx.user.update({
    where: { id: userId },
    data: { loyaltyPoints: { increment: pointsRedeemed } },
  });

  await tx.loyaltyTransaction.create({
    data: {
      points: pointsRedeemed,
      reason: "MANUAL_ADJUSTMENT",
      note: "Order cancelled — redeemed points refunded",
      userId,
      orderId,
    },
  });

  return pointsRedeemed;
}
