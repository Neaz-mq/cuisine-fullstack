import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

export const SHIPPING_METHODS = ["UBER_EATS", "FOOD_PANDA"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const ORDER_TYPES = ["DELIVERY", "DINE_IN"] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

// email/country/address/city/state/zip are OPTIONAL on the Billing shape as
// of QR Table Ordering — a DINE_IN order has no delivery destination, so
// these are simply never collected for it. They're still required in
// practice for DELIVERY orders — enforced below in validateBilling, not by
// the type itself, since the same interface now covers both order types.
export interface Billing {
  email?: string;
  firstName: string;
  lastName: string;
  phone: string;
  country?: string;
  address?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/**
 * firstName/lastName/phone are always required (staff still need a name to
 * call out at the table for DINE_IN orders). email/country/address/city/
 * state/zip are only required for DELIVERY — a DINE_IN order skips them
 * entirely since nothing is being shipped anywhere.
 */
// Digits only, optional leading "+" for a country code, 7-15 digits — E.164
// max length. Mirrors the client-side check in Carts.tsx — enforced here
// too so a direct API call (bypassing the UI entirely) can't submit a
// phone number containing letters/symbols.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export function validateBilling(
  billing: Billing,
  orderType: OrderTypeValue = "DELIVERY"
): string | null {
  const alwaysRequired: (keyof Billing)[] = ["firstName", "lastName", "phone"];
  const deliveryOnlyRequired: (keyof Billing)[] = [
    "email",
    "country",
    "address",
    "city",
    "state",
    "zip",
  ];

  const requiredFields =
    orderType === "DINE_IN" ? alwaysRequired : [...alwaysRequired, ...deliveryOnlyRequired];

  const missingField = requiredFields.find((f) => !billing?.[f]?.trim());
  if (missingField) return `Billing field "${missingField}" is required`;

  if (!PHONE_REGEX.test(billing.phone.trim())) {
    return "Phone number must contain only digits (7-15 digits, optional + country code)";
  }

  return null;
}

export interface IncomingItem {
  id?: string; // real MenuItem.id — present for anything added via the DB-backed /menu page (Items.tsx) or Order Again
  title: string;
  quantity: number;
}

export interface ResolvedItem {
  menuItemId: string;
  categoryId: string;
  price: number;
  quantity: number;
  title: string;
}

/**
 * ---------------------------------------------------------------------
 * Resolution strategy — id-first, title as a fallback for legacy callers:
 * ---------------------------------------------------------------------
 * Items.tsx (the /menu page) and Order Again both now add cart lines using
 * the real MenuItem.id — see GET /api/menu. When `item.id` is present, it's
 * used directly (a straightforward, correct foreign-key lookup).
 *
 * A few homepage marketing sections (Popular.tsx, Signature.tsx,
 * Weekly.tsx, Category.tsx) still render their own hardcoded item arrays
 * and add to cart with `id: slugify(title)` — not a real MenuItem.id. For
 * those, `item.id` won't match any real MenuItem, so resolution falls back
 * to matching on `title` (case-insensitive), same as before. This keeps
 * those sections working without a crash while they're still on the
 * hardcoded shim; migrating them to /api/menu is a separate, tracked
 * follow-up, not done in this pass.
 *
 * Both paths only ever match an isAvailable MenuItem — an item pulled off
 * the menu mid-checkout is treated as not-found either way.
 * ---------------------------------------------------------------------
 */
export async function resolveOrderItems(
  items: IncomingItem[]
): Promise<{ ok: true; items: ResolvedItem[] } | { ok: false; error: string }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Cart is empty" };
  }

  const resolved: ResolvedItem[] = [];
  const notFoundTitles: string[] = [];

  for (const item of items) {
    if (!item.title || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return {
        ok: false,
        error: "Each cart item needs a title and a positive integer quantity",
      };
    }

    let menuItem = item.id
      ? await prisma.menuItem.findFirst({
          where: { id: item.id, isAvailable: true },
        })
      : null;

    // Fallback for the still-hardcoded homepage sections, whose `id` is a
    // slugified title, not a real MenuItem.id — see note above.
    if (!menuItem) {
      menuItem = await prisma.menuItem.findFirst({
        where: {
          title: { equals: item.title, mode: "insensitive" },
          isAvailable: true,
        },
      });
    }

    if (!menuItem) {
      notFoundTitles.push(item.title);
      continue;
    }

    resolved.push({
      menuItemId: menuItem.id,
      categoryId: menuItem.categoryId,
      price: menuItem.price,
      quantity: item.quantity,
      title: menuItem.title,
    });
  }

  if (notFoundTitles.length > 0) {
    return {
      ok: false,
      error: `These items are no longer available, please remove them from your cart: ${notFoundTitles.join(", ")}`,
    };
  }

  return { ok: true, items: resolved };
}

