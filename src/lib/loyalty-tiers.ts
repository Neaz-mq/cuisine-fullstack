/**
 * src/lib/loyalty-tiers.ts
 *
 * Loyalty tiers ("Customer Ranking" in admin → Loyalty) — derived purely from
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
 *   - Thresholds can be changed (admin → Loyalty → Customer Ranking)
 *     without backfilling anything.
 *
 * The tiers themselves now live in the LoyaltyTier table (read through
 * lib/loyalty-config.ts). Every function here takes the list as a
 * parameter; LOYALTY_TIERS below is only the built-in default — what the
 * table is seeded with, and what the tests use.
 *
 * ⚠️ Pure functions only — NO import that reaches Prisma, directly or
 * transitively. This is not a style preference; it is a build
 * requirement.
 *
 * LoyaltyAdjustRow.tsx is a client component and imports this file. The
 * generated Prisma client pulls in `node:module`, which cannot exist in a
 * browser bundle — so the moment this file imports anything that reaches
 * Prisma (lib/money.ts does), `next build` dies with "the chunking
 * context does not support external modules". tsc and vitest both stay
 * green, so the only place it surfaces is the production build.
 *
 * That is exactly what happened during the money-model migration, and it
 * is why calcTierDiscountAmount below returns a plain number rather than
 * a Decimal.
 */

import { symbolFor } from "@/lib/currency-format";

/** "$1,000" / "$12.50" / "BDT 500" — whole amounts without the ".00". */
export function formatSpend(amount: number, currency: string): string {
  const whole = Number.isInteger(amount);
  const text = amount.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  const symbol = symbolFor(currency);
  return symbol ? `${symbol}${text}` : `${currency} ${text}`;
}

/** Figma wording: "Spend $1,000 on food and earn 10 points". */
export function earnSentence(spend: number, points: number, currency: string): string {
  return `Spend ${formatSpend(spend, currency)} on food and earn ${points.toLocaleString("en-US")} ${
    points === 1 ? "point" : "points"
  }`;
}

export interface LoyaltyTierDef {
  /** LoyaltyTier.id from the database (the defaults below use fixed ids). */
  id: string;
  label: string;
  /** Minimum loyaltyPoints balance required to be in this tier. */
  minPoints: number;
  /**
   * Multiplier applied to points earned on a delivered order while the
   * customer is in this tier (see mark-order-delivered.ts). 1 = base rate,
   * 1.25 = 25% bonus points. Stored as LoyaltyTier.bonusPercent.
   */
  pointsMultiplier: number;
  /**
   * Automatic percentage discount applied at checkout while the customer
   * is in this tier — no code needed, unlike a Coupon. 0 = none.
   */
  discountPercent: number;
  /** Tailwind classes for the tier's badge chip. */
  badgeClassName: string;
}

/** Plain shape of a LoyaltyTier row — what toTierDefs() takes. */
export interface LoyaltyTierRow {
  id: string;
  name: string;
  minPoints: number;
  discountPercent: number;
  bonusPercent: number;
}

// Badge colours by position (lowest tier first). A tier past the end of
// the list reuses the last colour.
const BADGE_CLASSES = [
  "bg-orange-100 text-orange-800 border border-orange-200",
  "bg-gray-200 text-gray-700 border border-gray-300",
  "bg-yellow-100 text-yellow-800 border border-yellow-300",
  "bg-[#2C6252]/10 text-[#2C6252] border border-[#2C6252]/30",
  "bg-purple-100 text-purple-800 border border-purple-200",
];

export function tierBadgeClass(index: number): string {
  return BADGE_CLASSES[Math.min(Math.max(index, 0), BADGE_CLASSES.length - 1)];
}

/** DB rows → tier list sorted lowest minPoints first. */
export function toTierDefs(rows: LoyaltyTierRow[]): LoyaltyTierDef[] {
  return [...rows]
    .sort((a, b) => a.minPoints - b.minPoints)
    .map((row, index) => ({
      id: row.id,
      label: row.name,
      minPoints: row.minPoints,
      pointsMultiplier: 1 + row.bonusPercent / 100,
      discountPercent: row.discountPercent,
      badgeClassName: tierBadgeClass(index),
    }));
}

/**
 * The built-in tiers — what the LoyaltyTier table is seeded with the first
 * time it's read, so existing customers keep exactly the tier and perks
 * they had before tiers became editable.
 */
