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