// ---------------------------------------------------------------------------
// Discount coupons — v2 market-standard rule engine (see Coupon and
// CouponRedemption models in prisma/schema.prisma for the full design
// rationale behind each rule).
// ---------------------------------------------------------------------------

export interface CouponInfo {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  percentOff: number | null;
  fixedOff: number | null;
  maxDiscountAmount: number | null;
  minOrderValue: number | null;
  // Empty arrays = unrestricted (applies to the whole cart) — see the
  // scoping note on the Coupon model in schema.prisma.
  restrictedCategoryIds: string[];
  restrictedItemIds: string[];
}

/**
 * "Who" is redeeming, for per-customer-limit purposes. A logged-in user is
 * identified by their User.id; a guest by their (normalized) phone number,
 * since guest checkout has no account to key off of. Phone is normalized
 * (trimmed, no formatting) so "+1 555-0100" and "15550100" aren't treated
 * as two different customers.
 */
export function getCustomerKey(userId: string | null | undefined, phone: string | null | undefined): string | null {
  if (userId) return `user:${userId}`;
  const normalizedPhone = phone?.replace(/[^0-9+]/g, "").trim();
  return normalizedPhone ? `phone:${normalizedPhone}` : null;
}

/**
 * True when a coupon carries no item/category scoping at all — the
 * common case, and the only case before this restriction feature existed.
 */
function isUnrestricted(coupon: Pick<CouponInfo, "restrictedCategoryIds" | "restrictedItemIds">): boolean {
  return coupon.restrictedCategoryIds.length === 0 && coupon.restrictedItemIds.length === 0;
}

/**
 * The subtotal a coupon's discount is actually computed against. For an
 * unrestricted coupon this is just the full cart subtotal (unchanged
 * behavior). For an item/category-restricted coupon, it's the subtotal of
 * ONLY the cart lines that match one of the coupon's restricted items or
 * categories — a non-matching line's price is untouched by the discount,
 * matching how Shopify/DoorDash-style "$5 off pizzas" coupons behave.
 */
