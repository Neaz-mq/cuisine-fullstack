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
  loading: () => <div className="mb-8 h-64 w-full animate-pulse rounded-[20px] bg-[#F9F6F3]" />,
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

  /**
   * প্রতিটা ধাপে পৌঁছনোর সময়, ISO string।
   *
   * ⚠️ null হতে পারে দুটো কারণে: অর্ডার এখনো ওই ধাপে পৌঁছয়নি, অথবা
   * এই কলামগুলো যোগ হওয়ার **আগের** অর্ডার। দ্বিতীয়টার জন্যই
   * timeline-এ সময়টা শর্তসাপেক্ষে দেখানো হয় — পুরোনো অর্ডারে শুধু
   * ধাপের নামটাই থাকে, আর সেটাই ঠিক।
   */
  preparingAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;

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
  /** Figma-র "Address" ঘরের জন্য — dine-in অর্ডারে null। */
  address: string | null;
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

  /**
   * "Jul 12, 2026 at 7:42 PM" — Figma-র "Placed on …" লাইনটা।
   *
   * ⚠️ দর্শকের ঘড়িতে সাজানো হয়, রেস্তোরাঁর timezone-এ নয়। এখানে
   * সেটাই ঠিক: গ্রাহক জানতে চান **তাঁর** কখন অর্ডারটা গেছে। admin
   * পাতাগুলোয় উল্টোটা (রেস্তোরাঁর সময়), কারণ ওখানে staff রান্নাঘরের
   * ঘড়ি ধরে কাজ করেন।
   */
  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const fmtShort = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const placedLabel = fmtFull(order.createdAt).replace(" at ", " at ");

  /**
   * প্রতিটা ধাপের সময়, `STEPS`-এর ক্রম মেনে।
   *
   * ⚠️ dine-in আর delivery-তে ধাপের সংখ্যা এক নয় (`stepsFor`), কিন্তু
   * ক্রমটা একই — Placed → Preparing → (পথে/পরিবেশনের জন্য প্রস্তুত)
   * → শেষ। তাই একটাই array দুটোতেই খাটে।
   */
  const stepTimes = [
    fmtShort(order.createdAt),
    order.preparingAt ? fmtShort(order.preparingAt) : null,
    order.dispatchedAt ? fmtShort(order.dispatchedAt) : null,
    order.deliveredAt ? fmtShort(order.deliveredAt) : null,
  ];

  if (order.status === "CANCELLED") {
    return (
      <div>
        <h1 className="mb-2 font-frank-ruhl text-[30px] font-semibold leading-none text-black md:text-[40px]">
          {formatOrderId(order.id)}
        </h1>
        <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-[#D72A37]/10 p-6">
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
      {/**
        * Figma: সাদা কার্ড (radius 20), বাঁয়ে Order ID + কখন দেওয়া
        * হয়েছে, ডানে অবস্থার pill, নিচে ৪ ধাপের timeline।
        *
        * ⚠️ "Hi {firstName}" লাইনটা রাখা হয়েছে যদিও Figma-তে নেই।
        * অতিথি হিসেবে অর্ডার করলে এই পাতাটাই একমাত্র প্রমাণ যে ঠিক
        * **তাঁর** অর্ডারটা দেখা হচ্ছে — লিঙ্কটা কেউ ভুল করে পাঠালেও
        * নামটা দেখে ধরা পড়ে।
        */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-6 xl:p-[30px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-frank-ruhl text-[22px] font-semibold leading-none tracking-[-0.01em] text-black md:text-[26px]">
              Order ID: {formatOrderId(order.id)}
            </h1>
            <p className="mt-2 font-sora text-[12px] leading-[1.5] text-black/50">
              Placed on {placedLabel}
            </p>
            <p className="mt-1 font-sora text-[12px] leading-[1.5] text-black/50">
              Hi {order.firstName}, here&apos;s the live status of your order.
            </p>
          </div>

          {/* Figma-র ডানদিকের pill — বর্তমান ধাপের নাম। */}
          <span
            className={`shrink-0 rounded-full px-3.5 py-2 font-sora text-[12px] font-semibold leading-none ${
              order.status === "DELIVERED"
                ? "bg-[#2C6252]/10 text-[#2C6252]"
                : "bg-[#FF9540]/15 text-[#B75B00]"
            }`}
          >
            {STEPS[currentStepIndex]?.label ?? "Order Placed"}
          </span>
        </div>

      {/* Timeline */}
      <div className="mt-8 flex items-start justify-between md:mt-10">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {index > 0 && (
                <div
                  /* ⚠️ সংযোগ-রেখাটা gradient-এ, কঠিন সবুজে নয় — ধাপ
                     পেরোনোর অনুভূতিটা তাতে স্পষ্ট হয়, আর রঙটা বাকি
                     অ্যাপের সাথেও মেলে। */
                  className={`absolute top-5 right-1/2 -z-10 h-[3px] w-full ${
                    index <= currentStepIndex
                      ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]"
                      : "bg-black/10"
                  }`}
                />
              )}
              <div
                /**
                 * ⚠️ পেরিয়ে-আসা আর **চলতি** ধাপ আলাদা দেখায় এখন।
                 *
                 * আগে দুটোই একই সবুজ কিনারা পেত, তাই "এখন কোথায় আছি"
                 * বোঝা যেত কেবল pulse animation থেকে — আর
                 * `prefers-reduced-motion` চালু থাকলে সেটাও থাকত না।
                 * এখন চলতি ধাপটা ভরাট gradient, পেরোনোগুলো হালকা।
                 */
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isCurrent
                    ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    : isComplete
                      ? "bg-[#FF9540]/15 text-[#FA7F12]"
                      : "bg-black/[0.06] text-black/25"
                }`}
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
                className={`mt-2.5 px-1 text-center font-sora text-[11px] leading-[1.3] md:text-[12px] ${
                  isComplete || isCurrent ? "font-medium text-black" : "text-black/40"
                }`}
              >
                {step.label}
              </p>

              {/**
                * ⚠️ সময়টা কেবল **পেরোনো** ধাপে দেখানো হয়, ভবিষ্যতের
                * ধাপে নয়। Figma-তে চারটেতেই সময় আঁকা, কিন্তু সেটা একটা
                * নমুনা-নকশা — অর্ডার এখনো "Preparing"-এ না পৌঁছলে
                * "Out for Delivery 12:00" লেখা মানে একটা প্রতিশ্রুতি
                * দেওয়া, যা রাখার কোনো ভিত্তি নেই।
                *
                * ⚠️ `stepTimes[index]` null হতে পারে পুরোনো অর্ডারেও
                * (কলামগুলো যোগ হওয়ার আগের)। তখন শুধু নামটাই থাকে।
                */}
              {stepTimes[index] && (isComplete || isCurrent) && (
                <p className="mt-1 text-center font-sora text-[10px] leading-none text-black/40">
                  {stepTimes[index]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      </div>

      {order.status !== "DELIVERED" && (
        <p className="mt-6 text-center font-sora text-[12px] leading-none text-black/40">
          This page updates automatically — no need to refresh.
        </p>
      )}
      {order.status === "DELIVERED" && (
        <p className="mt-8 text-center font-sora text-[13px] font-medium leading-none text-[#2C6252]">
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
      {/* ⚠️ সাদা কার্ড + ধূসর border ছিল; এখন cream, radius 20 —
          Reservation, Our Chefs আর checkout-এর একই খোলস। */}
      <div className="mt-8 flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-5 md:p-6">
        <h2 className="font-frank-ruhl text-[18px] font-semibold leading-none text-black md:text-[20px]">
          Order Summary
        </h2>
        <div className="flex flex-col gap-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 font-sora text-[13px] text-black"
            >
              <span className="min-w-0">
                {item.menuItem.title} <span className="text-black/40">×{item.quantity}</span>
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
        <div className="flex flex-col gap-2 border-t border-black/10 pt-3 font-sora text-[13px]">
          <div className="flex justify-between gap-3 text-black/60">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>

          {isPositiveAmount(order.discountAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Discount</span>
              <span className="text-[#2C6252]">-{money(order.discountAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.tierDiscountAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Tier discount</span>
              <span className="text-[#2C6252]">-{money(order.tierDiscountAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.serviceCharge) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Service charge</span>
              <span>{money(order.serviceCharge)}</span>
            </div>
          )}

          {isPositiveAmount(order.deliveryFee) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Delivery</span>
              <span>{money(order.deliveryFee)}</span>
            </div>
          )}

          {isPositiveAmount(order.taxAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>
                {order.taxName}
                {/* INCLUSIVE: the tax sits inside the prices above, so the
                    total does NOT go up. Saying so is the difference
                    between an EU-style bill and a customer who thinks
                    they've been charged twice. */}
                {order.taxMode === "INCLUSIVE" && (
                  <span className="text-black/40"> (included)</span>
                )}
              </span>
              <span>{money(order.taxAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.giftCardAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Gift card</span>
              <span className="text-[#2C6252]">-{money(order.giftCardAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.pointsRedeemedAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Points redeemed ({order.pointsRedeemed} pts)</span>
              <span className="text-[#2C6252]">-{money(order.pointsRedeemedAmount)}</span>
            </div>
          )}

          {isPositiveAmount(order.tipAmount) && (
            <div className="flex justify-between gap-3 text-black/60">
              <span>Tip</span>
              <span>{money(order.tipAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-3">
          <span className="min-w-0 font-sora text-[12px] leading-[1.4] text-black/50">
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
          <span className="shrink-0 font-frank-ruhl text-[20px] font-semibold leading-none text-black">
            {money(order.totalAmount)}
          </span>
        </div>
      </div>

      {/**
        * Figma-র "Order Information" — ২×২ গ্রিড।
        *
        * ⚠️ "Delivery Date" ঘরটা Figma-তে আছে, কিন্তু আমাদের কোনো
        * প্রতিশ্রুত তারিখ সংরক্ষিত হয় না। অর্ডার পৌঁছে গেলে আসল
        * সময়টা দেখানো হয়; না পৌঁছলে "In progress" — একটা বানানো
        * তারিখ দেখানোর চেয়ে ভালো, কারণ সেটা প্রতিশ্রুতি হয়ে দাঁড়াত।
        */}
      <div className="mt-6 flex flex-col gap-4 rounded-[20px] bg-white p-5 md:p-6">
        <div>
          <h2 className="font-frank-ruhl text-[18px] font-semibold leading-none text-black md:text-[20px]">
            Order Information
          </h2>
          <p className="mt-2 font-sora text-[12px] leading-[1.5] text-black/50">
            Review your order details before completing your purchase.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <InfoCell label="Order Date">{fmtShort(order.createdAt)}</InfoCell>
          <InfoCell label={isDineIn ? "Served" : "Delivery Date"}>
            {order.deliveredAt ? fmtShort(order.deliveredAt) : "In progress"}
          </InfoCell>
          <InfoCell label={isDineIn ? "Table" : "Shipping Method"}>
            {isDineIn
              ? (order.table?.label ?? "—")
              : order.shippingMethod === "UBER_EATS"
                ? "Uber Eats"
                : order.shippingMethod === "OWN_DELIVERY"
                  ? "Our Own Delivery"
                  : "Food Panda"}
          </InfoCell>
          <InfoCell label="Address">
            {isDineIn ? "Dine-in" : [order.address, order.city].filter(Boolean).join(", ") || "—"}
          </InfoCell>
        </div>
      </div>

      {/**
        * Figma Frame — "Craving Something Else?"
        *
        * ⚠️ "← Back to menu" লিঙ্কটার জায়গায় এটা। একই গন্তব্য
        * (`/menu`), কিন্তু ডাকটা ভিন্ন: অর্ডার শেষ হওয়ার পর গ্রাহককে
        * "ফিরে যান" বলার চেয়ে "আবার অর্ডার করুন" বলাই স্বাভাবিক, আর
        * সেটাই Figma-র উদ্দেশ্য।
        */}
      <div className="mt-10 flex flex-col items-center gap-5 py-6 text-center md:mt-14 md:gap-6 md:py-10">
        <div className="flex flex-col items-center gap-3">
          <h2 className="max-w-[720px] font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[36px] xl:text-[44px]">
            Craving Something Else?
          </h2>
          <p className="max-w-[560px] font-sora text-[13px] leading-[1.6] text-black/60 md:text-[14px]">
            Start your next order while you wait — we&apos;ll prepare it fresh with the same care,
            quality and flavor as the one you&apos;re enjoying now.
          </p>
        </div>

        <Link
          href="/menu"
          className="flex items-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-2 pl-6 pr-2 transition-opacity hover:opacity-90"
        >
          <span className="font-sora text-[14px] font-semibold leading-[1.6] text-white md:text-[15px]">
            Order Again
          </span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Figma-র "Order Information" গ্রিডের একটা ঘর — cream, radius 12।
 *
 * ⚠️ আলাদা component, কারণ চারটে ঘর হুবহু এক। inline লিখলে একটায়
 * padding বদলে অন্য তিনটেয় ভুলে যাওয়া নিশ্চিত।
 */
function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-[#F9F6F3] p-3.5">
      <span className="block font-sora text-[11px] leading-none text-black/50">{label}</span>
      <span className="mt-1.5 block truncate font-sora text-[13px] font-semibold leading-[1.4] text-black">
        {children}
      </span>
    </div>
  );
}