export const DEFAULT_TIER_ROWS: LoyaltyTierRow[] = [
  { id: "BRONZE", name: "Bronze", minPoints: 0, discountPercent: 0, bonusPercent: 0 },
  { id: "SILVER", name: "Silver", minPoints: 200, discountPercent: 3, bonusPercent: 10 },
  { id: "GOLD", name: "Gold", minPoints: 500, discountPercent: 5, bonusPercent: 25 },
  { id: "PLATINUM", name: "Platinum", minPoints: 1000, discountPercent: 8, bonusPercent: 50 },
];

export const LOYALTY_TIERS: LoyaltyTierDef[] = toTierDefs(DEFAULT_TIER_ROWS);

/** Highest tier whose minPoints threshold the balance meets or exceeds. */
export function getTierForPoints(
  points: number,
  tiers: LoyaltyTierDef[] = LOYALTY_TIERS
): LoyaltyTierDef {
  const list = tiers.length ? tiers : LOYALTY_TIERS;
  let current = list[0];
  for (const tier of list) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

/** The tier immediately above the given one, or null if already top tier. */
export function getNextTier(
  tier: LoyaltyTierDef,
  tiers: LoyaltyTierDef[] = LOYALTY_TIERS
): LoyaltyTierDef | null {
  const index = tiers.findIndex((t) => t.id === tier.id);
  if (index === -1 || index === tiers.length - 1) return null;
  return tiers[index + 1];
}

/** "0–199 Points" / "1,000+ Points" — the band of points a tier covers. */
export function tierRangeLabel(tier: LoyaltyTierDef, tiers: LoyaltyTierDef[]): string {
  const next = getNextTier(tier, tiers);
  const from = tier.minPoints.toLocaleString("en-US");
  return next
    ? `${from}–${(next.minPoints - 1).toLocaleString("en-US")} Points`
    : `${from}+ Points`;
}

/** Customer-facing perk lines, built from the tier's own numbers. */
export function tierPerks(tier: LoyaltyTierDef, earnRuleText: string | null): string[] {
  const perks: string[] = [];
  if (earnRuleText) perks.push(earnRuleText);
  const bonus = Math.round((tier.pointsMultiplier - 1) * 100);
  if (bonus > 0) perks.push(`${bonus}% bonus points on every order`);
  if (tier.discountPercent > 0) perks.push(`Automatic ${tier.discountPercent}% off every order`);
  if (perks.length === 0) perks.push("Collect points on every order");
  return perks;
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

export function getTierProgress(
  points: number,
  tiers: LoyaltyTierDef[] = LOYALTY_TIERS
): TierProgress {
  const tier = getTierForPoints(points, tiers);
  const nextTier = getNextTier(tier, tiers);

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
export function calculatePointsEarned(
  basePoints: number,
  pointsBeforeOrder: number,
  tiers: LoyaltyTierDef[] = LOYALTY_TIERS
): number {
  if (basePoints <= 0) return 0;
  const tier = getTierForPoints(pointsBeforeOrder, tiers);
  return Math.floor(basePoints * tier.pointsMultiplier);
}

/**
 * Tier discount as a plain number — for PREVIEW and display only.
 *
 * ⚠️ This is NOT what the checkout routes use. They pass
 * tier.discountPercent straight into calculateOrderPricing, which does
 * the same arithmetic in Decimal and rounds it to the restaurant's
 * currency. Two reasons that split exists:
 *
 *   1. This file cannot touch Decimal at all (see the header note) —
 *      a client component imports it.
 *   2. Only pricing.ts knows how many decimal places the currency has:
 *      0 for yen, 3 for Kuwaiti dinar. Rounding here would invent
 *      fractional yen.
 *
 * Float is acceptable for a preview figure the customer sees before
 * checkout; the authoritative number is computed server-side in Decimal
 * when the order is actually created. Never allowed to exceed the amount
 * it's discounting, same guard as calcDiscountAmount.
 */
export function calcTierDiscountAmount(amountAfterCoupon: number, tier: LoyaltyTierDef): number {
  if (amountAfterCoupon <= 0 || tier.discountPercent <= 0) return 0;
  return Math.min(amountAfterCoupon * (tier.discountPercent / 100), amountAfterCoupon);
}