export function computeEligibleSubtotal(
  items: Pick<ResolvedItem, "menuItemId" | "categoryId" | "price" | "quantity">[],
  coupon: Pick<CouponInfo, "restrictedCategoryIds" | "restrictedItemIds">
): number {
  if (isUnrestricted(coupon)) {
    return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  const itemIds = new Set(coupon.restrictedItemIds);
  const categoryIds = new Set(coupon.restrictedCategoryIds);

  return items
    .filter((i) => itemIds.has(i.menuItemId) || categoryIds.has(i.categoryId))
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/**
 * Looks up a coupon and checks every rule that CAN be checked outside a
 * transaction — exists, active, within its redemption window, cart
 * subtotal meets the minimum, the cart actually contains an eligible item
 * when the coupon is item/category-restricted, the global usage cap isn't
 * already hit, and (when a customerKey is known) this customer hasn't
 * already hit their personal cap. Used both for the public "preview the
 * discount before checkout" endpoint AND as the first check inside the
 * order-creation transaction (see consumeCoupon below); the transaction
 * re-checks the usage/limit counters regardless, since this lookup alone
 * can't prevent a race between two simultaneous orders — see
 * consumeCoupon's own comment for exactly which checks are re-verified
 * atomically and which aren't.
 *
 * `items` must be SERVER-resolved (from resolveOrderItems), never a
 * client-supplied subtotal — both the minOrderValue check and the
 * eligible-subtotal computation below depend on real prices/categoryIds.
 */
export async function findValidCoupon(
  code: string,
  items: Pick<ResolvedItem, "menuItemId" | "categoryId" | "price" | "quantity">[],
  customerKey: string | null
): Promise<{ ok: true; coupon: CouponInfo; subtotal: number; eligibleSubtotal: number } | { ok: false; error: string }> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Enter a coupon code" };

  const coupon = await prisma.coupon.findUnique({
    where: { code: trimmed },
    include: {
      restrictedCategories: { select: { id: true } },
      restrictedItems: { select: { id: true } },
    },
  });
  if (!coupon) return { ok: false, error: "Invalid coupon code" };
  if (!coupon.isActive) return { ok: false, error: "This coupon is no longer active" };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { ok: false, error: "This coupon isn't active yet" };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { ok: false, error: "This coupon has expired" };
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // minOrderValue is checked against the FULL cart subtotal regardless of
  // item/category scoping — see the design note on Coupon.restrictedItems
  // in schema.prisma for why "$15 total, $5 off the pizzas in that order"
  // was chosen over "$15 of pizzas specifically".
  if (coupon.minOrderValue != null && subtotal < coupon.minOrderValue) {
    return {
      ok: false,
      error: `This coupon requires a minimum order of $${coupon.minOrderValue.toFixed(2)}`,
    };
  }

  const couponInfo: CouponInfo = {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    percentOff: coupon.percentOff,
    fixedOff: coupon.fixedOff,
    maxDiscountAmount: coupon.maxDiscountAmount,
    minOrderValue: coupon.minOrderValue,
    restrictedCategoryIds: coupon.restrictedCategories.map((c) => c.id),
    restrictedItemIds: coupon.restrictedItems.map((i) => i.id),
  };

  const eligibleSubtotal = computeEligibleSubtotal(items, couponInfo);

  if (!isUnrestricted(couponInfo) && eligibleSubtotal <= 0) {
    return {
      ok: false,
      error: "This coupon only applies to specific items that aren't in your cart",
    };
  }

  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit" };
  }

  if (coupon.perCustomerLimit != null && customerKey) {
    const timesUsedByCustomer = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, customerKey },
    });
    if (timesUsedByCustomer >= coupon.perCustomerLimit) {
      return { ok: false, error: "You've already used this coupon" };
    }
  }

  return { ok: true, coupon: couponInfo, subtotal, eligibleSubtotal };
}

// Rounded to cents. `eligibleSubtotal` must be the SERVER-computed
// eligible-lines subtotal (computeEligibleSubtotal, from
// resolveOrderItems' real prices/categoryIds) — never a client-supplied
// number — a tampered client-side total must not be able to change how
// much discount is granted. Applies maxDiscountAmount as a hard cap
// (mainly relevant to PERCENT coupons on large orders) and never lets the
// discount exceed eligibleSubtotal itself, so a coupon can never make an
// order's total negative or discount more than the eligible lines are
// even worth.
export function calcDiscountAmount(eligibleSubtotal: number, coupon: CouponInfo): number {
  let raw: number;
  if (coupon.type === "FIXED") {
    raw = coupon.fixedOff ?? 0;
  } else {
    raw = eligibleSubtotal * ((coupon.percentOff ?? 0) / 100);
  }

  if (coupon.maxDiscountAmount != null) {
    raw = Math.min(raw, coupon.maxDiscountAmount);
  }
  raw = Math.min(raw, eligibleSubtotal);

  return Math.round(raw * 100) / 100;
}

