"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle2, ChefHat, Truck, PackageCheck, Circle, XCircle } from "lucide-react";
import { formatOrderId } from "@/lib/format-order-id";
import ChatPanel from "@/components/ChatPanel";
import { formatAmount, isPositiveAmount } from "@/lib/currency-format";

// Leaflet touches `window` at import time, which breaks SSR — loaded
// client-side only, same pattern as any other browser-only widget in a
// Next.js App Router page.
const LiveDeliveryMap = dynamic(() => import("@/components/LiveDeliveryMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full mb-8 bg-gray-100 rounded-md animate-pulse" />,
});

const POLL_INTERVAL_MS = 15000; // same cadence as the admin Kitchen board

type OrderItem = {
  id: string;
  quantity: number;
  /** Already formatted to this order's currency by the server — a string,
   *  never a number, so the client can't accidentally re-round it. */
  price: string;
  menuItem: { title: string };
};

/**
 * ⚠️ স্থানাঙ্কগুলো nullable, এবং সেটা ইচ্ছাকৃত।
 *
 * Server (page.tsx আর GET /api/orders/[id] — দুটোই lib/order-access.ts-এর
 * canSeeRiderLocation ব্যবহার করে) rider-এর অবস্থান কেবল তখনই পাঠায় যখন
 * order সত্যিই পথে আছে। ডেলিভারি শেষ হলে বা এখনো শুরু না হলে এই পাঁচটা
 * field null হয়ে আসে।
 *
 * object টা তবু null হয় না, কারণ নিচের chat panel deliveredAt দেখে
 * "এই ডেলিভারি শেষ — চ্যাট বন্ধ" বার্তাটা দেখায়।
 */
type DeliveryTracking = {
  riderLat: number | null;
  riderLng: number | null;
  riderLocationUpdatedAt: string | null;
  destLat: number | null;
  destLng: number | null;
  deliveredAt: string | null;
};

type TrackedOrder = {
  id: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;

  // ── The invoice ─────────────────────────────────────────────────────
  //
  // Every figure is a SNAPSHOT taken when the order was placed, not a
  // recomputation against today's settings. If the restaurant changes its
  // VAT rate next month, this bill still shows what the customer actually
  // paid — which is the whole reason an Order carries its own taxRate,
  // taxName and currency.
  //
  // All strings, formatted server-side to this order's currency: 0 decimal
  // places for yen, 3 for Kuwaiti dinar. Parsing them back into numbers
  // would undo exactly that.
  subtotal: string;
  discountAmount: string;
  tierDiscountAmount: string;
  serviceCharge: string;
  deliveryFee: string;
  taxAmount: string;
  taxName: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  tipAmount: string;
  grandTotal: string;
  totalAmount: string;
  currency: string;
  giftCardAmount: string;
  pointsRedeemed: number;
  pointsRedeemedAmount: string;

  firstName: string;
  city: string | null;
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: "UBER_EATS" | "FOOD_PANDA" | "OWN_DELIVERY" | null;
  table: { label: string } | null;
  items: OrderItem[];
  deliveryTracking: DeliveryTracking | null;
};

// A dine-in order was never "out for delivery" — same backend status value,
// just a different customer-facing label/icon story for that step (see
// project notes on Order.status).
function stepsFor(orderType: "DELIVERY" | "DINE_IN") {
  return [
    { key: "PLACED", label: "Order Placed", icon: CheckCircle2 },
    { key: "PREPARING", label: "Preparing", icon: ChefHat },
    {
      key: "OUT_FOR_DELIVERY",
      label: orderType === "DINE_IN" ? "Ready to Serve" : "Out for Delivery",
      icon: orderType === "DINE_IN" ? PackageCheck : Truck,
    },
    { key: "DELIVERED", label: orderType === "DINE_IN" ? "Served" : "Delivered", icon: PackageCheck },
  ] as const;
}

/**
 * Type guard — TypeScript-কে বোঝায় যে স্থানাঙ্কগুলো এখানে number,
 * null নয়, যাতে LiveDeliveryMap-এ non-null assertion (`!`) লিখতে না হয়।
 */
function hasRiderLocation(
  tracking: DeliveryTracking | null
): tracking is DeliveryTracking & {
  riderLat: number;
  riderLng: number;
  destLat: number;
  destLng: number;
  riderLocationUpdatedAt: string;
} {
  return (
    tracking !== null &&
    tracking.deliveredAt === null &&
    tracking.riderLat !== null &&
    tracking.riderLng !== null &&
    tracking.destLat !== null &&
    tracking.destLng !== null &&
    tracking.riderLocationUpdatedAt !== null
  );
}

