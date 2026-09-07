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
 *   Delivery Charge   এই অর্ডারে যে ফি বসেছে
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
 *   ৩. ঠিকানাটা geocode করে (না মিললে 422, অর্থাৎ পাঠানোই হয় না)
 *   ৪. rider বসিয়ে অর্ডারটাকে OUT_FOR_DELIVERY-তে নেয়
 *
 * ⚠️ তাই "Assign" আর "Mark as out for delivery" আলাদা দুটো বোতাম নয় —
 * একটাই কাজ। দুটো রাখলে rider ছাড়াই অর্ডার "পথে" চলে যেতে পারত, আর
 * তখন কেউ জানত না খাবারটা কার কাছে।
 *
 * ── Delivery Charge নিয়ে ────────────────────────────────────────────
 *
 * ⚠️ Figma-তে এখানে পাঁচটা দূরত্ব-ভিত্তিক ধাপ (0–1 Km $2 … 8+ Km $14)
 * আর একটা "Distance to customer" slider আঁকা। দুটোর একটাও বসানো
 * হয়নি, আর কারণটা ডেটার:
 *
 *   • দূরত্ব মাপার উপায় নেই — `Order`-এ খদ্দেরের কোনো স্থানাঙ্ক
 *     সংরক্ষিত হয় না (assign-rider geocode করে, কিন্তু ফলটা রাখে না),
 *     আর রেস্তোরাঁর নিজের স্থানাঙ্কও settings-এ নেই।
 *   • ধাপগুলোও কোথাও লেখা নেই — `RestaurantSettings`-এ আছে একটাই
 *     `deliveryFeeFlat`, কোনো তালিকা নয়।
 *
 * তার চেয়েও বড় কথা: ফি বদলানো এখানে **ভুল হতো**। `deliveryFee`
 * checkout-এর সময় বসে যায়, আর তার উপরেই tax আর grandTotal হিসাব হয়ে
 * অর্ডারে জমা থাকে। এখন ফি বদলালে ওই তিনটে সংখ্যা আর মিলত না —
 * খদ্দের একটা দাম দেখে টাকা দিয়েছেন, রসিদে অন্যটা থাকত।
 *
 * তাই যা দেখানো হয় সেটা এই অর্ডারে **সত্যিই বসা** ফি। দূরত্ব-ভিত্তিক
 * ধাপ সত্যিই দরকার হলে সেটা checkout-এ বসাতে হবে, এখানে নয় — তখন
 * settings-এ ধাপের তালিকা আর order-এ স্থানাঙ্ক, দুটোই লাগবে।
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

          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selected}
            className="flex h-[43px] shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-6 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Assign
          </button>
        </div>
      </div>

      {/* Delivery Charge — এই অর্ডারে সত্যিই যা বসেছে। */}
      <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[#F9F6F3] p-4">
        <span className="font-sora text-[14px] leading-none text-black/70">
          Delivery Charge Applied
        </span>
        <span className="font-frank-ruhl text-[20px] font-semibold leading-none text-black">
          {order.deliveryFeeLabel}
        </span>
      </div>

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