// ---------------------------------------------------------------------------
// Admin coupon-creation validation — shared so the admin API route and (if
// ever needed) any other admin surface enforce the exact same rules.
// ---------------------------------------------------------------------------

export interface CouponCreateInput {
  code: string;
  type: "PERCENT" | "FIXED";
  percentOff?: number;
  fixedOff?: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  // Category.id / MenuItem.id lists. Both omitted or empty = unrestricted
  // (applies to the whole cart) — see the Coupon model's scoping note.
  restrictedCategoryIds?: string[];
  restrictedItemIds?: string[];
}

export interface ValidatedCouponCreateInput {
  code: string;
  type: "PERCENT" | "FIXED";
  percentOff: number | null;
  fixedOff: number | null;
  maxDiscountAmount: number | null;
  minOrderValue: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  restrictedCategoryIds: string[];
  restrictedItemIds: string[];
}

export function validateCouponInput(
  input: CouponCreateInput
): { ok: true; data: ValidatedCouponCreateInput } | { ok: false; error: string } {
  const code = input.code?.trim().toUpperCase();
  if (!code) return { ok: false, error: "Code is required" };

  const type = input.type === "FIXED" ? "FIXED" : "PERCENT";

  let percentOff: number | null = null;
  let fixedOff: number | null = null;

  if (type === "PERCENT") {
    if (
      typeof input.percentOff !== "number" ||
      !Number.isInteger(input.percentOff) ||
      input.percentOff < 1 ||
      input.percentOff > 100
    ) {
      return { ok: false, error: "Percent off must be a whole number between 1 and 100" };
    }
    percentOff = input.percentOff;
  } else {
    if (typeof input.fixedOff !== "number" || !Number.isFinite(input.fixedOff) || input.fixedOff <= 0) {
      return { ok: false, error: "Fixed discount amount must be a positive number" };
    }
    fixedOff = Math.round(input.fixedOff * 100) / 100;
  }

  let maxDiscountAmount: number | null = null;
  if (input.maxDiscountAmount != null) {
    if (typeof input.maxDiscountAmount !== "number" || input.maxDiscountAmount <= 0) {
      return { ok: false, error: "Max discount cap must be a positive number" };
    }
    maxDiscountAmount = Math.round(input.maxDiscountAmount * 100) / 100;
  }

  let minOrderValue: number | null = null;
  if (input.minOrderValue != null) {
    if (typeof input.minOrderValue !== "number" || input.minOrderValue < 0) {
      return { ok: false, error: "Minimum order value must be zero or a positive number" };
    }
    minOrderValue = Math.round(input.minOrderValue * 100) / 100;
  }

  let startsAt: Date | null = null;
  if (input.startsAt) {
    const parsed = new Date(input.startsAt);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Start date is invalid" };
    startsAt = parsed;
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Expiry date is invalid" };
    expiresAt = parsed;
  }

  if (startsAt && expiresAt && startsAt >= expiresAt) {
    return { ok: false, error: "Start date must be before the expiry date" };
  }

  let usageLimit: number | null = null;
  if (input.usageLimit != null) {
    if (!Number.isInteger(input.usageLimit) || input.usageLimit < 1) {
      return { ok: false, error: "Usage limit must be a positive whole number" };
    }
    usageLimit = input.usageLimit;
  }

  // perCustomerLimit is nullable-but-defaulted: explicit `null` means
  // "unlimited per customer" (admin opted in deliberately), while
  // `undefined`/omitted falls back to the market-standard default of 1
  // (one redemption per customer) rather than silently meaning unlimited.
  let perCustomerLimit: number | null | undefined = input.perCustomerLimit;
  if (perCustomerLimit === undefined) {
    perCustomerLimit = 1;
  } else if (perCustomerLimit !== null) {
    if (!Number.isInteger(perCustomerLimit) || perCustomerLimit < 1) {
      return { ok: false, error: "Per-customer limit must be a positive whole number" };
    }
  }

  // Both are optional lists of ids (Category.id / MenuItem.id respectively).
  // Omitted/empty = unrestricted. Actual existence of each id is enforced
  // by the DB when the API route `connect`s them — an unknown id fails
  // that write with a clear "coupon not found"-style Prisma error rather
  // than silently being dropped here.
  const asIdArray = (value: unknown, label: string): string[] | { error: string } => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
      return { error: `${label} must be a list of ids` };
    }
    return value;
  };

  const restrictedCategoryIdsResult = asIdArray(input.restrictedCategoryIds, "Restricted categories");
  if (!Array.isArray(restrictedCategoryIdsResult)) return { ok: false, error: restrictedCategoryIdsResult.error };

  const restrictedItemIdsResult = asIdArray(input.restrictedItemIds, "Restricted items");
  if (!Array.isArray(restrictedItemIdsResult)) return { ok: false, error: restrictedItemIdsResult.error };

  return {
    ok: true,
    data: {
      code,
      type,
      percentOff,
      fixedOff,
      maxDiscountAmount,
      minOrderValue,
      startsAt,
      expiresAt,
      usageLimit,
      perCustomerLimit,
      restrictedCategoryIds: restrictedCategoryIdsResult,
      restrictedItemIds: restrictedItemIdsResult,
    },
  };
}

