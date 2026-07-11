import { prisma } from "@/lib/prisma";

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