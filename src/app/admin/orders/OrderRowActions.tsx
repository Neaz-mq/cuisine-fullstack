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
 * দুটো বোতামের **অভিন্ন** class — যেগুলো breakpoint-ভেদে বদলায়।
 * আলাদা করে রাখা হয়েছে কারণ দুটো বোতামে হুবহু একই প্রস্থ-নিয়ম চলতে
 * হবে; একটায় বদলে অন্যটায় ভুলে গেলে ঠিক আগের bug-টাই ফিরে আসে।
 *
 * ── প্রস্থের তিনটে স্তর, তিনটে আলাদা কারণে ──────────────────────────
 *
 *   < 400px      w-full, উপর-নিচে সাজানো
 *   400px – xl   লেখার মাপে (w-auto + px-4), প্রয়োজনে wrap
 *   xl+          স্থির প্রস্থ (নিচে দেখুন)
 */
const BUTTON_BASE =
  "flex h-9 w-full items-center justify-center gap-1.5 rounded-full " +
  "font-sora text-[13px] font-medium leading-none " +
  "min-[400px]:w-auto min-[400px]:px-4 xl:shrink-0 xl:px-2";

/**
 * সারির দ্বিতীয় বোতামটা কী করবে — অর্ডারের অবস্থা আর ধরন দেখে।
 *
 * ⚠️ বোতামটা **সবসময় থাকে**, শুধু লেখা আর কাজ বদলায়। শেষ ধাপের আগে যে ধাপে
 * admin-এর কিছু করার নেই (রান্নাঘর বা rider-এর অপেক্ষা), সেখানে বোতামটা
 * থাকে কিন্তু বন্ধ ("locked") — সরিয়ে দিলে সারিগুলোর ডান প্রান্ত এক সারিতে
 * থাকত না, আর পরের ধাপটা কী সেটাও চোখে পড়ত না।
 *
 * ── ধাপগুলো (DELIVERY অর্ডার) ───────────────────────────────────────
 *
 *   PLACED            → "Move to Kitchen"    → PREPARING  (status নিজে বদলায়)
 *   PREPARING         → "Ready to Delivery"  বন্ধ — রান্নাঘরের "Ready"-র অপেক্ষা
 *   READY             → "Ready to Delivery"  → modal → rider assign → OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY  → "Mark Delivered"     বন্ধ — rider নিজের panel থেকে করবেন
 *   DELIVERED         → নিষ্ক্রিয় "Delivered"
 *   CANCELLED         → নিষ্ক্রিয় "Cancelled"
 *
 * ── dine-in অর্ডার (rider নেই) ───────────────────────────────────────
 *
 *   PLACED    → "Move to Kitchen" → PREPARING
 *   PREPARING → "Mark Served" বন্ধ — রান্নাঘরের "Ready"-র অপেক্ষা
 *   READY     → "Mark Served"  → DELIVERED
 *
 * ⚠️ status এখানে হাতে বদলানোর dropdown নেই। status চলে ধাপে ধাপে, ঠিক যার
 * যার কাজের জায়গা থেকে: admin (Move to Kitchen) → রান্নাঘর (Ready) → admin
 * (rider assign) → rider (Delivered)। ধাপগুলো `lib/order-state-machine.ts`-এর
 * ALLOWED_TRANSITIONS-এর হুবহু অনুসরণ।
 *
 * ⚠️ পুরনো ডেটার জন্য: migration-এর আগের dine-in অর্ডার OUT_FOR_DELIVERY-তে
 * থাকতে পারে (তখন ওটাই "পরিবেশনের জন্য তৈরি" ছিল) — সেটাকেও "Mark Served"
 * দিয়ে শেষ করা যায়।
 */
type NextStep =
  | { kind: "patch"; label: string; status: string; toast: string }
  | { kind: "dispatch"; label: string }
  | { kind: "locked"; label: string; reason: string }
  | { kind: "done"; label: string };

