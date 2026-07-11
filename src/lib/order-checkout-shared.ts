import { prisma } from "@/lib/prisma";

export const SHIPPING_METHODS = ["UBER_EATS", "FOOD_PANDA"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const ORDER_TYPES = ["DELIVERY", "DINE_IN"] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

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