export default function OrderTrackingTimeline({ initialOrder }: { initialOrder: TrackedOrder }) {
  const [order, setOrder] = useState<TrackedOrder>(initialOrder);

  useEffect(() => {
    if (order.status === "DELIVERED" || order.status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setOrder(data);
      } catch {
        // network error — silently retry on the next poll
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [order.id, order.status]);

  const isDineIn = order.orderType === "DINE_IN";
  const STEPS = stepsFor(order.orderType);

  // Formatted against THIS order's currency, not the restaurant's current
  // one — see the invoice note on TrackedOrder above.
  const money = (value: string) => formatAmount(value, order.currency);

  if (order.status === "CANCELLED") {
    return (
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">
          {formatOrderId(order.id)}
        </h1>
        <div className="mt-6 border border-red-200 bg-red-50 rounded-md p-6 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">This order was cancelled</p>
            <p className="text-sm text-red-500">
              If this wasn&apos;t expected, please contact us for help.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div>
      <p className="text-sm text-gray-400 mb-1">Tracking order</p>
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-1">
        {formatOrderId(order.id)}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Hi {order.firstName}, here&apos;s the live status of your order.
      </p>

      {/* Timeline */}
      <div className="flex items-start justify-between mb-10">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {index > 0 && (
                <div
                  className={`absolute top-5 right-1/2 w-full h-0.5 -z-10 ${
                    index <= currentStepIndex ? "bg-[#2C6252]" : "bg-gray-200"
                  }`}
                />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${
                  isComplete || isCurrent
                    ? "border-[#2C6252] text-[#2C6252]"
                    : "border-gray-200 text-gray-300"
                } ${isCurrent ? "animate-pulse" : ""}`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isUpcoming ? (
                  <Circle className="w-4 h-4" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <p
                className={`text-xs mt-2 text-center px-1 ${
                  isComplete || isCurrent ? "text-gray-800 font-medium" : "text-gray-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {order.status !== "DELIVERED" && (
        <p className="text-center text-sm text-gray-400 mb-8">
          This page updates automatically — no need to refresh.
        </p>
      )}
      {order.status === "DELIVERED" && (
        <p className="text-center text-sm font-medium text-[#2C6252] mb-8">
          {isDineIn ? "Served — enjoy your meal! 🎉" : "Delivered — enjoy your meal! 🎉"}
        </p>
      )}

{/*
        Map টা কেবল তখনই, যখন server আসলেই স্থানাঙ্ক পাঠিয়েছে।
        status/deliveredAt check গুলো রেখে দেওয়া হয়েছে — server ওই একই
        নিয়মই প্রয়োগ করে, কিন্তু client-এ দ্বিতীয়বার যাচাই করলে server
        আর UI-র নিয়ম কখনো আলাদা হয়ে গেলে খালি map-এর বদলে কিছুই দেখাবে
        না। hasRiderLocation-ই আসল রক্ষী; বাকিগুলো পাঠককে উদ্দেশ্যটা
        মনে করিয়ে দেয়।
      */}
      {order.status === "OUT_FOR_DELIVERY" &&
        order.orderType === "DELIVERY" &&
        hasRiderLocation(order.deliveryTracking) && (
          <LiveDeliveryMap
            rider={{ lat: order.deliveryTracking.riderLat, lng: order.deliveryTracking.riderLng }}
            destination={{ lat: order.deliveryTracking.destLat, lng: order.deliveryTracking.destLng }}
            lastUpdatedAt={order.deliveryTracking.riderLocationUpdatedAt}
          />
        )}

      {order.orderType === "DELIVERY" &&
        order.shippingMethod === "OWN_DELIVERY" &&
        order.deliveryTracking && (
          <div className="mb-8">
            <ChatPanel
              orderId={order.id}
              viewerRole="CUSTOMER"
              fetchUrl={`/api/orders/${order.id}/chat`}
              sendUrl={`/api/orders/${order.id}/chat`}
              otherPartyLabel="your rider"
              active={order.status === "OUT_FOR_DELIVERY" && !order.deliveryTracking.deliveredAt}
              inactiveMessage={
                order.deliveryTracking.deliveredAt
                  ? "This delivery is complete — chat is now closed."
                  : "Chat opens once your rider is on the way."
              }
            />
          </div>
        )}

      {/* Order summary */}
      <div className="border border-gray-200 rounded-md p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Order Summary
        </h2>
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700">
              <span>
                {item.menuItem.title} <span className="text-gray-400">x{item.quantity}</span>
              </span>
              {/* Unit price × quantity was computed server-side; this is the
                  line total, already in this order's currency. */}
              <span>{money(item.price)}</span>
            </div>
          ))}
        </div>

        {/* ── The bill ──────────────────────────────────────────────────
            Zero lines are hidden rather than shown as "0.00", so a plain
            order stays a short receipt. Tax is the exception worth being
            loud about: in the EU showing it separately is a legal
            requirement, not a nicety. */}
        <div className="space-y-1.5 pt-3 border-t border-dashed border-gray-200 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>

          {isPositiveAmount(order.discountAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span className="text-[#2C6252]">-{money(order.discountAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.tierDiscountAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Tier discount</span>
              <span className="text-[#2C6252]">-{money(order.tierDiscountAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.serviceCharge) && (
            <div className="flex justify-between text-gray-600">
              <span>Service charge</span>
              <span>{money(order.serviceCharge)}</span>
            </div>
          )}

          {isPositiveAmount(order.deliveryFee) && (
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span>{money(order.deliveryFee)}</span>
            </div>
          )}

          {isPositiveAmount(order.taxAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>
                {order.taxName}
                {/* INCLUSIVE: the tax sits inside the prices above, so the
                    total does NOT go up. Saying so is the difference
                    between an EU-style bill and a customer who thinks
                    they've been charged twice. */}
                {order.taxMode === "INCLUSIVE" && (
                  <span className="text-gray-400"> (included)</span>
                )}
              </span>
              <span>{money(order.taxAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.giftCardAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Gift card</span>
              <span className="text-[#2C6252]">-{money(order.giftCardAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.pointsRedeemedAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Points redeemed ({order.pointsRedeemed} pts)</span>
              <span className="text-[#2C6252]">-{money(order.pointsRedeemedAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.tipAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Tip</span>
              <span>{money(order.tipAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-dashed border-gray-200">
          <span className="text-sm text-gray-500">
            {isDineIn
              ? `Table ${order.table?.label ?? "—"}`
              : `${
                  order.shippingMethod === "UBER_EATS"
                    ? "Uber Eats"
                    : order.shippingMethod === "OWN_DELIVERY"
                    ? "Our Own Delivery"
                    : "Food Panda"
                } \u00b7 ${order.city ?? ""}`}
          </span>
          <span className="font-bold text-[#2C6252]">{money(order.totalAmount)}</span>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/menu" className="text-sm text-[#FF4C15] font-medium hover:underline">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}
