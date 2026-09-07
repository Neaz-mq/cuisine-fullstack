"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * src/app/admin/orders/OrderRowActions.tsx
 *
 * Figma — প্রতিটা সারির ডান প্রান্তে দুটো বোতাম: "View Order" (সাদা,
 * ১px রেখা, radius 100) আর "Move to Kitchen" (gradient, radius 100)।
 *
 * ── "Move to Kitchen" আসলে কী করে ───────────────────────────────────
 *
 * অর্ডারটার অবস্থা `PREPARING`-এ নিয়ে যায় — অর্থাৎ রান্নাঘরের পর্দায়
 * (`/admin/kitchen`) সেটা ভেসে ওঠে। নকশায় বোতামটা প্রতিটা সারিতেই
 * আঁকা, কিন্তু এখানে সেটা **শর্তসাপেক্ষ**:
 *
 * ⚠️ ইতিমধ্যেই যে অর্ডার রান্নাঘরে গেছে, পথে আছে, পৌঁছে গেছে বা বাতিল
 * হয়েছে — তার জন্য বোতামটা দেখানো হয় না। দেখালে দুটো ফল হতো: হয়
 * ডেলিভারি হয়ে যাওয়া অর্ডার আবার "রান্না হচ্ছে" হয়ে যেত, নয় বোতামটা
 * চেপে কিছুই হতো না। দুটোই খারাপ, আর প্রথমটা তো সত্যিকারের ক্ষতি।
 */
export default function OrderRowActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // কেবল সদ্য বসা অর্ডারই রান্নাঘরে পাঠানোর মতো।
  const canMoveToKitchen = status === "PLACED";

  const moveToKitchen = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PREPARING" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't move this order to the kitchen.");
        }
        router.refresh();
        toast.success("Moved to kitchen.");
      } catch (error) {
        // ⚠️ আশাবাদী বদল নয় — server-এর উত্তর আসার পরেই তালিকা নতুন করে
        // আসে। রান্নাঘরে পাঠানো একটা সত্যিকারের কাজ; "পাঠানো হয়েছে"
        // দেখিয়ে আসলে না পাঠানোটা এখানে সবচেয়ে খারাপ ফল।
        toast.error(
          error instanceof Error ? error.message : "Couldn't move this order to the kitchen."
        );
      }
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={`/admin/orders/${orderId}`}
        className={`flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/15 bg-white px-4 font-sora text-[13px] font-medium leading-none text-black transition-colors hover:border-black ${FOCUS_RING}`}
      >
        View Order
      </Link>

      {canMoveToKitchen && (
        <button
          type="button"
          onClick={moveToKitchen}
          disabled={isPending}
          className={`flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-medium leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${FOCUS_RING}`}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Move to Kitchen
        </button>
      )}
    </div>
  );
}
