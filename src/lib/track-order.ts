import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeRiderLocation } from "@/lib/order-access";
import {
  KITCHEN_QUEUE_STATUSES,
  SHIPPING_TRANSIT_MINUTES,
  calcKitchenPrepMinutes,
} from "@/lib/kitchen-eta";

/**
 * src/lib/track-order.ts
 *
 * /track/[orderId] পাতা আর তার poll endpoint (GET /api/orders/[id]) — দুটোই
 * এখন এই একটা ফাইল থেকে select করে আর এই একটা function দিয়ে serialize করে।
 *
 * ⚠️ কেন আলাদা ফাইল: আগে দুই জায়গায় দুটো আলাদা হাতে-লেখা map ছিল, আর
 * সেগুলো ইতিমধ্যেই আলাদা হয়ে গিয়েছিল। পাতা পাঠাত `preparingAt`,
 * `dispatchedAt`, `deliveredAt`, `address`; API পাঠাত না। ফলে প্রথম
 * poll-এর (১৫ সেকেন্ড) পরেই timeline-এর সময়গুলো মুছে যেত আর Address ঘরে
 * শুধু শহরের নাম থাকত। একটা shape, একটা জায়গা — আর গরমিল হওয়ার সুযোগ নেই।
 *
 * ⚠️ `...order` spread এখনো নিষেধ, আগের মতোই। client-এ যা যায় তা browser-এ
 * পড়া যায়; নিচে প্রতিটা field হাতে লেখা, যাতে select-এ নতুন কিছু (যেমন
 * `userId`, যেটা শুধু access check-এর জন্য) নীরবে বাইরে না চলে যায়।
 */

