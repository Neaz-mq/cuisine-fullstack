import { z } from "zod";

/**
 * Body of POST /api/orders/[id]/review — the "How Was Your Food
 * Experience?" pop-up on the tracking page.
 *
 * Two parts, and the customer may send either or both:
 *
 *   comment — the written review of the whole order (OrderReview).
 *   ratings — 1–5 stars per dish in the order. Each one becomes a `Review`
 *             row (PENDING), which is what /admin/reviews moderates and,
 *             once approved, what the dish's menu page shows.
 *
 * ⚠️ `.trim()` runs before the length check, so a comment of only spaces
 * counts as empty. 2000 characters is generous for a meal review and stops
 * someone pushing megabytes in one request.
 */
export const orderReviewSchema = z
  .object({
    comment: z
      .string()
      .trim()
      .max(2000, "That's a bit too long — please keep it under 2000 characters")
      .optional()
      .default(""),
    ratings: z
      .array(
        z.object({
          menuItemId: z.string().min(1).max(64),
          rating: z.number().int().min(1).max(5),
        })
      )
      // An order never has anywhere near this many different dishes; the
      // cap just stops an oversized request.
      .max(50)
      .optional()
      .default([]),
  })
  .refine((body) => body.comment.length > 0 || body.ratings.length > 0, {
    message: "Please rate a dish or write a few words about your experience",
  });
