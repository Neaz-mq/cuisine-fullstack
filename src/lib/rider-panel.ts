/**
 * src/lib/rider-panel.ts
 *
 * Database side of the rider panel (/admin/my-deliveries, DELIVERY role):
 * which rows each page reads, in one place so every page and API agrees.
 * The arithmetic lives in lib/rider-stats.ts.
 *
 * ── How an order reaches a rider ─────────────────────────────────────
 *   1. The owner/manager/kitchen assigns it (assign-rider route) — the
 *      order goes straight to "Out for delivery", as before.
 *   2. Or a rider takes it from Available Orders: a delivery order the
 *      kitchen is preparing that nobody has taken yet. Taking it only
 *      reserves it (the order stays "Preparing"); the rider presses
 *      "Picked Up" when the food is handed over, and only then does the
 *      customer get "Out for delivery". Same order as Foodpanda/Uber Eats:
 *      accept → pick up → deliver.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { areaLabel, deliveryEarning } from "@/lib/rider-stats";
import { formatAmount } from "@/lib/currency-format";

/** How many deliveries one rider may hold at once (taken or assigned, not
 *  yet delivered). Stops one rider from grabbing every available order. */
export const MAX_ACTIVE_DELIVERIES = 3;

/**
 * Orders a rider may take from Available Orders:
 *   • delivery orders, being prepared (the kitchen has accepted them),
 *   • with no rider yet,
 *   • not handed to Uber Eats / Foodpanda,
 *   • and, if paid online, actually paid.
 */
export const AVAILABLE_ORDER_WHERE = {
  orderType: "DELIVERY",
  status: "PREPARING",
  deliveryTracking: { is: null },
  OR: [{ shippingMethod: null }, { shippingMethod: "OWN_DELIVERY" }],
  NOT: { paymentMethod: "ONLINE", paymentStatus: { in: ["PENDING", "FAILED"] } },
} satisfies Prisma.OrderWhereInput;

export const AVAILABLE_ORDER_SELECT = {
  id: true,
  createdAt: true,
  preparingAt: true,
  firstName: true,
  lastName: true,
  address: true,
  apartment: true,
  city: true,
  state: true,
  zip: true,
  deliveryDistanceKm: true,
  deliveryZoneLabel: true,
  deliveryFee: true,
  tipAmount: true,
  totalAmount: true,
  currency: true,
  currencyMinorUnits: true,
  paymentMethod: true,
  items: { select: { quantity: true, menuItem: { select: { title: true } } } },
} satisfies Prisma.OrderSelect;

type AvailableOrderRecord = Prisma.OrderGetPayload<{ select: typeof AVAILABLE_ORDER_SELECT }>;

/** What the Available Orders page and its API send to the browser. */
export type AvailableOrder = {
  orderId: string;
  /** When the kitchen started it — "waiting since". ISO string. */
  since: string;
  customerName: string;
  area: string;
  address: string;
  distanceKm: number | null;
  itemCount: number;
  itemsSummary: string;
  /** Delivery fee + tip, in the order's currency. */
  earning: number;
  totalAmount: number;
  currency: string;
  paymentMethod: "COD" | "ONLINE";
};

export function toAvailableOrder(order: AvailableOrderRecord): AvailableOrder {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    orderId: order.id,
    since: (order.preparingAt ?? order.createdAt).toISOString(),
    customerName: `${order.firstName} ${order.lastName}`.trim(),
    area: areaLabel(order),
    address: [order.address, order.apartment, order.city, order.state, order.zip].filter(Boolean).join(", "),
    distanceKm: order.deliveryDistanceKm,
    itemCount,
    itemsSummary: order.items
      .slice(0, 3)
      .map((item) => `${item.quantity}× ${item.menuItem.title}`)
      .join(", ")
      .concat(order.items.length > 3 ? ` +${order.items.length - 3} more` : ""),
    earning: deliveryEarning(order),
    totalAmount: order.totalAmount.toNumber(),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
  };
}

