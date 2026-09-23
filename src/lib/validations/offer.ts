import { z } from "zod";

/**
 * Body of POST /api/admin/offers and PATCH /api/admin/offers/[id] — the
 * Create Offer / Add Offer / Edit Offer modal on /admin/offers.
 *
 * Dates are the calendar days the modal shows ("2026-08-01"), not instants:
 * the route turns them into midnight in the restaurant's own time zone
 * (see zonedDayStart in src/lib/product-offers.ts). The expiry date is the
 * LAST day the offer runs.
 *
 * Rules that need the database (price of the dish, other offers on it)
 * are checked in the route.
 */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Pick a valid date");

export const offerSchema = z
  .object({
    menuItemId: z.string().trim().min(1, "Pick a product"),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().finite().positive("Discount value must be more than 0"),
    audience: z.enum(["ALL", "MEMBERS"]).default("ALL"),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENT" && (!Number.isInteger(data.value) || data.value < 1 || data.value > 99)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage must be a whole number from 1 to 99",
      });
    }
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Expiry date can't be before the start date",
      });
    }
  });

export type OfferInput = z.infer<typeof offerSchema>;
