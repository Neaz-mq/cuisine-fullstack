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
  /**
   * ⚠️ ঐচ্ছিক, আর সেটাই ইচ্ছাকৃত।
   *
   * চেকআউট ফর্মে এখন একটাই "Full Name" ঘর (Figma), আর সেটা শেষ
   * space-এ ভাগ করা হয়। কেউ শুধু "Ridoy" লিখলে ভাগ করার কিছু থাকে
   * না — তখন পুরোটা firstName-এ যায় আর এটা ফাঁকা।
   *
   * নাম দু'ভাগে ভাগ করাটা এমনিতেই ভঙ্গুর: পৃথিবীর বড় অংশে
   * "first/last" ধারণাটাই নেই, আর Shopify বা Stripe Checkout দুটোই
   * একটামাত্র নাম রাখে। এখানে দুটো কলাম রয়ে গেছে কেবল পুরোনো
   * অর্ডারের সাথে সঙ্গতির জন্য।
   *
   * ⚠️ `.default("")` — Prisma-র কলামটা `String`, তাই null নয়, খালি
   * string। কোনো migration লাগে না।
   */
  lastName: z.string().trim().default(""),
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
  // Loyalty points the customer wants to redeem for a discount — only
  // meaningful for a logged-in user (see lib/loyalty-redemption.ts); the
  // route silently ignores this for guest checkout. Server-clamped to
  // what the account actually has and what the order total can absorb,
  // never trusted as an authoritative discount amount from the client.
  redeemPoints: z.number().int().nonnegative().optional(),

  // বকশিশ। দুটোর যেকোনো একটা আসতে পারে — নির্দিষ্ট অঙ্ক, বা ছাড়-পরবর্তী
  // subtotal-এর শতাংশ। দুটোই এলে pricing.ts শতাংশটাকে প্রাধান্য দেয়।
  //
  // এখানে কোনো "tipping allowed কিনা" যাচাই নেই, ইচ্ছাকৃতভাবে: সেটা
  // RestaurantSettings.tipEnabled-এর সিদ্ধান্ত, আর calculateOrderPricing
  // বন্ধ থাকলে জোর করে শূন্য করে দেয়। schema-য় দ্বিতীয়বার নিয়মটা লিখলে
  // একদিন দুই জায়গায় দুই নিয়ম হয়ে যেতো।
  tipAmount: z.number().nonnegative().optional(),
  tipPercent: z.number().min(0).max(100).optional(),
};

/**
 * POST /api/checkout/quote — read-only, prices the live cart.
 *
 * billing নেই, ইচ্ছাকৃতভাবে: গ্রাহক এখনো ঠিকানা টাইপ করছেন, অথচ বিলটা
 * তার আগেই দেখাতে হবে। শুধু phone নেওয়া হয় (ঐচ্ছিক), কারণ per-customer
 * coupon limit ওটার উপর নির্ভর করে — নইলে quote-এ ছাড় দেখিয়ে order-এ
 * গিয়ে "already used" বলা হতো।
 */
export const quoteSchema = z.object({
  items: z.array(incomingItemSchema).min(1, "Cart is empty"),
  orderType: z.enum(ORDER_TYPES).default("DELIVERY"),
  phone: z.string().trim().optional(),

  /**
   * ঠিকানা — দূরত্ব-ভিত্তিক delivery charge quote করার জন্য।
   *
   * ⚠️ ঐচ্ছিক, আর প্রতিটা মাঠও ঐচ্ছিক (`.partial()`), আর সেটাই মূল
   * কথা: উপরের comment যে কারণে billing বাদ দিয়েছে, ঠিক সেই কারণেই
   * এটা আলগা — গ্রাহক তখনো টাইপ করছেন, অথচ বিলটা তার আগেই দেখাতে
   * হবে। শহর/দেশ ভরার আগ পর্যন্ত lib/delivery-fee.ts-এর
   * isGeocodable() false দেয়, তাই flat ফি দেখানো হয় আর ঠিকানা
   * সম্পূর্ণ হলে quote নিজে থেকেই ঠিক হয়ে যায়।
   *
   * ⚠️ এটা কোনো authoritative ফি নয়। /api/orders আর
   * /api/checkout/create-session নিজেরাই আবার হিসাব করে — client যা
   * পাঠিয়েছে তা থেকে নয়, ঠিক যেভাবে দাম, coupon বা gift card
   * কোনোটাই client-এর সংখ্যা থেকে নেওয়া হয় না।
   */
  deliveryAddress: billingSchema.partial().optional(),
  couponCode: z.string().trim().optional(),
  giftCardCode: z.string().trim().optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  tipAmount: z.number().nonnegative().optional(),
  tipPercent: z.number().min(0).max(100).optional(),
});

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