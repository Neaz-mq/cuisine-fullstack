"use client";

import { FIELD, LABEL, ModalShell } from "@/components/admin/modal-ui";

export type OrderViewData = {
  id: string;
  reference: string;
  email: string | null;
  phone: string;
  address: string | null;
  items: { id: string; title: string; quantity: number; lineTotal: string }[];
  /** "Uber Eats" / "Table - 2" — সারিতে যা দেখায় ঠিক সেটাই। */
  channel: string;
  /** "Online Payment" / "Cash on Delivery" / "Pay at Table"। */
  paymentLabel: string;
  totalLabel: string;
  /**
   * এই অর্ডারে সত্যিই যে delivery ফি বসেছে (checkout-এর সময় স্থির
   * হয়ে গেছে)। "Ready to Delivery" modal-এ দেখানো হয়।
   */
  deliveryFeeLabel: string;
  /** আগে কোনো rider বসানো থাকলে তার id — dropdown-এ আগে থেকে বাছা থাকে। */
  riderId: string | null;
};

/**
 * src/app/admin/orders/OrderViewModal.tsx
 *
 * Figma "View Order" — প্রজেক্টের বাকি সব modal-এর একই খোলসে
 * (`components/admin/modal-ui.tsx` → Frame 2147236222):
 *
 *   cream বাক্স   Email Address │ Phone Number, নিচে Address
 *   পদের সারি     কালো গোল নম্বর + "নাম × সংখ্যা" … দাম
 *   পাদটীকা       কমলা বিন্দু + "Uber Eats - Online Payment",
 *                 ডানে "Total: $150.00"
 *
 * ⚠️ ঘরগুলো `readOnly`, `disabled` নয়। দুটোরই চেহারা এক, কিন্তু
 * `disabled` ইনপুটের লেখা মাউস দিয়ে নির্বাচন করা যায় না — অর্থাৎ
 * ফোন নম্বর বা ঠিকানা **কপি করা যেত না**, অথচ staff-এর ঠিক ওটাই
 * সবচেয়ে বেশি দরকার হয় (রাইডারকে পাঠানো, ফোন করা)। `readOnly`-তে
 * লেখা বাছা যায়, শুধু বদলানো যায় না।
 *
 * ── কেন modal, আর কেন `/admin/orders/[id]` পাতাটা রয়ে গেল ──────────
 *
 * ⚠️ পুরনো "View Order" লিঙ্কটা আলাদা একটা পাতায় নিয়ে যেত, আর সেখানে
 * এই তথ্যের **চেয়ে বেশি** আছে: rider assign করার ঘর, subtotal/VAT-এর
 * ভাঙচুর, refund। নকশার এই modal-টা তার সংক্ষিপ্ত রূপ — এক নজরে
 * "কে, কোথায়, কী কিনেছে"।
 *
 * তাই পাতাটা মুছিনি, শুধু সারির বোতামটা modal খোলে। পাতাটায় এখনো
 * সরাসরি URL দিয়ে যাওয়া যায়, আর modal-এর নিচে একটা লিঙ্কও আছে —
 * নাহলে rider assign করার একমাত্র পথটাই হারিয়ে যেত।
 */
export default function OrderViewModal({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderViewData;
}) {
  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId={`order-view-${order.id}`}
      title="View Order"
      footer={
        /**
         * Figma-র পাদটীকা: বাঁয়ে কমলা বিন্দু + মাধ্যম, ডানে মোট।
         *
         * ⚠️ ModalShell-এর footer কার্ডের সরাসরি সন্তান (children-এর
         * বাইরে), তাই উপরের রেখাটা এখানেই — children-এর শেষে দিলে
         * ওটা মোট-এর সারির উপরে না বসে ভুল জায়গায় পড়ত।
         */
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
      {/**
       * ⚠️ অর্ডার আইডিটা নকশায় নেই, কিন্তু modal খুললে পিছনের সারিটা
       * ঢাকা পড়ে যায় — অর্থাৎ "কোন অর্ডারটা দেখছি" প্রশ্নের উত্তর
       * পর্দা থেকে সরে যেত। এক লাইনের দাম দিয়ে সেটা ফেরানো হলো।
       */}
      <p className="-mt-2 font-sora text-[13px] leading-none text-black/50">
        {order.reference}
      </p>

      {/* Figma: cream বাক্স, padding 16, radius 20 — ভেতরে তিনটে ঘর। */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-[20px] bg-[#F9F6F3] p-4 md:grid-cols-2">
        <div>
          <label htmlFor={`order-email-${order.id}`} className={LABEL}>
            Email Address
          </label>
          <input
            id={`order-email-${order.id}`}
            type="text"
            readOnly
            // ⚠️ dine-in অর্ডারে email নেওয়াই হয় না (schema-য় মাঠটা
            // optional), তাই ফাঁকা ঘরের বদলে একটা স্পষ্ট লেখা।
            value={order.email ?? "Not provided"}
            className={`${FIELD} bg-white`}
          />
        </div>

        <div>
          <label htmlFor={`order-phone-${order.id}`} className={LABEL}>
            Phone Number
          </label>
          <input
            id={`order-phone-${order.id}`}
            type="text"
            readOnly
            value={order.phone}
            className={`${FIELD} bg-white`}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor={`order-address-${order.id}`} className={LABEL}>
            Address
          </label>
          <input
            id={`order-address-${order.id}`}
            type="text"
            readOnly
            value={order.address ?? "Dine-in — no delivery address"}
            className={`${FIELD} bg-white`}
          />
        </div>
      </div>

      {/* পদের সারিগুলো — cream, radius 20, বাঁয়ে কালো গোল নম্বর। */}
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

      {/**
       * ⚠️ এখানে একটা লিঙ্ক ছিল — "Open full order page →", যেটা
       * `/admin/orders/<id>`-এ নিয়ে যেত। সরানো হয়েছে (নকশায় নেই)।
       *
       * ফলে ঐ পাতাটায় এখন **কোনো বোতাম বা লিঙ্ক দিয়ে পৌঁছনো যায় না**,
       * শুধু URL হাতে লিখে। route-টা কাজ করে, আর ওখানেই কেবল আছে:
       * rider assign করা, subtotal/VAT-এর ভাঙচুর, আর refund। ওই
       * তিনটে কাজ দরকার হলে এখানে বা সারিতে একটা পথ ফিরিয়ে আনতে হবে।
       */}
    </ModalShell>
  );
}
