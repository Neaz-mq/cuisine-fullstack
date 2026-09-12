"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { formatOrderId } from "@/lib/format-order-id";
import ChatModal from "@/components/ChatModal";
import KitchenStatusCard from "./KitchenStatusCard";
import { formatAmount, isPositiveAmount } from "@/lib/currency-format";
import type { TrackedOrder } from "@/lib/track-order";

// Leaflet `window` ছোঁয় import-এর মুহূর্তেই, তাই SSR-এ ভাঙে — শুধু
// browser-এ load হয়। Placeholder-টা আসল কার্ডের হুবহু মাপের, যাতে map
// এলে নিচের section-গুলো লাফিয়ে না নামে।
const LiveDeliveryMap = dynamic(() => import("@/components/LiveDeliveryMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full animate-pulse rounded-[20px] bg-black/5 md:h-[440px] xl:h-[573px]" />
  ),
});

const POLL_INTERVAL_MS = 15000; // same cadence as the admin Kitchen board

type LatLng = { lat: number; lng: number };

// Figma-র রং।
const TICK_DONE = "#0ECF00";
const TICK_PENDING = "rgba(0, 0, 0, 0.4)";

function stepsFor(orderType: TrackedOrder["orderType"]) {
  return [
    { key: "PLACED", label: "Order Placed" },
    { key: "PREPARING", label: "Preparing" },
    { key: "OUT_FOR_DELIVERY", label: orderType === "DINE_IN" ? "Ready to Serve" : "Out for Delivery" },
    { key: "DELIVERED", label: orderType === "DINE_IN" ? "Served" : "Delivered" },
  ] as const;
}

function shippingLabel(method: TrackedOrder["shippingMethod"]) {
  if (method === "UBER_EATS") return "Uber Eats";
  if (method === "FOOD_PANDA") return "Food Panda";
  if (method === "OWN_DELIVERY") return "Our Own Delivery";
  return "—";
}

/**
 * ⚠️ তারিখগুলো কেবল browser-এ লেখা হয়।
 *
 * সময় দেখানো হয় দর্শকের ঘড়িতে (গ্রাহক জানতে চান **তাঁর** কখন অর্ডারটা
 * গেছে)। কিন্তু server — Vercel-এ — UTC-তে চলে, তাই আগে server-এর HTML
 * আর browser-এর render-এ সময় আলাদা হতো, আর React hydration mismatch
 * দিত। প্রথম render-এ (server + hydration) একটা ফাঁকা জায়গা, mount-এর
 * পর আসল সময় — mismatch-এর কোনো সুযোগই থাকে না।
 */
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const MONTH = (d: Date) => d.toLocaleString("en-US", { month: "short" });
const TIME_24 = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "Jul 12, 2026 at 7:42 PM" — Figma-র "Placed on …"। */
function fmtPlaced(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${MONTH(d)} ${d.getDate()}, ${d.getFullYear()} at ${time}`;
}

/** "7 Jul, 11:30" — timeline-এর প্রতিটা ধাপ। */
function fmtStep(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH(d)}, ${TIME_24(d)}`;
}

