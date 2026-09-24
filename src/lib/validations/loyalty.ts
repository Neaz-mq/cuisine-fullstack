import { z } from "zod";

/**
 * Admin → Loyalty forms.
 *
 * Numbers arrive as numbers (the modals convert before sending). Limits are
 * generous but finite, so a typo like 10000000 points can't slip through.
 */

/** "Target Point": spend this much on food → earn this many points. */
export const earnRuleSchema = z.object({
  spendAmount: z
    .number({ message: "Enter how much the customer spends" })
    .finite()
    .positive("Spend must be more than 0")
    .max(1_000_000, "Spend is too large"),
  points: z
    .number({ message: "Enter how many points they earn" })
    .int("Points must be a whole number")
    .min(1, "Points must be at least 1")
    .max(100_000, "Points are too large"),
});

/** PATCH body: either new values, or `{ apply: true }` to make it the active rule. */
export const earnRulePatchSchema = z.union([
  z.object({ apply: z.literal(true) }),
  earnRuleSchema,
]);

/** "Customer Ranking": a tier. */
export const tierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a ranking name")
    .max(30, "Keep the name under 30 characters"),
  minPoints: z
    .number({ message: "Enter the points this ranking starts at" })
    .int("Points must be a whole number")
    .min(0, "Points can't be negative")
    .max(10_000_000, "Points are too large"),
  discountPercent: z
    .number()
    .int("Discount must be a whole number")
    .min(0, "Discount can't be negative")
    .max(50, "Discount can be at most 50%")
    .default(0),
  bonusPercent: z
    .number()
    .int("Bonus must be a whole number")
    .min(0, "Bonus can't be negative")
    .max(300, "Bonus can be at most 300%")
    .default(0),
});

export type EarnRuleInput = z.infer<typeof earnRuleSchema>;
export type TierInput = z.infer<typeof tierSchema>;
