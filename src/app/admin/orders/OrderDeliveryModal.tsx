"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  SelectField,
} from "@/components/admin/modal-ui";
import DeliveryZoneBreakdown from "@/components/admin/DeliveryZoneBreakdown";
import { type OrderViewData } from "./OrderViewModal";

type Rider = { id: string; name: string | null; phone: string | null };

/**
 * src/app/admin/orders/OrderDeliveryModal.tsx
 *
 * Figma "Ready to Delivery" — রান্না শেষ হওয়া একটা delivery অর্ডার
 * পাঠানোর পর্দা:
 *
 *   Address           cream বাক্স, read-only
 *   Delivery Rider    select + "Assign" বোতাম
 *   Delivery Charge   দূরত্বের ধাপ + মাপা দূরত্ব + প্রযোজ্য ফি
 *   পদের সারি         কালো গোল নম্বর + "নাম × সংখ্যা" … দাম
 *   পাদটীকা           মাধ্যম · টাকার ধরন, ডানে Total
 *
 * ── "Assign" চাপলে আসলে কী হয় ───────────────────────────────────────
 *
 * `POST /api/admin/orders/<id>/assign-rider` — আর সেই route একাই
 * চারটে কাজ করে, তাই এখানে আলাদা কোনো status বদলের ডাক নেই:
 *
 *   ১. ONLINE অর্ডারের টাকা এসেছে কিনা দেখে (PENDING হলে আটকে দেয়)
 *   ২. PLACED হলে আগে PREPARING-এ নেয় — কারণ inventory ঠিক ওই
 *      ধাপেই কাটা হয়, আর লাফ দিলে stock নীরবে ভুল হয়ে যেত
 *   ৩. গন্তব্যের স্থানাঙ্ক ঠিক করে (checkout-এ মাপা মানটা থাকলে সেটাই,
 *      নইলে তখনই geocode করে)
 *   ৪. rider বসিয়ে অর্ডারটাকে OUT_FOR_DELIVERY-তে নেয়
 *
 * ⚠️ তাই "Assign" আর "Mark as out for delivery" আলাদা দুটো বোতাম নয় —
 * একটাই কাজ। দুটো রাখলে rider ছাড়াই অর্ডার "পথে" চলে যেতে পারত, আর
 * তখন কেউ জানত না খাবারটা কার কাছে।
 *
 * ── Delivery Charge নিয়ে ────────────────────────────────────────────
 *
 * ⚠️ Figma-র ধাপগুলো আর "Distance to customer" বার এখন সত্যিই আছে,
 * কিন্তু **পড়ার জন্য, বদলানোর জন্য নয়**।
 *
 * ফি বসে checkout-এ (lib/delivery-fee.ts), আর তার উপরেই tax আর
 * grandTotal হিসাব হয়ে Order row-তে জমা থাকে; ONLINE অর্ডারে টাকাটা
 * ততক্ষণে কেটেও গেছে। এখান থেকে ধাপ বদলাতে দিলে খদ্দের একটা দাম
 * দেখে টাকা দিতেন আর রসিদে অন্যটা থাকত।
 *
 * এই পর্দার কাজ তাই একটাই: staff-কে দেখানো **কেন** এই ফি বসেছিল।
 * অঙ্কটা ভুল মনে হলে পথ refund/adjustment, ধাপ বদলানো নয়।
 *
 * তালিকাটা order-এর নিজের snapshot থেকে আসে (Order.deliveryZones),
 * আজকের settings থেকে নয় — নইলে owner দাম বদলানোর পরদিন পুরোনো
 * প্রতিটা অর্ডারের modal মিথ্যা বলত।
 */
export default function OrderDeliveryModal({
  open,
  onClose,
  orderId,
  order,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  order: OrderViewData;
}) {
  if (!open) return null;
  return (
    <OrderDeliveryModalContent
      open={open}
      onClose={onClose}
      orderId={orderId}
      order={order}
    />
  );
}