/** "7 Jul, 2024" — Order Information-এর ঘর। */
function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH(d)}, ${d.getFullYear()}`;
}

/**
 * "25-30 min"। server অনুমানটা পাঠায় মিনিটে (lib/track-order.ts)।
 * পথের সময় পেরিয়ে গেলে মান শূন্যে থামে — তখন একটা ঋণাত্মক বা "0-0 min"
 * দেখানোর বদলে সৎ কথাটা বলা হয়।
 */
function formatEta(eta: { min: number; max: number }) {
  if (eta.max <= 0) return "Any minute now";
  if (eta.min <= 0) return `Under ${eta.max} min`;
  return `${eta.min}-${eta.max} min`;
}

function hasRiderLocation(tracking: TrackedOrder["deliveryTracking"]): LatLng | null {
  if (!tracking || tracking.deliveredAt !== null) return null;
  if (tracking.riderLat === null || tracking.riderLng === null) return null;
  return { lat: tracking.riderLat, lng: tracking.riderLng };
}

export default function OrderTrackingTimeline({
  initialOrder,
  origin,
}: {
  initialOrder: TrackedOrder;
  /** রেস্তোরাঁর স্থানাঙ্ক — poll-এ বদলায় না, তাই আলাদা prop। */
  origin: LatLng;
}) {
  const [order, setOrder] = useState<TrackedOrder>(initialOrder);
  const [chatOpen, setChatOpen] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    if (order.status === "DELIVERED" || order.status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok) return;
        // ⚠️ পাতা আর endpoint এখন একই serializer ব্যবহার করে
        // (lib/track-order.ts), তাই এই object-টা initialOrder-এর হুবহু
        // আকৃতির — কোনো field poll-এর পর হারিয়ে যায় না।
        const data: TrackedOrder = await res.json();
        setOrder(data);
      } catch {
        // network error — silently retry on the next poll
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [order.id, order.status]);

  const isDineIn = order.orderType === "DINE_IN";
  const isCancelled = order.status === "CANCELLED";
  const STEPS = stepsFor(order.orderType);
  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);

  const money = (value: string) => formatAmount(value, order.currency);
  const when = (iso: string | null, fmt: (iso: string) => string) =>
    iso && isClient ? fmt(iso) : "\u00A0";

  const stepTimes = [order.createdAt, order.preparingAt, order.dispatchedAt, order.deliveredAt];

  const rider = hasRiderLocation(order.deliveryTracking);

  /**
   * ⚠️ Map কেবল অর্ডার পথে থাকলে — আগে PLACED/PREPARING-এও দেখানো হতো।
   *
   * খাবার তখনো রান্নাঘরে, কেউ কোথাও যাচ্ছে না; map-টা কেবল রেস্তোরাঁ
   * থেকে বাড়ি পর্যন্ত একটা স্থির রেখা দেখাত আর "54-69 min" লিখত, যেন
   * ডেলিভারি চলছে। Figma ওই অবস্থায় map-এর জায়গায় রান্নাঘরের কার্ড
   * দেখায় — সেটাই সত্যিকারের খবর।
   */
  const inKitchen = order.status === "PLACED" || order.status === "PREPARING";
  const showMap = order.orderType === "DELIVERY" && order.status === "OUT_FOR_DELIVERY";

  /**
   * Chat কেবল নিজেদের rider-এর ক্ষেত্রে।
   *
   * ⚠️ Uber Eats / Food Panda-র অর্ডারে কোনো DeliveryTracking row নেই,
   * তাই chat API-ও 404 দিত — বোতামটা দেখানো মানে একটা ভাঙা দরজা দেখানো।
   */
  const canChat =
    order.orderType === "DELIVERY" &&
    order.shippingMethod === "OWN_DELIVERY" &&
    order.deliveryTracking !== null;

  const chatActive =
    canChat && order.status === "OUT_FOR_DELIVERY" && !order.deliveryTracking?.deliveredAt;

  // অর্ডার পথে আছে আর rider বসানো হয়েছে — Figma-র "on the way" অবস্থা।
  const onTheWay = order.status === "OUT_FOR_DELIVERY" && order.rider !== null;

  return (
    <div className="flex flex-col gap-6 md:gap-10 xl:gap-[60px]">
      {/**
        * ── ১. Order ID + timeline ─────────────────────────────────────
        * Figma "Frame 2147236139": সাদা, padding 30, gap 40, radius 20।
        *
        * ⚠️ বাদ গেছে: "Hi {firstName}, here's the live status…" আর
        * "This page updates automatically" — কোনোটাই Figma-তে নেই। পাতা
        * এখনো ১৫ সেকেন্ডে নিজে থেকেই বদলায়; শুধু সেটা ঘোষণা করা হয় না।
        */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 md:gap-8 md:p-6 xl:gap-10 xl:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2 md:gap-3">
            {/* ⚠️ দুই রঙের শিরোনাম: Figma-তে "Order ID:" black/70 medium,
                নম্বরটা কালো আর গাঢ়। */}
            <h1 className="font-frank-ruhl text-[24px] leading-[1.3] md:text-[30px] xl:text-[36px]">
              <span className="font-medium text-black/70">Order ID: </span>
              <span className="font-semibold text-black">{formatOrderId(order.id)}</span>
            </h1>
            <p className="font-sora text-[14px] leading-[1.3] text-black/70 md:text-[16px] xl:text-[18px]">
              Placed on {when(order.createdAt, fmtPlaced)}
            </p>
          </div>

          <span
            className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 font-sora text-[13px] font-semibold leading-[1.3] md:h-[46px] md:px-5 md:text-[16px] ${
              isCancelled ? "bg-[#D72A37]/10 text-[#D72A37]" : "bg-[#E5EDFF] text-[#0090FF]"
            }`}
          >
            {isCancelled ? "Cancelled" : (STEPS[currentStepIndex]?.label ?? "Order Placed")}
          </span>
        </div>

        {isCancelled ? (
          <p className="rounded-[12px] bg-[#D72A37]/5 px-4 py-3 font-sora text-[14px] leading-[1.6] text-[#D72A37]">
            This order was cancelled. If this wasn&apos;t expected, please contact us for help.
          </p>
        ) : (
          /**
           * Timeline — Figma "Frame 2147236156"।
           *
           *   ধাপগুলো space-between: প্রথম লেখার বাঁ কিনারা কার্ডের বাঁয়ে,
           *   শেষটার ডান কিনারা ডানে। পিছনে 2px #D9D9D9 রেখা, প্রথম আইকনের
           *   কেন্দ্র থেকে শেষ আইকনের কেন্দ্র পর্যন্ত।
           *
           * ⚠️ রেখার দুই মাথা স্থির px-এ বসানো যায় না — ধাপের চওড়াই লেখার
           * দৈর্ঘ্যে ঠিক হয় ("Delivered" বনাম "Served")। তাই: রেখাটা প্রথম
           * ধাপের কেন্দ্র থেকে অনেক দূর পর্যন্ত যায়, শেষ ধাপ নিজের কেন্দ্র
           * থেকে ডানে একটা সাদা পর্দা টানে, আর `overflow-hidden` বাকিটা
           * কাটে। যেকোনো লেখা, যেকোনো প্রস্থে দুই মাথা ঠিক কেন্দ্রে থাকে।
           *
           * ⚠️ রেখা পুরোটাই ধূসর, অগ্রগতিতে রং বদলায় না — Figma তাই দেখায়।
           * কোথায় আছি সেটা বলে আইকনের সবুজ।
           *
           * ⚠️ সময় কেবল পেরোনো ধাপে। Figma-তে চারটেতেই সময় আঁকা, কিন্তু
           * অর্ডার "Preparing"-এ না পৌঁছলে "Out for Delivery 12:00" লেখা
           * মানে একটা প্রতিশ্রুতি, যা রাখার ভিত্তি নেই।
           */
          <ol className="relative flex items-start justify-between gap-2 overflow-hidden">
            {STEPS.map((step, index) => {
              const reached = index <= currentStepIndex;
              const isFirst = index === 0;
              const isLast = index === STEPS.length - 1;

              return (
                <li key={step.key} className="relative flex min-w-0 flex-col items-center gap-2 md:gap-3">
                  {isFirst && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-[13px] h-[2px] w-[9999px] bg-[#D9D9D9] md:top-[17px]"
                    />
                  )}
                  {isLast && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-0 h-7 w-[9999px] bg-white md:h-9"
                    />
                  )}

                  <TickCircle
                    color={reached ? TICK_DONE : TICK_PENDING}
                    className="relative z-[1] h-7 w-7 shrink-0 md:h-9 md:w-9"
                  />

                  <div className="relative z-[1] flex flex-col items-center gap-1 text-center md:gap-2">
                    <span
                      className={`max-w-[80px] font-sora text-[12px] leading-[1.3] md:max-w-none md:text-[16px] ${
                        reached ? "text-black" : "text-black/40"
                      }`}
                    >
                      {step.label}
                    </span>
                    {reached && stepTimes[index] && (
                      <span className="whitespace-nowrap font-sora text-[10px] leading-[1.3] text-black/70 md:text-[12px]">
                        {when(stepTimes[index], fmtStep)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/**
        * ── ২. Map ────────────────────────────────────────────────────
        * কেবল চলমান delivery অর্ডারে। dine-in-এ map অর্থহীন, আর পৌঁছে
        * যাওয়া বা বাতিল অর্ডারে "Arriving in" বলার কিছু নেই।
        */}
      {showMap && (
        <LiveDeliveryMap
          origin={origin}
          destination={order.destination}
          rider={rider}
          riderUpdatedAt={rider ? order.deliveryTracking?.riderLocationUpdatedAt ?? null : null}
          caption={order.eta ? "Arriving in" : "Order status"}
          headline={order.eta ? formatEta(order.eta) : (STEPS[currentStepIndex]?.label ?? "")}
          riderName={order.rider?.name}
          riderImage={order.rider?.image}
          onOpenChat={canChat ? () => setChatOpen(true) : undefined}
        />
      )}

      {/**
        * ── ৩. Order Information | পদ + বিল ───────────────────────────
        * Figma "Frame 2147236137": 672 · 60 · 548, দুই কলাম উপরে সাঁটা
        * (বাঁ কার্ডটা ছোট, টানা হয় না)। `fr` — Carts পাতার মতোই, যাতে
        * 1280-এর নিচে অনুপাত ঠিক থেকে দুটোই ছোট হয়।
        */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,672fr)_minmax(0,548fr)] lg:gap-8 xl:gap-[60px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/**
            * ⚠️ বাঁ কলামটা status অনুযায়ী বদলায়, ঠিক Figma-র মতো।
            *
            *   রান্নাঘরে (PLACED/PREPARING) → "Preparing" কার্ড
            *   rider পথে (OUT_FOR_DELIVERY)  → "on the way" কার্ড
            *   বাকি সব                       → Order Information
            *
            * অর্থাৎ ঠিকানা আর shipping method চলাকালীন দেখা যায় না,
            * ফিরে আসে অর্ডার পৌঁছে গেলে। Figma-র তিনটে frame ঠিক এটাই
            * দেখায়: চলার সময় গ্রাহকের প্রশ্ন "কোথায়?", "ঠিকানা কী?" নয় —
            * সেটা তিনি checkout-এ এইমাত্র লিখেছেন।
            */}
          {inKitchen ? (
            <KitchenStatusCard
              status={order.status === "PLACED" ? "PLACED" : "PREPARING"}
              items={order.items}
              itemCount={order.itemCount}
              prepMinutesLeft={order.prepMinutesLeft}
            />
          ) : onTheWay && order.rider ? (
            <OnTheWayCard
              rider={order.rider}
              onOpenChat={canChat ? () => setChatOpen(true) : undefined}
            />
          ) : (
          /* Figma "Frame 2147236139" (বাঁ): সাদা, padding 30, gap 40। */
          <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 md:p-6 xl:gap-10 xl:p-[30px]">
            <div className="flex flex-col gap-2">
              <h2 className="font-frank-ruhl text-[24px] font-medium leading-[1.3] text-black md:text-[30px] xl:text-[36px]">
                Order Information
              </h2>
              <p className="font-sora text-[12px] leading-[1.6] text-black/70">
                Review your order details before completing your purchase.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              <InfoCell label="Order Date">{when(order.createdAt, fmtDay)}</InfoCell>
              {/* ⚠️ আমাদের কোনো প্রতিশ্রুত delivery তারিখ সংরক্ষিত হয় না।
                  পৌঁছে গেলে আসল তারিখ; নইলে "In progress" — বানানো তারিখ
                  একটা প্রতিশ্রুতি হয়ে দাঁড়াত। */}
              <InfoCell label={isDineIn ? "Served" : "Delivery Date"}>
                {order.deliveredAt ? when(order.deliveredAt, fmtDay) : isCancelled ? "—" : "In progress"}
              </InfoCell>
              <InfoCell label={isDineIn ? "Table" : "Shipping Method"}>
                {isDineIn ? (order.table?.label ?? "—") : shippingLabel(order.shippingMethod)}
              </InfoCell>
              <InfoCell label="Address">
                {isDineIn ? "Dine-in" : [order.address, order.city].filter(Boolean).join(", ") || "—"}
              </InfoCell>
            </div>
          </div>
          )}

        </div>

        {/* Figma "Frame 2147236140" (ডান): সাদা, padding 30, gap 30। */}
        <div className="flex min-w-0 flex-col gap-4 rounded-[20px] bg-white p-4 md:gap-6 md:p-6 xl:gap-[30px] xl:p-[30px]">
          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <OrderItemCard key={item.id} item={item} money={money} />
            ))}
          </div>

          {/**
            * বিল — Figma "Frame 2147236146": cream, padding 16, radius 20।
            *
            * ⚠️ শূন্য লাইনগুলো লুকানো থাকে (Figma-তে চারটেই সারি, কারণ নমুনা
            * অর্ডারে ছাড় বা tip নেই)। ব্যতিক্রম delivery: শূন্য হলে "Free"
            * লেখা হয়, ঠিক Figma-র মতো — ওটা গ্রাহকের জানার মতো তথ্য।
            */}
          <div className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-[11px]">
                      <TickCircle color="#FF9540" className="h-6 w-6 shrink-0" />
                      <span className="min-w-0 truncate font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
                        {item.quantity}p. {item.title}
                      </span>
                    </span>
                    <Amount>{money(item.price)}</Amount>
                  </div>
                ))}
              </div>

              <hr className="border-0 border-t border-[#D9D9D9]" />

              <div className="flex flex-col gap-4">
                <BillRow label="Subtotal">{money(order.subtotal)}</BillRow>

                {isPositiveAmount(order.discountAmount) && (
                  <BillRow label="Discount" credit>-{money(order.discountAmount)}</BillRow>
                )}
                {isPositiveAmount(order.tierDiscountAmount) && (
                  <BillRow label="Tier discount" credit>-{money(order.tierDiscountAmount)}</BillRow>
                )}
                {isPositiveAmount(order.serviceCharge) && (
                  <BillRow label="Service charge">{money(order.serviceCharge)}</BillRow>
                )}
                {!isDineIn && (
                  <BillRow label="Standard delivery">
                    {isPositiveAmount(order.deliveryFee) ? money(order.deliveryFee) : "Free"}
                  </BillRow>
                )}
                {isPositiveAmount(order.taxAmount) && (
                  <BillRow
                    label={
                      <>
                        {order.taxName}
                        {/* INCLUSIVE: কর উপরের দামের ভেতরেই, মোট বাড়ে না —
                            না বললে গ্রাহক ভাববেন দুবার কাটা হয়েছে। */}
                        {order.taxMode === "INCLUSIVE" && (
                          <span className="text-black/40"> (included)</span>
                        )}
                      </>
                    }
                  >
                    {money(order.taxAmount)}
                  </BillRow>
                )}
                {isPositiveAmount(order.giftCardAmount) && (
                  <BillRow label="Gift card" credit>-{money(order.giftCardAmount)}</BillRow>
                )}
                {isPositiveAmount(order.pointsRedeemedAmount) && (
                  <BillRow label={`Points (${order.pointsRedeemed} pts)`} credit>
                    -{money(order.pointsRedeemedAmount)}
                  </BillRow>
                )}
                {isPositiveAmount(order.tipAmount) && (
                  <BillRow label="Tip">{money(order.tipAmount)}</BillRow>
                )}
              </div>

              <hr className="border-0 border-t border-[#D9D9D9]" />
            </div>

            <div className="flex flex-col gap-[14px]">
              <span className="text-center font-sora text-[14px] leading-none text-black/70">
                Total Price({order.itemCount})
              </span>
              <div className="flex items-center justify-center gap-3">
                {order.undiscountedTotal && (
                  <span className="font-frank-ruhl text-[18px] font-medium leading-none text-black/40 line-through">
                    {money(order.undiscountedTotal)}
                  </span>
                )}
                <span className="font-frank-ruhl text-[18px] font-semibold leading-none text-black">
                  {money(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/**
        * ⚠️ Modal সবসময় render হয়, শুধু `open` false থাকে।
        *
        * শর্তসাপেক্ষে mount করলে প্রতিবার খুলে বন্ধ করলে ChatPanel নতুন
        * করে সব বার্তা fetch করত আর Supabase channel আবার জুড়ত — অথচ
        * `<dialog>` বন্ধ থাকলে ব্রাউজার এমনিতেই কিছু দেখায় না।
        *
        * `canChat` false হলে (Uber Eats ইত্যাদি) একেবারেই render হয় না,
        * কারণ তখন chat endpoint-ই নেই।
        */}
      {canChat && (
        <ChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          orderId={order.id}
          riderName={order.rider?.name ?? "your rider"}
          active={chatActive}
          inactiveMessage={
            order.deliveryTracking?.deliveredAt
              ? "This delivery is complete — chat is now closed."
              : "Chat opens once your rider is on the way."
          }
        />
      )}
    </div>
  );
}

