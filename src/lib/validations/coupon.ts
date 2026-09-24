import { z } from "zod";
import { nonEmptyString } from "@/lib/validations/common";
import { incomingItemSchema } from "@/lib/validations/checkout";

/**
 * src/lib/validations/coupon.ts
 *
 * These are the two public, unauthenticated preview endpoints
 * (coupons/validate, gift-cards/validate) — already rate-limited (see
 * rate-limit.ts) since codes are guessable strings. Rate limiting stops
 * *volume*; this schema stops a malformed/garbage request from throwing
 * deep inside findValidCoupon/findValidGiftCard and surfacing as a
 * generic 500 instead of a clean 400.
 */
export const validateCouponSchema = z.object({
  code: nonEmptyString("Coupon code"),
  items: z.array(incomingItemSchema).min(1, "Cart is empty"),
  phone: z.string().trim().optional(),
  // So a free-delivery coupon can be refused on a dine-in order.
  orderType: z.enum(["DELIVERY", "DINE_IN"]).optional(),
});

/**
 * PATCH /api/admin/coupons/[id] — only the "business terms" fields stay
 * editable after creation (code/type/percentOff/fixedOff are locked, see
 * the route's own doc comment). All optional since the route accepts any
 * subset, but at least one must be present.
 */
export const updateCouponSchema = z
  .object({
    isActive: z.boolean().optional(),
    minOrderValue: z.number().nonnegative("Minimum order value must be zero or a positive number").nullable().optional(),
    maxDiscountAmount: z.number().positive("Max discount cap must be a positive number").nullable().optional(),
    // CouponForm sends a `datetime-local` input value (e.g.
    // "2026-06-15T14:30", no timezone offset/seconds) or null when the
    // field is cleared — not a strict ISO-8601 string, so this just checks
    // `new Date(...)` can parse it rather than using z.iso.datetime().
    startsAt: z
      .string()
      .trim()
      .min(1)
      .refine((s) => !Number.isNaN(new Date(s).getTime()), "Start date is invalid")
      .transform((s) => new Date(s))
      .nullable()
      .optional(),
    expiresAt: z
      .string()
      .trim()
      .min(1)
      .refine((s) => !Number.isNaN(new Date(s).getTime()), "Expiry date is invalid")
      .transform((s) => new Date(s))
      .nullable()
      .optional(),
    usageLimit: z.number().int().positive("Usage limit must be a positive whole number").nullable().optional(),
    perCustomerLimit: z.number().int().positive("Per-customer limit must be a positive whole number").nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No editable fields provided",
  });
/**
 * The "Create New Coupon" / "Edit Coupon" modal on /admin/coupons — the
 * whole coupon in one body (POST /api/admin/coupons and PATCH
 * /api/admin/coupons/[id]).
 *
 * Dates are calendar days ("2026-08-01") in the restaurant's time zone;
 * the expiry date is the LAST day the code works. The route turns them into
 * instants (see src/lib/coupon-admin.ts).
 */
const couponDay = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Coupon code needs at least 3 characters")
      .max(30, "Coupon code can be at most 30 characters")
      .regex(/^[A-Z0-9_-]+$/, "Use only letters, numbers, - and _ in the code (no spaces)"),
    label: optionalText(40, "Tag / Label"),
    headline: optionalText(80, "Headline"),
    description: optionalText(300, "Description"),
    isActive: z.boolean(),
    type: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]),
    // Percent (1-100) or amount; ignored for FREE_DELIVERY.
    value: z.number().finite().nullable().optional(),
    maxDiscountAmount: z.number().finite().positive("Max discount must be more than 0").nullable().optional(),
    minOrderValue: z.number().finite().nonnegative("Minimum order can't be negative").nullable().optional(),
    usageLimit: z.number().int("Usage limit must be a whole number").positive("Usage limit must be at least 1").nullable().optional(),
    perCustomerLimit: z.number().int("Uses per customer must be a whole number").positive("Uses per customer must be at least 1").nullable().optional(),
    startDate: couponDay.nullable().optional(),
    endDate: couponDay.nullable().optional(),
    audience: z.enum(["ALL", "NEW_CUSTOMERS", "MEMBERS"]),
    restrictedCategoryIds: z.array(z.string().trim().min(1)).max(50).default([]),
    // Left out = keep whatever item restriction the coupon already has
    // (the modal doesn't edit single items). [] clears it.
    restrictedItemIds: z.array(z.string().trim().min(1)).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENT") {
      if (data.value == null || !Number.isInteger(data.value) || data.value < 1 || data.value > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage must be a whole number from 1 to 100" });
      }
    } else if (data.type === "FIXED") {
      if (data.value == null || data.value <= 0) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Discount amount must be more than 0" });
      }
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Expiry date can't be before the start date" });
    }
  });

export type CouponFormInput = z.infer<typeof couponFormSchema>;
