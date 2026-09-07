"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUS_BADGE, orderStatusLabel } from "@/lib/order-status-filter";

const STATUSES = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

/**
 * ⚠️ লেখা আর রঙ দুটোই এখন `lib/order-status-filter.ts` থেকে — তালিকার
 * ব্যাজ, ছাঁকনির pill আর এই dropdown, তিনটেই একই উৎস ব্যবহার করে।
 * আগে "READY TO SERVE" নিয়মটা কেবল এই ফাইলে ছিল, তাই তালিকার ব্যাজ
 * dine-in অর্ডারেও "OUT FOR DELIVERY" দেখাত।
 */

export default function OrderStatusSelect({
  orderId,
  currentStatus,
  orderType,
}: {
  orderId: string;
  currentStatus: string;
  orderType?: "DELIVERY" | "DINE_IN";
}) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // currentStatus only matters as the INITIAL value to useState above —
  // React doesn't re-run that initializer on a prop change, so without
  // resyncing, a status change made elsewhere (e.g. assign-rider flipping
  // the order to OUT_FOR_DELIVERY, followed by AssignRiderPanel's
  // router.refresh()) would silently NOT show up here: the server-rendered
  // prop updates, but this dropdown keeps rendering its stale first-mount
  // value until the user manually changes it.
  //
  // This used to be a useEffect that called setStatus(currentStatus).
  // React's own docs (and eslint's react-hooks/set-state-in-effect rule)
  // flag that pattern: an effect-based sync renders the STALE value once,
  // then the effect fires, then a second render shows the correct value —
  // a visible flicker plus a wasted render. Calling setState directly
  // during render instead (comparing against the last-seen prop) corrects
  // it within the same render pass, before anything is painted. React
  // explicitly supports this pattern; see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevCurrentStatus, setPrevCurrentStatus] = useState(currentStatus);
  if (currentStatus !== prevCurrentStatus) {
    setPrevCurrentStatus(currentStatus);
    setStatus(currentStatus);
  }

  async function handleChange(newStatus: string) {
    const previous = status;
    setStatus(newStatus); // optimistic update
    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setStatus(previous); // revert on failure
      } else {
        // Re-fetch the server-rendered parts of this page (order count in
        // the header, and — when a status filter is active — whether this
        // order still belongs in the filtered list at all) so they don't
        // stay stale until a manual browser refresh. This dropdown's own
        // `status` state is already correct from the optimistic update
        // above, so no flicker here.
        router.refresh();
      }
    });
  }

  return (
    /**
     * Figma-র ব্যাজটাই, কিন্তু এটা একটা `<select>` — অর্থাৎ দেখায়ও,
     * বদলায়ও।
     *
     * ⚠️ নকশায় Status কেবল একটা রঙিন ব্যাজ, আর ডানে "Move to Kitchen"।
     * কিন্তু ওই একটামাত্র বোতাম দিয়ে অর্ডার কখনো DELIVERED বা CANCELLED
     * করা যেত না — অর্থাৎ পুরনো পাতার একটা কাজ নীরবে হারিয়ে যেত। তাই
     * ব্যাজটাই dropdown, দেখতে ব্যাজের মতোই।
     *
     * ⚠️ native `<select>` রাখা হলো (FilterMenu নয়), কারণ এটা ছাঁকনি
     * নয় — সারিটার নিজের ডেটা বদলায়। খোলা তালিকাটা browser আঁকে, কিন্তু
     * সেটা এখানে মেনে নেওয়া যায়: প্রতিটা সারিতে একটা করে custom
     * dropdown বসালে ১০টা সারিতে ১০টা floating panel-এর z-index আর
     * outside-click সামলাতে হতো, অথচ লাভ কেবল দেখার।
     */
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Order status"
      className={`h-8 cursor-pointer appearance-none rounded-full px-3 text-center font-sora text-[12px] font-medium leading-none outline-none transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
        ORDER_STATUS_BADGE[status]?.className ?? "bg-black/5 text-black"
      }`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-black">
          {orderStatusLabel(s, orderType)}
        </option>
      ))}
    </select>
  );
}