/**
 * Figma "on the way" — অর্ডার রাস্তায় থাকার সময় বাঁ কলামের কার্ড।
 *
 *   সাদা কার্ড, ভেতরে rider-এর ছবি + "Marcus is on the way with your
 *   order!" + এক লাইন ব্যাখ্যা।
 *
 * ⚠️ Figma-তে ছবিটা একটা সাধারণ ডেলিভারি-ছবি; এখানে আসল rider-এর
 * অবতার, থাকলে। যিনি দরজায় আসবেন তাঁর মুখটা আগে দেখা থাকলে দরজা
 * খোলার মুহূর্তটা গ্রাহকের জন্য নিরাপদ লাগে — একটা stock ছবির চেয়ে
 * সেটার মূল্য বেশি।
 *
 * ⚠️ chat বোতামটা Figma-র কার্ডে নেই, map-এ আছে। তবু এখানেও রাখা হয়েছে:
 * মোবাইলে map-এর pill-টা ছোট, আর এটাই সবচেয়ে স্বাভাবিক জায়গা যেখানে
 * গ্রাহক rider-কে খুঁজবেন।
 */
function OnTheWayCard({
  rider,
  onOpenChat,
}: {
  rider: NonNullable<TrackedOrder["rider"]>;
  onOpenChat?: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 md:p-6 xl:gap-10 xl:p-[30px]">
      <div className="flex gap-4 rounded-[20px] bg-[#F9F6F3] p-3 md:p-4">
        {rider.image ? (
          <Image
            src={rider.image}
            alt=""
            width={72}
            height={72}
            aria-hidden="true"
            className="h-14 w-14 shrink-0 rounded-[14px] object-cover md:h-[72px] md:w-[72px]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#FF9540] font-sora text-[20px] font-semibold text-white md:h-[72px] md:w-[72px]"
          >
            {rider.name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="font-frank-ruhl text-[17px] font-semibold leading-[1.3] text-black md:text-[20px]">
            {rider.name} is on the way with your order!
          </h2>
          <p className="font-sora text-[12px] leading-[1.6] text-black/70">
            Your food left our kitchen hot and fresh — it&apos;s now heading straight to your
            address.
          </p>
        </div>
      </div>

      {onOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          className="flex h-12 items-center justify-center gap-2 self-start rounded-full bg-[#E5EDFF] px-6 font-sora text-[14px] font-semibold leading-none text-[#0090FF] transition-opacity hover:opacity-80 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8.5 19h-.5a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6h-.5l-3.5 2.5L8.5 19Z" />
          </svg>
          Chat with {rider.name.split(" ")[0]}
        </button>
      )}
    </div>
  );
}

/**
 * Figma "Checkout card" — cream, padding 16, gap 12, radius 20; ছবি 106px।
 *
 * ⚠️ Figma-র trash আইকন আর − ০১ + stepper **রাখা হয়নি**। নকশাটা checkout
 * পাতার কার্ড থেকে নেওয়া, কিন্তু এখানে অর্ডার ইতিমধ্যে দেওয়া হয়ে গেছে —
 * মোছা বা পরিমাণ বদলানোর কোনো backend নেই, আর থাকা উচিতও নয় (টাকা কাটা
 * হয়ে গেছে)। কাজ-না-করা বোতাম দেখানো মানে গ্রাহককে বিভ্রান্ত করা। তার
 * জায়গায় একই সাদা pill-এ কেবল পরিমাণটা।
 */
function OrderItemCard({
  item,
  money,
}: {
  item: TrackedOrder["items"][number];
  money: (value: string) => string;
}) {
  return (
    <div className="flex gap-3 rounded-[20px] bg-[#F9F6F3] p-3 md:p-4">
      {item.imageUrl && (
        <Image
          src={item.imageUrl}
          alt={item.title}
          width={106}
          height={106}
          unoptimized
          className="h-20 w-20 shrink-0 rounded-[14px] object-cover md:h-[106px] md:w-[106px] md:rounded-[20px]"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="min-w-0 truncate font-frank-ruhl text-[17px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[20px]">
            {item.title}
          </p>
          {item.description && (
            <p className="line-clamp-2 font-sora text-[12px] leading-[1.5] text-black/70">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-frank-ruhl text-[16px] font-semibold leading-[1.3] text-black">
            {money(item.unitPrice)}
          </span>
          <span className="inline-flex h-[34px] shrink-0 items-center rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black">
            <span className="text-black/50">Qty&nbsp;</span>
            <span className="tabular-nums">{String(item.quantity).padStart(2, "0")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function BillRow({
  label,
  credit = false,
  children,
}: {
  label: ReactNode;
  /** ছাড়/পরিশোধ — সবুজ, আগের রসিদের মতোই। */
  credit?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">{label}</span>
      <Amount className={credit ? "text-[#2C6252]" : undefined}>{children}</Amount>
    </div>
  );
}

function Amount({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`shrink-0 text-right font-frank-ruhl text-[16px] font-semibold leading-none ${
        className ?? "text-black"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Figma-র "Order Information" ঘর — cream, padding 8×12, radius 12।
 *
 * ⚠️ Figma-তে শিরোনাম বড় (16px, কালো) আর মান ছোট (12px, black/70) —
 * আগের সংস্করণে উল্টো ছিল।
 */
function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[12px] bg-[#F9F6F3] px-3 py-2">
      <span className="font-sora text-[16px] leading-[1.3] text-black">{label}</span>
      <span className="truncate font-sora text-[12px] leading-[1.3] text-black/70">{children}</span>
    </div>
  );
}

/** vuesax/bold/tick-circle — ভরাট গোল, ভেতরে সাদা টিক। */
function TickCircle({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={color} />
      <path
        d="M7.75 12.2 10.58 15l5.67-5.66"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
