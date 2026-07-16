import { z } from "zod";
import { cuidSchema, nonEmptyString } from "@/lib/validations/common";

/**
 * src/lib/validations/admin.ts
 *
 * Schemas for the smaller admin CRUD routes (tables, categories, reviews,
 * loyalty adjustments, restaurant settings, marketing broadcast). Grouped
 * in one file since each is a handful of fields — not worth a dedicated
 * file per route the way menu-item/checkout/reservation are.
 */

// ---------------------------------------------------------------------------
// Tables (RestaurantTable)
// ---------------------------------------------------------------------------
export const createTableSchema = z.object({
  label: nonEmptyString("Table label"),
  capacity: z.number().int().positive("Capacity must be at least 1"),
  isActive: z.boolean().default(true),
});

/** PATCH previously did `data: body` directly — any extra field on the
 * request body (e.g. `id`, or an unrelated key) got written straight to
 * the row. `.strict()`-free `.partial()` here still only picks the three
 * known keys back out, so mass-assignment is closed even though the route
 * itself no longer hand-picks fields. */
export const updateTableSchema = createTableSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const createCategorySchema = z.object({
  name: nonEmptyString("Category name"),
});

export const updateCategorySchema = createCategorySchema;

// ---------------------------------------------------------------------------
// Reviews — moderation only touches `status`
// ---------------------------------------------------------------------------
export const updateReviewStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

// ---------------------------------------------------------------------------
// Loyalty — manual point adjustment
// ---------------------------------------------------------------------------
export const loyaltyAdjustSchema = z.object({
  userId: cuidSchema,
  // Manual route logic rejected 0 as "not an adjustment"; keep that rule.
  points: z.number().int().refine((n) => n !== 0, "Points must be a non-zero integer"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Restaurant settings (singleton row)
// ---------------------------------------------------------------------------
export const updateSettingsSchema = z
  .object({
    timezone: nonEmptyString("Timezone"),
    kitchenOpenHour: z.number().int().min(0).max(23),
    kitchenCloseHour: z.number().int().min(0).max(23),
  })
  .refine((data) => data.kitchenOpenHour !== data.kitchenCloseHour, {
    message: "Kitchen open and close hour can't be the same",
    path: ["kitchenCloseHour"],
  });

// ---------------------------------------------------------------------------
// Marketing broadcast email
// ---------------------------------------------------------------------------
export const broadcastSchema = z.object({
  subject: nonEmptyString("Subject"),
  headline: z.string().trim().optional().or(z.literal("")),
  message: nonEmptyString("Message"),
  ctaText: z.string().trim().optional().or(z.literal("")),
  // Empty string is allowed through (route falls back to NEXT_PUBLIC_APP_URL)
  // but if the admin *did* type something, it must be a real URL — the old
  // code sent whatever was typed straight into the email template unchecked.
  ctaUrl: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
});
