import { z } from "zod";
import { nonEmptyString, quantitySchema } from "@/lib/validations/common";
import { SHIPPING_METHODS, ORDER_TYPES } from "@/lib/order-checkout-shared";

/**
 * src/lib/validations/checkout.ts
 *
 * Deliberately a THIN structural layer, not a re-implementation of
 * business rules that already live in order-checkout-shared.ts:
 *
 *  - validateBilling() already enforces which Billing fields are required
 *    per order type (DELIVERY vs DINE_IN) and the exact phone format —
 *    that's genuine conditional business logic, not just "shape", so it's
 *    left in place and still called as-is after this schema parses.
 *  - resolveOrderItems() already resolves real prices/categoryIds from the
 *    DB and rejects unavailable/unknown items — this schema only checks
 *    that each cart line has the right shape before that lookup happens.
 *
 * What this schema adds that didn't exist before: guaranteed *types*
 * (items is really an array of well-shaped objects, quantity is really a
 * positive integer, shippingMethod/orderType are really one of the known
 * enum values) before any of the business-logic functions above ever see
 * the data — so a malformed request fails fast with one clear message
 * instead of potentially throwing deep inside business logic and coming
 * back as a generic 500.
 */

export const incomingItemSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: nonEmptyString("Item title"),
  quantity: quantitySchema,
});

/** Mirrors the Billing interface in order-checkout-shared.ts. All the
 * conditionally-required fields (email/address/city/state/zip for
 * DELIVERY) stay optional here on purpose — validateBilling() is what
 * enforces the DELIVERY-vs-DINE_IN requirement, right after this schema
 * parses. Duplicating "required for DELIVERY" here too would just create
 * two places that could drift out of sync. */
export const billingSchema = z.object({
  email: z.string().trim().optional(),
  firstName: nonEmptyString("First name"),
  lastName: nonEmptyString("Last name"),
  phone: nonEmptyString("Phone"),
  country: z.string().trim().optional(),
  address: z.string().trim().optional(),
  apartment: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  marketingConsent: z.boolean().optional(),
});

const baseOrderFields = {
  items: z.array(incomingItemSchema).min(1, "Cart is empty"),
  billing: billingSchema,
  couponCode: z.string().trim().optional(),
  giftCardCode: z.string().trim().optional(),
};

/** POST /api/checkout/create-session — online/Stripe, DELIVERY-only, so
 * shippingMethod is always required here (unlike the shared order schema
 * below, where it's only required when orderType ends up DELIVERY). */
export const createCheckoutSessionSchema = z.object({
  ...baseOrderFields,
  shippingMethod: z.enum(SHIPPING_METHODS),
});

/** POST /api/orders — covers both DELIVERY (COD) and DINE_IN. shippingMethod
 * is optional at the schema level because DINE_IN never sends one; the
 * route's existing `SHIPPING_METHODS.includes(...)` check right after this
 * parse still enforces it's present for DELIVERY. tableId is only checked
 * for non-empty string here — it's validated against a real, active table
 * in the DB by the route itself, same as before. */
export const createOrderSchema = z.object({
  ...baseOrderFields,
  shippingMethod: z.enum(SHIPPING_METHODS).optional(),
  orderType: z.enum(ORDER_TYPES).default("DELIVERY"),
  tableId: z.string().trim().min(1).optional(),
});