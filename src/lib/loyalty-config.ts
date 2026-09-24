import { prisma } from "@/lib/prisma";
import { toMoney, type Money } from "@/lib/money";
import {
  DEFAULT_TIER_ROWS,
  earnSentence,
  toTierDefs,
  type LoyaltyTierDef,
  type LoyaltyTierRow,
} from "@/lib/loyalty-tiers";

/**
 * src/lib/loyalty-config.ts
 *
 * Reads the loyalty program settings the owner edits on admin → Loyalty:
 *
 *   • Target Point  = LoyaltyEarnRule — "spend $X on food, earn Y points".
 *                     Several can be saved, exactly one is active.
 *   • Customer Ranking = LoyaltyTier — name + starting points + perks.
 *
 * Both tables start empty after `prisma db push`. The first read fills them
 * with the values the app used before they were editable (1 point per $10,
 * Bronze/Silver/Gold/Platinum), so nothing changes for customers until the
 * owner edits something. Fixed ids + skipDuplicates make that safe even if
 * two requests do it at the same moment.
 *
 * ⚠️ Server only (Prisma). Client components get the plain values as props.
 */

const DEFAULT_EARN_RULE_ID = "default-earn-rule";
const DEFAULT_EARN_SPEND = 10;
const DEFAULT_EARN_POINTS = 1;

export interface EarnRule {
  id: string;
  spendAmount: Money;
  points: number;
  isActive: boolean;
}

/** Tier rows as stored, lowest minPoints first. */
export async function getLoyaltyTierRows(): Promise<LoyaltyTierRow[]> {
  let rows = await prisma.loyaltyTier.findMany({
    orderBy: { minPoints: "asc" },
    select: { id: true, name: true, minPoints: true, discountPercent: true, bonusPercent: true },
  });
  if (rows.length === 0) {
    await prisma.loyaltyTier.createMany({ data: DEFAULT_TIER_ROWS, skipDuplicates: true });
    rows = await prisma.loyaltyTier.findMany({
      orderBy: { minPoints: "asc" },
      select: { id: true, name: true, minPoints: true, discountPercent: true, bonusPercent: true },
    });
  }
  return rows;
}

/** The tier list every tier calculation should use. */
export async function getLoyaltyTiers(): Promise<LoyaltyTierDef[]> {
  return toTierDefs(await getLoyaltyTierRows());
}

/** Every saved earn rule, active first, then newest. */
export async function getEarnRules(): Promise<EarnRule[]> {
  let rules = await prisma.loyaltyEarnRule.findMany({
    orderBy: [{ isActive: "desc" }, { spendAmount: "asc" }, { createdAt: "asc" }],
    select: { id: true, spendAmount: true, points: true, isActive: true },
  });
  if (rules.length === 0) {
    await prisma.loyaltyEarnRule.createMany({
      data: [
        {
          id: DEFAULT_EARN_RULE_ID,
          spendAmount: DEFAULT_EARN_SPEND,
          points: DEFAULT_EARN_POINTS,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
    rules = await prisma.loyaltyEarnRule.findMany({
      orderBy: [{ isActive: "desc" }, { spendAmount: "asc" }, { createdAt: "asc" }],
      select: { id: true, spendAmount: true, points: true, isActive: true },
    });
  }
  return rules;
}

/** The rule that decides points on new orders, or null if none is active. */
export async function getActiveEarnRule(): Promise<EarnRule | null> {
  const rules = await getEarnRules();
  return rules.find((rule) => rule.isActive) ?? null;
}

/**
 * Points for a food subtotal under a rule — proportional, rounded down.
 * Spend $1,000 → 10 pts means a $250 order earns 2 (2.5 rounded down).
 */
export function pointsForSpend(subtotal: Money, rule: Pick<EarnRule, "spendAmount" | "points"> | null): number {
  if (!rule || rule.points <= 0 || rule.spendAmount.lessThanOrEqualTo(0)) return 0;
  const raw = toMoney(subtotal).times(rule.points).dividedBy(rule.spendAmount).floor().toNumber();
  return Math.max(0, raw);
}

/** "Spend $1,000 on food and earn 10 points" for a stored rule. */
export function earnRuleSentence(
  rule: Pick<EarnRule, "spendAmount" | "points">,
  currency: string
): string {
  return earnSentence(rule.spendAmount.toNumber(), rule.points, currency);
}

/** Friendly reason a tier can't be saved as given, or null. Used by the tier API routes. */
export function tierClash(
  rows: { id: string; name: string; minPoints: number }[],
  input: { name: string; minPoints: number },
  selfId: string | null
): string | null {
  const others = rows.filter((row) => row.id !== selfId);
  if (others.some((row) => row.name.toLowerCase() === input.name.toLowerCase())) {
    return "A ranking with this name already exists.";
  }
  if (input.minPoints === 0 && selfId === null) {
    return "0 points is the starting ranking. Pick a higher number.";
  }
  const samePoints = others.find((row) => row.minPoints === input.minPoints);
  if (samePoints) {
    return `"${samePoints.name}" already starts at ${input.minPoints.toLocaleString("en-US")} points.`;
  }
  return null;
}
