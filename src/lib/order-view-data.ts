import { Prisma } from "@/generated/prisma/client";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmount } from "@/lib/currency-format";
import { distanceBarRatio, normalizeDeliveryZones } from "@/lib/delivery-zones";
import type { OrderDeliverySnapshot } from "@/lib/delivery-zones";
import type { OrderViewData } from "@/app/admin/orders/OrderViewModal";

/**
 * src/lib/order-view-data.ts
 *
 * "View Order" আর "Ready to Delivery" — এই দুটো modal-এর জন্য একটা
 * order row-কে যে আকৃতিতে লাগে, সেটা বানানোর একমাত্র জায়গা।
 *
 * ⚠️ আগে এটা `app/admin/orders/page.tsx`-এর ভেতরে একটা local function
 * ছিল, তাই কেবল orders টেবিলই modal দুটো খুলতে পারত। রান্নাঘরের বোর্ড
 * থেকে একই modal খুলতে হলে হয় কোডটা কপি করতে হতো (দুটো আলাদা হয়ে
 * যাওয়া সময়ের ব্যাপার), নয়তো page.tsx থেকে import করতে হতো — যেটা
 * একটা server page থেকে আরেকটা page-এ import, Next.js-এ কাজ করলেও
 * নির্ভরতার দিক থেকে উল্টো।
 *
 * ⚠️ `ORDER_VIEW_SELECT`-ও এখানেই, কারণ builder আর select একসাথে না
 * থাকলে একটায় field যোগ করে অন্যটায় ভুলে যাওয়া সহজ — আর তখন runtime-এ
 * `undefined`, compile-এ কোনো অভিযোগ নয়।
 */
export const ORDER_VIEW_SELECT = {
  id: true,
  email: true,
  phone: true,
  address: true,
  apartment: true,
  city: true,
  state: true,
  zip: true,
  country: true,
  orderType: true,
  shippingMethod: true,
  paymentMethod: true,
  currency: true,
  currencyMinorUnits: true,
  totalAmount: true,
  deliveryFee: true,
  deliveryZones: true,
  deliveryDistanceKm: true,
  deliveryZoneLabel: true,
  deliveryZoneFallback: true,
  table: { select: { label: true } },
  deliveryTracking: { select: { riderId: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      price: true,
      menuItem: { select: { title: true } },
    },
  },
} as const satisfies Prisma.OrderSelect;

export type OrderViewRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_VIEW_SELECT }>;

/** টাকার অঙ্ক → order-এর নিজের currency আর দশমিকে সাজানো string। */
export function orderMoney(
  order: { currency: string; currencyMinorUnits: number },
  value: { toFixed(dp: number): string }
) {
  return formatAmount(value.toFixed(order.currencyMinorUnits), order.currency);
}

export function paymentLabel(order: {
  orderType: "DELIVERY" | "DINE_IN";
  paymentMethod: string;
}) {
  if (order.paymentMethod !== "COD") return "Online Payment";
  return order.orderType === "DINE_IN" ? "Pay at Table" : "Cash on Delivery";
}

export function channelLabel(order: {
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: string | null;
  table: { label: string } | null;
}) {
  if (order.orderType === "DINE_IN") return `Table - ${order.table?.label ?? "—"}`;
  if (order.shippingMethod === "UBER_EATS") return "Uber Eats";
  if (order.shippingMethod === "FOOD_PANDA") return "Food Panda";
  if (order.shippingMethod === "OWN_DELIVERY") return "Our Own Delivery";
  return "Online";
}

function deliverySnapshot(order: {
  currency: string;
  currencyMinorUnits: number;
  deliveryFee: Prisma.Decimal;
  deliveryZones: Prisma.JsonValue | null;
  deliveryDistanceKm: number | null;
  deliveryZoneLabel: string | null;
  deliveryZoneFallback: boolean;
}): OrderDeliverySnapshot | null {
  // ধাপের তালিকা নেই = FLAT mode-এ বসা অর্ডার, বা এই feature-এর আগের।
  // দুটোতেই modal সরল "Delivery Charge Applied" সারিটাই দেখাবে।
  if (!order.deliveryZones) return null;

  const zones = normalizeDeliveryZones(order.deliveryZones);

  return {
    zones: zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      feeLabel: formatAmount(zone.fee, order.currency, order.currencyMinorUnits),
      // ⚠️ label মিলিয়ে, fee মিলিয়ে নয় — দুটো ধাপের ফি সমান হতে পারে
      // ("0–1 Km $5" আর "1–3 Km $5"), তখন fee দিয়ে মেলালে দুটোই
      // একসাথে highlight হতো।
      active: zone.label === order.deliveryZoneLabel,
    })),
    distanceKm: order.deliveryDistanceKm,
    barRatio:
      order.deliveryDistanceKm === null
        ? 0
        : distanceBarRatio(order.deliveryDistanceKm, zones),
    appliedFeeLabel: orderMoney(order, order.deliveryFee),
    fellBackToFlat: order.deliveryZoneFallback,
  };
}

export function toOrderViewData(order: OrderViewRecord): OrderViewData {
  const addressParts = [
    order.address,
    order.apartment,
    order.city,
    order.state,
    order.zip,
    order.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return {
    id: order.id,
    reference: formatOrderId(order.id),
    email: order.email,
    phone: order.phone,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.menuItem.title,
      quantity: item.quantity,
      lineTotal: orderMoney(order, item.price.times(item.quantity)),
    })),
    channel: channelLabel(order),
    paymentLabel: paymentLabel(order),
    totalLabel: orderMoney(order, order.totalAmount),
    deliveryFeeLabel: orderMoney(order, order.deliveryFee),
    riderId: order.deliveryTracking?.riderId ?? null,
    delivery: deliverySnapshot(order),
  };
}