function OrderDeliveryModalContent({
  open,
  onClose,
  orderId,
  order,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  order: OrderViewData;
}) {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [selected, setSelected] = useState(order.riderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * ⚠️ rider-দের তালিকা modal খোলার পরে আনা হয়, পাতার সাথে নয়। এক
   * পাতায় দশটা সারি, অর্থাৎ দশবার একই তালিকা server থেকে পাঠাতে হতো
   * — অথচ বেশিরভাগ সারিতে modal-টা কখনো খোলাই হয় না।
   */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/riders")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setRiders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRiders([]);
      });
    // ⚠️ modal বন্ধ হয়ে গেলে উত্তরটা আর বসানো হয় না — নাহলে React
    // unmounted component-এ setState নিয়ে সতর্ক করত।
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAssign = async () => {
    if (!selected) {
      setError("Please choose a rider first.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: selected }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // ⚠️ route-এর নিজের বার্তাটাই দেখানো হয় — "টাকা এখনো আসেনি"
        // বা "ঠিকানাটা মানচিত্রে পাওয়া গেল না" জাতীয় কারণগুলো ওখান
        // থেকেই আসে, আর সেগুলো ছাড়া staff বুঝতেই পারতেন না কী করতে হবে।
        throw new Error(data.error ?? "Couldn't assign this rider.");
      }

      onClose();
      router.refresh();
      toast.success("Rider assigned — order is on the way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign this rider.");
    } finally {
      setSubmitting(false);
    }
  };

  const riderOptions = (riders ?? []).map((rider) => ({
    value: rider.id,
    label: rider.phone ? `${rider.name ?? "Rider"} · ${rider.phone}` : (rider.name ?? "Rider"),
  }));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId={`order-dispatch-${orderId}`}
      title="Ready to Delivery"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]"
              aria-hidden="true"
            />
            <span className="truncate font-sora text-[13px] leading-none text-black/70">
              {order.channel} —{" "}
              <span className="font-medium text-black">{order.paymentLabel}</span>
            </span>
          </span>

          <span className="shrink-0 font-sora text-[13px] leading-none text-black/70">
            Total:{" "}
            <span className="font-frank-ruhl text-[22px] font-semibold text-black">
              {order.totalLabel}
            </span>
          </span>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      <p className="-mt-2 font-sora text-[13px] leading-none text-black/50">
        {order.reference}
      </p>

      {/* Address — cream বাক্স, ভেতরে read-only ঘর। */}
      <div className="rounded-[20px] bg-[#F9F6F3] p-4">
        <label htmlFor={`dispatch-address-${orderId}`} className={LABEL}>
          Address
        </label>
        {/* ⚠️ `readOnly`, `disabled` নয় — disabled ইনপুটের লেখা মাউস
            দিয়ে বাছা যায় না, অথচ ঠিকানাটা কপি করে রাইডারকে পাঠানো
            এখানকার সবচেয়ে স্বাভাবিক কাজ। */}
        <input
          id={`dispatch-address-${orderId}`}
          type="text"
          readOnly
          value={order.address ?? "No delivery address on this order"}
          className={`${FIELD} bg-white`}
        />
      </div>

      {/* Delivery Rider — select + Assign, পাশাপাশি। */}
      <div className="rounded-[20px] bg-[#F9F6F3] p-4">
        <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-end">
          <div className="min-w-0 flex-1">
            {riders === null ? (
              <>
                <span className={LABEL}>Delivery Rider</span>
                <p className="flex h-[43px] items-center font-sora text-[12px] text-black/50">
                  Loading riders…
                </p>
              </>
            ) : riderOptions.length === 0 ? (
              <>
                <span className={LABEL}>Delivery Rider</span>
                {/* ⚠️ খালি dropdown-এর বদলে স্পষ্ট কথা — কারণটা এখানে
                    অর্ডারের নয়, staff তালিকার: কোনো DELIVERY role-এর
                    সক্রিয় ব্যবহারকারী নেই। */}
                <p className="flex h-[43px] items-center font-sora text-[12px] text-black/50">
                  No active riders — add one under Staff first.
                </p>
              </>
            ) : (
              <SelectField
                id={`dispatch-rider-${orderId}`}
                label="Delivery Rider"
                value={selected}
                onChange={setSelected}
                options={[{ value: "", label: "Select a rider…" }, ...riderOptions]}
              />
            )}
          </div>

          {/**
           * ⚠️ `w-full` তারপর `min-[560px]:w-auto` — ৩২০px পর্দায়
           * select আর বোতাম উপর-নিচে বসে, আর তখন `shrink-0` + px-6
           * বোতামটাকে সরু পর্দায় modal-এর বাইরে ঠেলে দিত। orders
           * তালিকার বোতামজোড়াতেও ঠিক এই ভুলটাই ছিল।
           */}
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selected}
            className="flex h-[43px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-6 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[560px]:w-auto min-[560px]:shrink-0"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Assign
          </button>
        </div>
      </div>

      {/**
       * Delivery Charge — Figma-র ধাপ + দূরত্ব বার + প্রযোজ্য ফি।
       *
       * ⚠️ `order.delivery` না থাকলে (FLAT mode-এ চলা দোকান, বা এই
       * feature চালুর আগের অর্ডার) component নিজেই সরল সারিটায় নেমে
       * আসে — এখানে আলাদা শর্ত লেখা হয়নি, যাতে "কখন কোনটা" সিদ্ধান্তটা
       * এক জায়গাতেই থাকে।
       */}
      <DeliveryZoneBreakdown
        delivery={
          order.delivery ?? {
            zones: [],
            distanceKm: null,
            barRatio: 0,
            appliedFeeLabel: order.deliveryFeeLabel,
            fellBackToFlat: false,
          }
        }
      />

      {/* পদের সারি — View Order modal-এর হুবহু একই গড়ন। */}
      <div className="flex flex-col gap-3">
        {order.items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-[20px] bg-[#F9F6F3] p-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black font-sora text-[12px] font-medium text-white"
              >
                {index + 1}
              </span>
              <span className="truncate font-sora text-[14px] leading-[1.4] text-black">
                {item.title} × {item.quantity}
              </span>
            </span>

            <span className="shrink-0 font-frank-ruhl text-[18px] font-semibold leading-none text-black">
              {item.lineTotal}
            </span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
