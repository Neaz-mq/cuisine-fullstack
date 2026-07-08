import { prisma } from "@/lib/prisma";

export const SHIPPING_METHODS = ["UBER_EATS", "FOOD_PANDA"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export interface Billing {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  zip: string;
}

export function validateBilling(billing: Billing): string | null {
  const requiredFields: (keyof Billing)[] = [
    "email",
    "firstName",
    "lastName",
    "phone",
    "country",
    "address",
    "city",
    "state",
    "zip",
  ];
  const missingField = requiredFields.find((f) => !billing?.[f]?.trim());
  return missingField ? `Billing field "${missingField}" is required` : null;
}

export interface IncomingItem {
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
 * IMPORTANT — temporary shim, read before touching this file:
 * ---------------------------------------------------------------------
 * The menu-display components (Items.tsx, Popular.tsx, Brew.tsx, etc.)
 * still render a hardcoded menu array instead of fetching from the DB, so
 * CartContext items carry `id: slugify(title)` — NOT a real MenuItem.id.
 * Until those components are wired to a future GET /api/menu, we can't
 * trust the cart's `id` as a foreign key.
 *
 * As a stopgap, this resolves each cart line to a real MenuItem by
 * matching on `title` (case-insensitive) instead of id. This is fragile —
 * it breaks if two menu items ever share a title, or if a title is edited
 * in the DB without updating the hardcoded frontend copy. Once the menu
 * components fetch real data and pass through the real MenuItem.id, switch
 * this back to a plain `menuItemId` lookup and delete this shim.
 *
 * Centralized here (rather than duplicated in /api/orders AND
 * /api/checkout/create-session) so both checkout paths — Cash on Delivery
 * and Stripe — stay in sync and this only needs fixing in one place later.
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

    const menuItem = await prisma.menuItem.findFirst({
      where: {
        title: { equals: item.title, mode: "insensitive" },
        isAvailable: true,
      },
    });

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