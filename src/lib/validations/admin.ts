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

/** POST /api/tables (public-facing, staff-scoped route, distinct from
 * /api/admin/tables) — same fields but `capacity` is optional here since
 * the route falls back to a default of 4 rather than rejecting a missing
 * value, and there's no `isActive` toggle on creation. */
export const publicCreateTableSchema = z.object({
  label: nonEmptyString("Table label"),
  capacity: z.number().int().positive().optional(),
});

/** GET /api/tables?reservedAt=... — optional ISO date/time string used to
 * compute per-table availability. Previously checked with a manual
 * `Number.isNaN(new Date(...).getTime())` inline in the route; same rule,
 * just expressed as a schema so it goes through parseQuery like every
 * other query-param route. */
export const tablesAvailabilityQuerySchema = z.object({
  reservedAt: z
    .string()
    .trim()
    .min(1)
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "reservedAt must be a valid date/time")
    .optional(),
});

/** GET /api/admin/notifications?since=... — optional cursor timestamp for
 * "how many new orders since I last checked". Same "just needs to parse as
 * a date" rule as tablesAvailabilityQuerySchema above. */
export const notificationsQuerySchema = z.object({
  since: z
    .string()
    .trim()
    .min(1)
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "since must be a valid date/time")
    .optional(),
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
/**
 * হার শতাংশ হিসেবে আসে ("5" = ৫%), কারণ owner সেটাই টাইপ করে। ভগ্নাংশে
 * রূপান্তর হয় route-এ, ঠিক DB-তে লেখার আগে — form-এ 0.05 লিখতে বলা মানে
 * একদিন কেউ 5 লিখে ফেলবে আর ৫০০% VAT আদায় হবে।
 *
 * ৩ দশমিক পর্যন্ত অনুমোদিত: মার্কিন sales tax সত্যিই 8.875%-এর মতো হয়।
 * উপরের সীমা ১০০% — অযৌক্তিক শোনালেও কিছু জায়গায় তামাক/মদে করের হার
 * ৫০% ছাড়ায়, তাই ২০-৩০%-এ আটকানো ভুল হতো।
 */
const percentRate = z
  .number()
  .min(0, "Rate can't be negative")
  .max(100, "Rate can't exceed 100%")
  .refine((n) => Number.isFinite(n) && Math.round(n * 1000) === n * 1000, {
    message: "Rate can have at most 3 decimal places",
  });

export const updateSettingsSchema = z
  .object({
    timezone: nonEmptyString("Timezone"),
    kitchenOpenHour: z.number().int().min(0).max(23),
    kitchenCloseHour: z.number().int().min(0).max(23),

    // ISO 4217 — তিন অক্ষর, বড় হাতের। Intl.NumberFormat এর বাইরে কিছু
    // পেলে throw করে, তাই এখানেই আটকানো ভালো।
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code, e.g. USD"),

    // ০ (JPY, KRW), ২ (বেশিরভাগ), ৩ (KWD, BHD, OMR)। ১ ব্যবহার করে এমন
    // কোনো প্রচলিত currency নেই, কিন্তু নিষেধ করার কারণও নেই।
    currencyMinorUnits: z.number().int().min(0).max(3),

    taxEnabled: z.boolean(),
    taxName: nonEmptyString("Tax name").pipe(z.string().max(30)),
    taxMode: z.enum(["INCLUSIVE", "EXCLUSIVE"]),
    taxRateDineIn: percentRate,
    taxRateDelivery: percentRate,

    serviceChargeRate: percentRate,
    serviceChargeTaxable: z.boolean(),

    deliveryFeeFlat: z.number().min(0, "Delivery fee can't be negative"),
    deliveryFeeTaxable: z.boolean(),

    tipEnabled: z.boolean(),
    // সর্বোচ্চ ৪টা button — এর বেশি হলে checkout-এ বেছে নেওয়া কঠিন হয়ে
    // যায়, বিশেষত মোবাইলে। ০% preset অর্থহীন, তাই min 1.
    tipPresetPercents: z.array(z.number().int().min(1).max(100)).max(4),
  })
  .refine((data) => data.kitchenOpenHour !== data.kitchenCloseHour, {
    message: "Kitchen open and close hour can't be the same",
    path: ["kitchenCloseHour"],
  })
  .refine((data) => !data.taxEnabled || data.taxName.trim().length > 0, {
    message: "Give the tax a name — it's printed on every invoice",
    path: ["taxName"],
  })
  .refine((data) => !data.tipEnabled || data.tipPresetPercents.length > 0, {
    message: "Add at least one tip percentage, or turn tipping off",
    path: ["tipPresetPercents"],
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