export const TRACK_ORDER_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  preparingAt: true,
  dispatchedAt: true,
  deliveredAt: true,

  // শুধু resolveOrderAccess-এর জন্য — serialize-এ কখনো যায় না।
  userId: true,

  subtotal: true,
  discountAmount: true,
  tierDiscountAmount: true,
  serviceCharge: true,
  deliveryFee: true,
  taxAmount: true,
  taxName: true,
  taxMode: true,
  tipAmount: true,
  grandTotal: true,
  totalAmount: true,
  currency: true,
  currencyMinorUnits: true,
  giftCardAmount: true,
  pointsRedeemed: true,
  pointsRedeemedAmount: true,

  firstName: true,
  city: true,
  address: true,
  orderType: true,
  shippingMethod: true,

  // checkout-এ geocode করা গ্রাহকের ঠিকানা — rider বের হওয়ার আগের map-এর
  // গন্তব্য পিন। ঠিকানাটা লেখা হিসেবে একই দর্শককে ইতিমধ্যেই দেখানো হয়।
  deliveryLat: true,
  deliveryLng: true,

  table: { select: { label: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      price: true,
      menuItem: { select: { title: true, description: true, imageUrl: true } },
    },
  },
  deliveryTracking: {
    select: {
      riderLat: true,
      riderLng: true,
      riderLocationUpdatedAt: true,
      destLat: true,
      destLng: true,
      deliveredAt: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

export type TrackOrderRecord = Prisma.OrderGetPayload<{ select: typeof TRACK_ORDER_SELECT }>;

type LatLng = { lat: number; lng: number };

export type TrackedOrderItem = {
  id: string;
  quantity: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** একক দাম — item কার্ডে। */
  unitPrice: string;
  /** লাইন-মোট (একক × পরিমাণ) — বিলের তালিকায়। গুণ server-এ, Decimal-এ। */
  price: string;
};

export type TrackedOrder = {
  id: string;
  status: TrackOrderRecord["status"];
  createdAt: string;
  updatedAt: string;
  preparingAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;

  // সব টাকা string, order-এর নিজের currency-র দশমিকে — client শুধু দেখায়।
  subtotal: string;
  discountAmount: string;
  tierDiscountAmount: string;
  serviceCharge: string;
  deliveryFee: string;
  taxAmount: string;
  taxName: string;
  taxMode: TrackOrderRecord["taxMode"];
  tipAmount: string;
  grandTotal: string;
  totalAmount: string;
  currency: string;
  giftCardAmount: string;
  pointsRedeemed: number;
  pointsRedeemedAmount: string;

  /**
   * Figma-র কাটা দাম (`$21.78 $20.10`)।
   *
   * ⚠️ কেবল coupon আর tier discount যোগ করে — gift card বা points নয়।
   * ওই দুটো ছাড় নয়, অর্থ পরিশোধের উপায়; সেগুলো যোগ করলে পুরো gift card
   * দিয়ে কেনা অর্ডারে "$20.00 $0.00" দেখাত, যেন সবটাই ফ্রি। কোনো ছাড় না
   * থাকলে null — তখন কাটা দাম দেখানোই হয় না, বানিয়ে দেখানো মিথ্যা হতো।
   */
  undiscountedTotal: string | null;
  /** "Total Price(2)" — পরিমাণের যোগফল, লাইনের সংখ্যা নয়। */
  itemCount: number;

  firstName: string;
  city: string | null;
  address: string | null;
  orderType: TrackOrderRecord["orderType"];
  shippingMethod: TrackOrderRecord["shippingMethod"];
  table: { label: string } | null;
  items: TrackedOrderItem[];

  /** Map-এর গন্তব্য পিন — কেবল চলমান delivery অর্ডারে, নাহলে null। */
  destination: LatLng | null;

  /**
   * "Arriving in 25-30 min" — মিনিটে, এখন থেকে।
   *
   * ⚠️ এটা একটা অনুমান, প্রতিশ্রুতি নয়, আর checkout-এর shipping option-এ
   * গ্রাহক যে সংখ্যাটা দেখেছিলেন সেই একই হিসাব (lib/kitchen-eta.ts) থেকে
   * আসে — তাই দুই পাতায় দুই রকম সংখ্যা দেখা যায় না।
   */
  eta: { min: number; max: number } | null;

  deliveryTracking: {
    riderLat: number | null;
    riderLng: number | null;
    riderLocationUpdatedAt: string | null;
    destLat: number | null;
    destLng: number | null;
    deliveredAt: string | null;
  } | null;
};

const ACTIVE_STATUSES = new Set(["PLACED", "PREPARING", "OUT_FOR_DELIVERY"]);

export function findOrderForTracking(id: string) {
  return prisma.order.findUnique({ where: { id }, select: TRACK_ORDER_SELECT });
}

/**
 * ⚠️ async, কারণ ETA-র জন্য রান্নাঘরের সারির দৈর্ঘ্য লাগে। count query-টা
 * কেবল PLACED/PREPARING delivery অর্ডারে চলে — পথে থাকা, পৌঁছে যাওয়া বা
 * dine-in অর্ডারে সারির হিসাব অর্থহীন, তাই সেখানে DB-তে যাওয়াই হয় না।
 */
export async function serializeTrackedOrder(order: TrackOrderRecord): Promise<TrackedOrder> {
  const units = order.currencyMinorUnits;
  const money = (value: { toFixed(dp: number): string }) => value.toFixed(units);

  const live = canSeeRiderLocation(order);
  const isActiveDelivery = order.orderType === "DELIVERY" && ACTIVE_STATUSES.has(order.status);

  const hasDiscount = order.discountAmount.plus(order.tierDiscountAmount).greaterThan(0);

  const tracking = order.deliveryTracking;
  const destination: LatLng | null = !isActiveDelivery
    ? null
    : live && tracking
      ? { lat: tracking.destLat, lng: tracking.destLng }
      : order.deliveryLat !== null && order.deliveryLng !== null
        ? { lat: order.deliveryLat, lng: order.deliveryLng }
        : null;

  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    preparingAt: order.preparingAt?.toISOString() ?? null,
    dispatchedAt: order.dispatchedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,

    subtotal: money(order.subtotal),
    discountAmount: money(order.discountAmount),
    tierDiscountAmount: money(order.tierDiscountAmount),
    serviceCharge: money(order.serviceCharge),
    deliveryFee: money(order.deliveryFee),
    taxAmount: money(order.taxAmount),
    taxName: order.taxName,
    taxMode: order.taxMode,
    tipAmount: money(order.tipAmount),
    grandTotal: money(order.grandTotal),
    totalAmount: money(order.totalAmount),
    currency: order.currency,
    giftCardAmount: money(order.giftCardAmount),
    pointsRedeemed: order.pointsRedeemed,
    pointsRedeemedAmount: money(order.pointsRedeemedAmount),

    undiscountedTotal: hasDiscount
      ? money(order.totalAmount.plus(order.discountAmount).plus(order.tierDiscountAmount))
      : null,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),

    firstName: order.firstName,
    city: order.city,
    address: order.address,
    orderType: order.orderType,
    shippingMethod: order.shippingMethod,
    table: order.table,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      title: item.menuItem.title,
      description: item.menuItem.description || null,
      imageUrl: item.menuItem.imageUrl,
      unitPrice: money(item.price),
      price: money(item.price.times(item.quantity)),
    })),

    destination,
    eta: isActiveDelivery ? await estimateArrival(order) : null,

    deliveryTracking: tracking
      ? {
          riderLat: live ? tracking.riderLat : null,
          riderLng: live ? tracking.riderLng : null,
          riderLocationUpdatedAt: live ? tracking.riderLocationUpdatedAt.toISOString() : null,
          destLat: live ? tracking.destLat : null,
          destLng: live ? tracking.destLng : null,
          deliveredAt: tracking.deliveredAt?.toISOString() ?? null,
        }
      : null,
  };
}

/**
 * পৌঁছানোর আনুমানিক সময়, এখন থেকে মিনিটে।
 *
 *   PLACED / PREPARING → রান্নাঘরের সারি অনুযায়ী রান্না + পথের সময়
 *   OUT_FOR_DELIVERY   → পথের সময় − বের হওয়ার পর যতটা পেরিয়েছে
 *
 * ⚠️ পথে থাকা অর্ডারে পেরোনো সময় বাদ দেওয়া হয়। নাহলে rider ২৫ মিনিট ধরে
 * রাস্তায় থাকলেও পাতাটা একই "15-30 min" দেখিয়ে যেত। শূন্যের নিচে নামে
 * না — client সেটাকে "Any minute now" হিসেবে দেখায়।
 */
async function estimateArrival(order: TrackOrderRecord): Promise<{ min: number; max: number } | null> {
  if (!order.shippingMethod) return null;
  const transit = SHIPPING_TRANSIT_MINUTES[order.shippingMethod];

  if (order.status === "OUT_FOR_DELIVERY") {
    const elapsed = order.dispatchedAt
      ? Math.floor((Date.now() - order.dispatchedAt.getTime()) / 60_000)
      : 0;
    return {
      min: Math.max(0, transit.min - elapsed),
      max: Math.max(0, transit.max - elapsed),
    };
  }

  const queueLength = await prisma.order.count({
    where: { status: { in: [...KITCHEN_QUEUE_STATUSES] } },
  });
  const prep = calcKitchenPrepMinutes(queueLength);
  return { min: prep + transit.min, max: prep + transit.max };
}