/**
 * Atomically claims one redemption of `couponId` for `orderId`/`customerKey`
 * inside an existing transaction. Must run in the SAME transaction as the
 * Order row it's being attached to — if the order creation later fails and
 * the transaction rolls back, the claim (and the CouponRedemption row)
 * rolls back with it, so the code isn't burned on a failed order.
 *
 * Concurrency guarantees, by rule:
 * - Global usage cap (usageLimit/usageCount): fully race-safe. The
 *   `updateMany` below is the actual guard — its WHERE clause re-checks
 *   `usageCount < usageLimit` at the DB level and its affected-row count
 *   tells us whether THIS call actually won the last slot. findValidCoupon
 *   above is only an optimistic pre-check for a fast error message, never
 *   sufficient alone to prevent two simultaneous orders from both claiming
 *   the last redemption.
 * - Per-customer cap (perCustomerLimit): re-checked here via a count
 *   query in the same transaction, not via a single atomic update, since
 *   it's keyed on customerKey rather than a single row's version. This
 *   closes the same race findValidCoupon already narrowed for the common
 *   case, but a customer submitting two requests for the same coupon in
 *   the same instant (e.g. a double-click that bypasses the UI's own
 *   disabled-button guard) could in theory still slip both through. Given
 *   the blast radius — one extra discount to one real customer, not an
 *   uncapped drain of the coupon — this is accepted as a known, low-risk
 *   limitation rather than adding row-level locking for it.
 */
export async function consumeCoupon(
  tx: Prisma.TransactionClient,
  couponId: string,
  orderId: string,
  customerKey: string | null,
  discountAmount: number
): Promise<boolean> {
  const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
  if (!coupon || !coupon.isActive) return false;

  if (coupon.perCustomerLimit != null && customerKey) {
    const timesUsedByCustomer = await tx.couponRedemption.count({
      where: { couponId, customerKey },
    });
    if (timesUsedByCustomer >= coupon.perCustomerLimit) return false;
  }

  const claim = await tx.coupon.updateMany({
    where: {
      id: couponId,
      ...(coupon.usageLimit != null ? { usageCount: { lt: coupon.usageLimit } } : {}),
    },
    data: { usageCount: { increment: 1 } },
  });
  if (claim.count !== 1) return false;

  await tx.couponRedemption.create({
    data: {
      couponId,
      orderId,
      customerKey: customerKey ?? "unknown",
      discountAmount,
    },
  });

  return true;
}