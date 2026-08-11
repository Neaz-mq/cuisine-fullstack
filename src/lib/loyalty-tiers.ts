/**
 * src/lib/loyalty-tiers.ts
 *
 * Loyalty tiers — BRONZE/SILVER/GOLD/PLATINUM — derived purely from
 * `User.loyaltyPoints`, the running balance that already exists in the
 * schema (see mark-order-delivered.ts / cancel-order.ts / the admin
 * manual-adjustment route). No new column, no migration: tier is always
 * a function of the current point balance, computed on read.
 *
 * Why derived instead of a stored `tier` column:
 *   - loyaltyPoints already moves up (order delivered) and down (order
 *     cancelled, manual admin deduction) through several call sites. A
 *     stored tier would need to be recomputed at every one of those, and
 *     any spot that forgets leaves a stale tier — a class of bug that
 *     simply can't happen if tier is computed from the balance itself.
 *   - Thresholds can be tuned here in one place without a data migration
 *     to backfill existing users.
 *
 * Pure functions only — no Prisma import here — so this file (and its
 * tests) never need a database connection.
 */

export type LoyaltyTierId = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface LoyaltyTierDef {
  id: LoyaltyTierId;
  label: string;
  /** Minimum loyaltyPoints balance required to be in this tier. */
  minPoints: number;
  /**
   * Multiplier applied to points earned on a delivered order while the
   * customer is in this tier (see mark-order-delivered.ts). Bronze earns
   * the base rate; higher tiers earn a bonus on top of it.
   */
  pointsMultiplier: number;
  /**
   * Automatic percentage discount applied at checkout while the customer
   * is in this tier — no code needed, unlike a Coupon (see
   * calcTierDiscountAmount below and its use in /api/orders and
   * /api/checkout/create-session). 0 for Bronze (no perk yet earned).
   */
  discountPercent: number;
  /** Marketing-facing perks shown on the customer loyalty page. */
  perks: string[];
  /** Tailwind classes for the tier's badge chip. */
  badgeClassName: string;
}

// Ordered lowest -> highest. Keep ordered: getTierForPoints and
// getNextTier both rely on this being sorted by minPoints ascending.
export const LOYALTY_TIERS: LoyaltyTierDef[] = [
  {
    id: "BRONZE",
    label: "Bronze",
    minPoints: 0,
    pointsMultiplier: 1,
    discountPercent: 0,
    perks: ["Earn 1 point per $10 spent", "Birthday treat on your special day"],
    badgeClassName: "bg-orange-100 text-orange-800 border border-orange-200",
  },
  {
    id: "SILVER",
    label: "Silver",
    minPoints: 200,
    pointsMultiplier: 1.1,
    discountPercent: 3,
    perks: [
      "10% bonus points on every order",
      "Automatic 3% off every order",
      "Birthday treat on your special day",
      "Early access to new menu items",
    ],
    badgeClassName: "bg-gray-200 text-gray-700 border border-gray-300",
  },
  {
    id: "GOLD",
    label: "Gold",
    minPoints: 500,
    pointsMultiplier: 1.25,
    discountPercent: 5,
    perks: [
      "25% bonus points on every order",
      "Automatic 5% off every order",
      "Birthday treat on your special day",
      "Early access to new menu items",
      "Priority customer support",
    ],
    badgeClassName: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  },
  {
    id: "PLATINUM",
    label: "Platinum",
    minPoints: 1000,
    pointsMultiplier: 1.5,
    discountPercent: 8,
    perks: [
      "50% bonus points on every order",
      "Automatic 8% off every order",
      "Birthday treat on your special day",
      "Early access to new menu items",
      "Priority customer support",
      "Exclusive invites to chef's-table events",
    ],
    badgeClassName: "bg-[#2C6252]/10 text-[#2C6252] border border-[#2C6252]/30",
  },
];

/** Highest tier whose minPoints threshold the balance meets or exceeds. */
export function getTierForPoints(points: number): LoyaltyTierDef {
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

/** The tier immediately above the given one, or null if already top tier. */
export function getNextTier(tier: LoyaltyTierDef): LoyaltyTierDef | null {
  const index = LOYALTY_TIERS.findIndex((t) => t.id === tier.id);
  if (index === -1 || index === LOYALTY_TIERS.length - 1) return null;
  return LOYALTY_TIERS[index + 1];
}

export interface TierProgress {
  tier: LoyaltyTierDef;
  nextTier: LoyaltyTierDef | null;
  /** Points still needed to reach nextTier; 0 if already at the top tier. */
  pointsToNextTier: number;
  /** 0–100, how far through the current tier's band the balance is.
   *  100 (capped) when there's no next tier — the top tier is always "full". */
  progressPercent: number;
}

export function getTierProgress(points: number): TierProgress {
  const tier = getTierForPoints(points);
  const nextTier = getNextTier(tier);

  if (!nextTier) {
    return { tier, nextTier: null, pointsToNextTier: 0, progressPercent: 100 };
  }

  const bandStart = tier.minPoints;
  const bandEnd = nextTier.minPoints;
  const bandSize = bandEnd - bandStart;
  const intoBand = Math.max(0, points - bandStart);

  const progressPercent = bandSize > 0 ? Math.min(100, Math.round((intoBand / bandSize) * 100)) : 100;
  const pointsToNextTier = Math.max(0, bandEnd - points);

  return { tier, nextTier, pointsToNextTier, progressPercent };
}

/**
 * Points a customer earns on a delivered order, given their tier BEFORE
 * this order (so the bonus reflects standing they've already earned, not
 * standing this very order would grant). Floors both the base calculation
 * and the multiplied result to whole points — mirrors the existing
 * Math.floor(totalAmount / POINTS_PER_CURRENCY_UNIT) behaviour in
 * mark-order-delivered.ts, just extended with the tier bonus.
 */
export function calculatePointsEarned(basePoints: number, pointsBeforeOrder: number): number {
  if (basePoints <= 0) return 0;
  const tier = getTierForPoints(pointsBeforeOrder);
  return Math.floor(basePoints * tier.pointsMultiplier);
}

/**
 * Automatic tier discount for a given order amount — no code needed,
 * unlike a Coupon. Applied by /api/orders and /api/checkout/create-session
 * against the subtotal AFTER any coupon discount (so a coupon and a tier
 * perk never double-discount the same dollar), and BEFORE gift card /
 * points redemption (those spend down what's left, they don't get
 * discounted further). Rounded to cents and never allowed to exceed the
 * amount it's discounting, same guard as calcDiscountAmount in
 * order-checkout-shared.ts.
 */
export function calcTierDiscountAmount(amountAfterCoupon: number, tier: LoyaltyTierDef): number {
  if (amountAfterCoupon <= 0 || tier.discountPercent <= 0) return 0;
  const raw = amountAfterCoupon * (tier.discountPercent / 100);
  return Math.round(Math.min(raw, amountAfterCoupon) * 100) / 100;
}
