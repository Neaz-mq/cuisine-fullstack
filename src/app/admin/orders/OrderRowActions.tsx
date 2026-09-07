"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import OrderViewModal, { type OrderViewData } from "./OrderViewModal";
import OrderDeliveryModal from "./OrderDeliveryModal";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * সারির দ্বিতীয় বোতামটা কী করবে — অর্ডারের অবস্থা আর ধরন দেখে।
 *
 * ⚠️ বোতামটা **সবসময় থাকে**, শুধু লেখা আর কাজ বদলায়। আগে সেটা কেবল
 * PLACED অর্ডারে দেখাত, ফলে সারিগুলোর ডান প্রান্ত এক সারিতে থাকত না,
 * আর সবচেয়ে বড় কথা — রান্না শেষ হওয়ার পরের ধাপগুলোয় (rider পাঠানো,
 * delivered চিহ্নিত করা) তালিকা থেকে পৌঁছনোরই কোনো পথ ছিল না।
 *
 * ── ধাপগুলো ─────────────────────────────────────────────────────────
 *
 *   PLACED            → "Move to Kitchen"   → PREPARING
 *   PREPARING (দোকান) → "Mark Ready"        → OUT_FOR_DELIVERY
 *   PREPARING (বাড়ি)  → "Ready to Delivery" → modal → rider assign
 *   OUT_FOR_DELIVERY  → "Mark Delivered" / "Mark Served" → DELIVERED
 *   DELIVERED         → নিষ্ক্রিয় "Delivered"
 *   CANCELLED         → নিষ্ক্রিয় "Cancelled"
 *
 * ধাপগুলো `lib/order-state-machine.ts`-এর ALLOWED_TRANSITIONS-এর হুবহু
 * অনুসরণ — এখানে নতুন কোনো নিয়ম বানানো হয়নি, কেবল প্রতিটা অবস্থার
 * **সবচেয়ে স্বাভাবিক পরের ধাপটা** বোতামে তোলা হয়েছে। অন্য ধাপগুলো
 * (যেমন বাতিল করা) পাশের status dropdown-এ আগের মতোই আছে।
 *
 * ⚠️ dine-in অর্ডারে `OUT_FOR_DELIVERY` মানে "পরিবেশনের জন্য তৈরি" —
 * enum-এ আলাদা কোনো অবস্থা নেই, আর সেই সিদ্ধান্তটা পুরনো। তাই লেখাটা
 * বদলায়, মানটা নয়।
 */
type NextStep =
  | { kind: "patch"; label: string; status: string; toast: string }
  | { kind: "dispatch"; label: string }
  | { kind: "done"; label: string };

function nextStep(status: string, orderType: "DELIVERY" | "DINE_IN"): NextStep {
  const dineIn = orderType === "DINE_IN";

  switch (status) {
    case "PLACED":
      return {
        kind: "patch",
        label: "Move to Kitchen",
        status: "PREPARING",
        toast: "Moved to kitchen.",
      };

    case "PREPARING":
      /**
       * ⚠️ delivery অর্ডারে সরাসরি PATCH করা হয় না — modal খোলে, আর
       * সেখানে rider বাছতে হয়। কারণটা কারিগরি: `assign-rider` route
       * নিজেই অর্ডারটাকে OUT_FOR_DELIVERY-তে নিয়ে যায়, সাথে ঠিকানা
       * geocode করে আর payment যাচাই করে। শুধু status বদলে দিলে
       * অর্ডারটা "পথে" দেখাত অথচ কোনো rider-ই জানত না।
       */
      return dineIn
        ? {
            kind: "patch",
            label: "Mark Ready",
            status: "OUT_FOR_DELIVERY",
            toast: "Ready to serve.",
          }
        : { kind: "dispatch", label: "Ready to Delivery" };

    case "OUT_FOR_DELIVERY":
      return {
        kind: "patch",
        label: dineIn ? "Mark Served" : "Mark Delivered",
        status: "DELIVERED",
        toast: dineIn ? "Marked as served." : "Marked as delivered.",
      };

    case "CANCELLED":
      return { kind: "done", label: "Cancelled" };

    default:
      return { kind: "done", label: dineIn ? "Served" : "Delivered" };
  }
}