export async function findAvailableOrders(limit = 50): Promise<AvailableOrder[]> {
  const orders = await prisma.order.findMany({
    where: AVAILABLE_ORDER_WHERE,
    orderBy: [{ preparingAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: AVAILABLE_ORDER_SELECT,
  });
  return orders.map(toAvailableOrder);
}

/** One of the rider's own deliveries, with the order fields every rider
 *  page needs. */
export const RIDER_DELIVERY_SELECT = {
  orderId: true,
  assignedAt: true,
  deliveredAt: true,
  selfAssigned: true,
  riderRating: true,
  riderRatedAt: true,
  riderLat: true,
  riderLng: true,
  riderLocationUpdatedAt: true,
  destLat: true,
  destLng: true,
  order: {
    select: {
      status: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      apartment: true,
      city: true,
      state: true,
      zip: true,
      totalAmount: true,
      deliveryFee: true,
      tipAmount: true,
      currency: true,
      currencyMinorUnits: true,
      paymentMethod: true,
      dispatchedAt: true,
      updatedAt: true,
      deliveryDistanceKm: true,
      items: { select: { quantity: true } },
    },
  },
} satisfies Prisma.DeliveryTrackingSelect;

export type RiderDeliveryRecord = Prisma.DeliveryTrackingGetPayload<{
  select: typeof RIDER_DELIVERY_SELECT;
}>;

/** A rider's delivery flattened for pages and CSV. Numbers, not Decimals. */
export type RiderDelivery = {
  orderId: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  customerName: string;
  phone: string;
  area: string;
  address: string;
  itemCount: number;
  assignedAt: Date;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  /** Cancelled orders: when it happened (the order's last change). */
  cancelledAt: Date | null;
  selfAssigned: boolean;
  rating: number | null;
  paymentMethod: "COD" | "ONLINE";
  totalAmount: number;
  deliveryFee: number;
  tipAmount: number;
  /** Delivery fee + tip — 0 for a cancelled order. */
  earning: number;
  currency: string;
  distanceKm: number | null;
};

export function toRiderDelivery(row: RiderDeliveryRecord): RiderDelivery {
  const order = row.order;
  const cancelled = order.status === "CANCELLED";
  return {
    orderId: row.orderId,
    status: order.status,
    customerName: `${order.firstName} ${order.lastName}`.trim(),
    phone: order.phone,
    area: areaLabel(order),
    address: [order.address, order.apartment, order.city, order.state, order.zip].filter(Boolean).join(", "),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    assignedAt: row.assignedAt,
    pickedUpAt: order.dispatchedAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: cancelled ? order.updatedAt : null,
    selfAssigned: row.selfAssigned,
    rating: row.riderRating,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount.toNumber(),
    deliveryFee: order.deliveryFee.toNumber(),
    tipAmount: order.tipAmount.toNumber(),
    earning: cancelled ? 0 : deliveryEarning(order),
    currency: order.currency,
    distanceKm: order.deliveryDistanceKm,
  };
}

/** Deliveries finished in [from, to) — the base of every earnings figure. */
export function deliveredBetween(riderId: string, from: Date | null, to?: Date) {
  return prisma.deliveryTracking.findMany({
    where: {
      riderId,
      deliveredAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) },
      order: { status: "DELIVERED" },
    },
    orderBy: { deliveredAt: "desc" },
    select: RIDER_DELIVERY_SELECT,
  });
}

/** Taken or assigned, not yet delivered, not cancelled. */
export const ACTIVE_DELIVERY_WHERE = (riderId: string) =>
  ({
    riderId,
    deliveredAt: null,
    order: { status: { in: ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"] } },
  }) satisfies Prisma.DeliveryTrackingWhereInput;

export function findActiveDeliveries(riderId: string) {
  return prisma.deliveryTracking.findMany({
    where: ACTIVE_DELIVERY_WHERE(riderId),
    orderBy: { assignedAt: "asc" },
    select: RIDER_DELIVERY_SELECT,
  });
}

/** Rider panel pages start their "today" here — local midnight on the
 *  server, which getRestaurantSettings() has set to the restaurant's
 *  time zone (call that first). */
export function startOfToday(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function daysAgo(start: Date, days: number): Date {
  const date = new Date(start);
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * The rider's finished deliveries — delivered, or cancelled after they had
 * it — that finished on/after `from` (all of them when null). Delivery
 * History, Recent Deliveries and the CSV export all read this.
 */
export function finishedWhere(riderId: string, from: Date | null) {
  return {
    riderId,
    OR: from
      ? [
          { deliveredAt: { gte: from }, order: { status: "DELIVERED" } },
          { deliveredAt: null, order: { status: "CANCELLED", updatedAt: { gte: from } } },
        ]
      : [
          { deliveredAt: { not: null }, order: { status: "DELIVERED" } },
          { order: { status: "CANCELLED" } },
        ],
  } satisfies Prisma.DeliveryTrackingWhereInput;
}

/** What Active Delivery (and its 15-second poll) sends to the browser. */
export type ActiveDelivery = {
  orderId: string;
  /** PREPARING = taken, not picked up yet. */
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY";
  customerName: string;
  phone: string;
  address: string;
  area: string;
  itemCount: number;
  /** Already formatted in the order's currency, e.g. "$28.35". */
  totalAmount: string;
  earning: string;
  paymentMethod: "COD" | "ONLINE";
  /** null when the address couldn't be placed on the map. */
  destLat: number | null;
  destLng: number | null;
  assignedAt: string;
  selfAssigned: boolean;
};

export function toActiveDelivery(row: RiderDeliveryRecord): ActiveDelivery {
  const order = row.order;
  const money = (value: { toFixed(dp: number): string }) =>
    formatAmount(value.toFixed(order.currencyMinorUnits), order.currency);
  return {
    orderId: row.orderId,
    status: order.status as ActiveDelivery["status"],
    customerName: `${order.firstName} ${order.lastName}`.trim(),
    phone: order.phone,
    address: [order.address, order.apartment, order.city, order.state, order.zip].filter(Boolean).join(", "),
    area: areaLabel(order),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: money(order.totalAmount),
    earning: formatAmount(deliveryEarning(order), order.currency),
    paymentMethod: order.paymentMethod,
    destLat: row.destLat,
    destLng: row.destLng,
    assignedAt: row.assignedAt.toISOString(),
    selfAssigned: row.selfAssigned,
  };
}

/** What a rider sees before taking an order: everything but the street
 *  address (that comes with the order, on Active Delivery). */
export type AvailableOrderPreview = Omit<AvailableOrder, "address">;

export function withoutAddress(order: AvailableOrder): AvailableOrderPreview {
  const preview: Partial<AvailableOrder> = { ...order };
  delete preview.address;
  return preview as AvailableOrderPreview;
}
