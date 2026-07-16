import { z } from "zod";
import { emailSchema, nonEmptyString } from "@/lib/validations/common";
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
});

export const validateGiftCardSchema = z.object({
  code: nonEmptyString("Gift card code"),
  orderTotal: z.number().finite().nonnegative("Invalid order total"),
});

/** MIN/MAX kept in sync with the route's own constants — duplicated here
 * rather than imported since gift-cards/purchase/route.ts defines them
 * inline as local consts, not exported. */
export const purchaseGiftCardSchema = z.object({
  amount: z
    .number()
    .finite()
    .min(5, "Gift card amount must be between $5 and $500")
    .max(500, "Gift card amount must be between $5 and $500"),
  purchaserEmail: emailSchema,
  purchaserName: z.string().trim().optional(),
  recipientEmail: z.string().trim().email("Enter a valid recipient email").optional().or(z.literal("")),
  recipientName: z.string().trim().optional(),
  message: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/gift-cards — a staff-issued card (comp/refund/goodwill),
 * no Stripe payment involved. Unlike the customer purchase flow above, no
 * $5-$500 ceiling: an admin refund/comp legitimately might need to exceed
 * that, so only "positive number" is enforced here.
 */
export const issueGiftCardSchema = z.object({
  amount: z.number().finite().positive("Amount must be a positive number"),
  recipientEmail: emailSchema,
  recipientName: z.string().trim().optional(),
  purchaserName: z.string().trim().optional(),
  message: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/admin/gift-cards/[id] — two independent optional operations
 * in one request (see the route's own doc comment): flip `isActive`,
 * and/or apply a signed balance `adjustment`. At least one of the three
 * keys must be present or the route has nothing to do.
 */
export const adjustGiftCardSchema = z
  .object({
    isActive: z.boolean().optional(),
    adjustment: z
      .number()
      .finite()
      .refine((n) => n !== 0, "Adjustment must be a non-zero number")
      .optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.isActive !== undefined || data.adjustment !== undefined, {
    message: "No editable fields provided",
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