/**
 * src/app/admin/orders/OrderRowActions.tsx
 *
 * Figma — প্রতিটা সারির ডান প্রান্তে দুটো বোতাম: "View Order" (সাদা,
 * ১px রেখা, radius 100) আর একটা gradient বোতাম, যেটার লেখা অর্ডারের
 * অবস্থার সাথে বদলায়।
 */
export default function OrderRowActions({
  orderId,
  status,
  orderType,
  order,
}: {
  orderId: string;
  status: string;
  orderType: "DELIVERY" | "DINE_IN";
  /** দুটো modal-এই দেখানোর জন্য — server-এ আগেই সাজানো। */
  order: OrderViewData;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [isPending, startTransition] = useTransition();

  const step = nextStep(status, orderType);

  const advance = (nextStatus: string, message: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't update this order.");
        }
        router.refresh();
        toast.success(message);
      } catch (error) {
        /**
         * ⚠️ আশাবাদী বদল নয় — server-এর উত্তর আসার পরেই তালিকা নতুন
         * করে আসে। এগুলো সত্যিকারের কাজ (রান্নাঘরে পাঠানো, delivered
         * চিহ্নিত করা); "হয়ে গেছে" দেখিয়ে আসলে না হওয়াটা এখানে
         * সবচেয়ে খারাপ ফল। route নিজেও transition যাচাই করে, তাই
         * অবৈধ ধাপে ওখান থেকেই বার্তা আসে।
         */
        toast.error(error instanceof Error ? error.message : "Couldn't update this order.");
      }
    });
  };

  return (
    /**
     * ⚠️ দুটো বোতামেরই প্রস্থ **স্থির** (১০৪ আর ১৫০px), লেখার মাপে
     * নয়।
     *
     * দ্বিতীয় বোতামের লেখা সারি-ভেদে বদলায় ("Move to Kitchen",
     * "Ready to Delivery", "Mark Delivered", "Cancelled") — প্রস্থ
     * লেখার হাতে ছাড়লে প্রতিটা সারিতে জোড়াটার বাঁ কিনারা অন্য
     * জায়গায় পড়ত, আর তালিকাটা টেবিল নয়, এলোমেলো কার্ড দেখাত।
     * screenshot-এ ঠিক সেটাই দেখা যাচ্ছিল।
     *
     * ১৫০ = সবচেয়ে লম্বা লেখা "Ready to Delivery" (১৩px Sora-তে
     * ~১১৯px) + spinner-এর জায়গা (~২০px), সামান্য হাওয়া সহ। নতুন
     * কোনো লেখা যোগ করলে এই হিসাবটা মিলিয়ে নিতে হবে, নাহলে
     * `truncate` ওটা কেটে দেবে।
     */
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setViewing(true)}
        className={`flex h-9 w-[104px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/15 bg-white font-sora text-[13px] font-medium leading-none text-black transition-colors hover:border-black ${FOCUS_RING}`}
      >
        View Order
      </button>

      {/**
       * ⚠️ শেষ অবস্থায় (DELIVERED/CANCELLED) বোতামটা থাকে, কিন্তু
       * নিষ্ক্রিয় — সরিয়ে দিলে ওই সারিগুলোর ডান প্রান্ত বাকিদের সাথে
       * মিলত না, আর "এই অর্ডারে আর কিছু করার নেই" কথাটাও পর্দায়
       * থাকত না।
       */}
      <button
        type="button"
        onClick={() => {
          if (step.kind === "dispatch") setDispatching(true);
          else if (step.kind === "patch") advance(step.status, step.toast);
        }}
        disabled={isPending || step.kind === "done"}
        className={`flex h-9 w-[150px] shrink-0 items-center justify-center gap-1.5 truncate rounded-full px-2 font-sora text-[13px] font-medium leading-none transition-opacity disabled:cursor-not-allowed ${
          step.kind === "done"
            ? "bg-black/[0.06] text-black/40"
            : "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90 disabled:opacity-50"
        } ${FOCUS_RING}`}
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {step.label}
      </button>

      <OrderViewModal open={viewing} onClose={() => setViewing(false)} order={order} />

      <OrderDeliveryModal
        open={dispatching}
        onClose={() => setDispatching(false)}
        orderId={orderId}
        order={order}
      />
    </div>
  );
}