function nextStep(status: string, orderType: "DELIVERY" | "DINE_IN"): NextStep {
  const dineIn = orderType === "DINE_IN";
  const serve: NextStep = {
    kind: "patch",
    label: "Mark Served",
    status: "DELIVERED",
    toast: "Marked as served.",
  };

  switch (status) {
    case "PLACED":
      return {
        kind: "patch",
        label: "Move to Kitchen",
        status: "PREPARING",
        toast: "Moved to kitchen.",
      };

    case "PREPARING":
      return {
        kind: "locked",
        label: dineIn ? "Mark Served" : "Ready to Delivery",
        reason: "Waiting for the kitchen to mark this order Ready.",
      };

    case "READY":
      /**
       * ⚠️ delivery অর্ডারে সরাসরি PATCH করা হয় না — modal খোলে, আর
       * সেখানে rider বাছতে হয়। কারণটা কারিগরি: `assign-rider` route
       * নিজেই অর্ডারটাকে OUT_FOR_DELIVERY-তে নিয়ে যায়, সাথে ঠিকানা
       * geocode করে আর payment যাচাই করে। শুধু status বদলে দিলে
       * অর্ডারটা "পথে" দেখাত অথচ কোনো rider-ই জানত না।
       */
      return dineIn ? serve : { kind: "dispatch", label: "Ready to Delivery" };

    case "OUT_FOR_DELIVERY":
      return dineIn
        ? serve
        : {
            kind: "locked",
            label: "Mark Delivered",
            reason: "The rider marks this order delivered from the rider panel.",
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
     * ⚠️ স্থির প্রস্থ (১০৪ + ১৫০) এখন **কেবল `xl`-এ**, সব মাপে নয়।
     *
     * কেন স্থির: `xl`-এ সারিটা টেবিলের মতো এক লাইনে বসে, আর দ্বিতীয়
     * বোতামের লেখা সারি-ভেদে বদলায় ("Move to Kitchen", "Ready to
     * Delivery", "Mark Delivered", "Cancelled")। প্রস্থ লেখার হাতে
     * ছাড়লে প্রতিটা সারিতে জোড়াটার বাঁ কিনারা অন্য জায়গায় পড়ত, আর
     * তালিকাটা টেবিল নয়, এলোমেলো কার্ড দেখাত।
     *
     * ১৫০ = সবচেয়ে লম্বা লেখা "Ready to Delivery" (১৩px Sora-তে
     * ~১১৯px) + spinner-এর জায়গা (~২০px), সামান্য হাওয়া সহ। নতুন
     * কোনো লেখা যোগ করলে এই হিসাবটা মিলিয়ে নিতে হবে।
     *
     * ⚠️ কেন `xl`-এর নিচে স্থির নয় — এটাই ছিল bug-টা। ওখানে সারিটা
     * column, তাই "ডান কিনারা মেলানো"র যুক্তিটাই খাটে না, অথচ
     * ১০৪ + ৮ + ১৫০ = ২৬২px `shrink-0` হয়ে বসে থাকত। ৩২০px পর্দায়
     * card-এর ভেতরে জায়গা থাকে ~২২৪px (shell padding + card `p-4` +
     * row `p-4` বাদ দিয়ে) — অর্থাৎ ৩৮px বেশি, আর `shrink-0` বলে
     * চাপতেও পারত না। ফলে gradient বোতামটা কার্ডের গোল কিনারা ছাড়িয়ে
     * বাইরে বেরিয়ে যেত।
     *
     * তিনটে স্তর:
     *   < 400px      উপর-নিচে, দুটোই পুরো চওড়া — কাটা পড়ে না, আর
     *                সরু পর্দায় tap target-ও বড় থাকে
     *   400px – xl   পাশাপাশি, লেখার মাপে; `flex-wrap` জাল হিসেবে
     *                থাকে যাতে ভবিষ্যতে লম্বা লেখা এলেও উপচে না পড়ে
     *   xl+          আগের স্থির প্রস্থ, ডানে সারিবদ্ধ
     */
    <div className="flex w-full min-w-0 flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center xl:w-auto xl:flex-nowrap xl:shrink-0">
      <button
        type="button"
        onClick={() => setViewing(true)}
        className={`${BUTTON_BASE} whitespace-nowrap border border-black/15 bg-white text-black transition-colors hover:border-black xl:w-[104px] ${FOCUS_RING}`}
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
        disabled={isPending || step.kind === "done" || step.kind === "locked"}
        title={step.kind === "locked" ? step.reason : undefined}
        className={`${BUTTON_BASE} transition-opacity disabled:cursor-not-allowed xl:w-[150px] ${
          step.kind === "done" || step.kind === "locked"
            ? "bg-black/[0.06] text-black/40"
            : "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90 disabled:opacity-50"
        } ${FOCUS_RING}`}
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
        {/**
         * ⚠️ `truncate` বোতামের উপরে নয়, ভেতরের span-এ।
         *
         * বোতামটা নিজে `display:flex` — আর flex container-এ
         * `text-overflow: ellipsis` কাজই করে না, তাই আগের
         * `truncate` class-টা কার্যত নিষ্ক্রিয় ছিল। `min-w-0`
         * ছাড়া flex item নিজের content-এর নিচে নামতে চায় না, তাই
         * সেটাও লাগে।
         */}
        <span className="min-w-0 truncate">{step.label}</span>
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
