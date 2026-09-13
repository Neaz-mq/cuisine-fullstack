"use client";

import { useState, useTransition } from "react";
import { toast } from "react-toastify";
import FilterMenu from "@/components/admin/FilterMenu";
import { RESERVATION_BADGE } from "@/lib/reservation-filters";

const STATUSES = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

type Status = (typeof STATUSES)[number];

const OPTIONS = STATUSES.map((value) => ({
  value,
  label: RESERVATION_BADGE[value]?.label ?? value.replace(/_/g, " "),
}));

/**
 * সারির ডান পাশের অবস্থার ব্যাজ — দেখতে ব্যাজ, কাজে dropdown।
 *
 * ⚠️ আগে এটা একটা native `<select>` ছিল যার পটভূমিতে ব্যাজের রং বসানো
 * থাকত। কাজ করত, কিন্তু browser ওই রংটা option তালিকাতেও টেনে নিত —
 * ফলে খোলা তালিকাটা সবুজের উপর সবুজ লেখা হয়ে যেত, আর বাকি সিস্টেমের
 * সাদা dropdown-এর সাথে একেবারেই মিলত না।
 *
 * এখন প্রজেক্টের নিজের `FilterMenu` — popup-টা তাই হুবহু Overview বা
 * toolbar-এর dropdown-এর মতো, আর trigger-টা Figma-র রঙিন ব্যাজ।
 */
export default function ReservationStatusSelect({
  reservationId,
  currentStatus,
}: {
  reservationId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState<Status>(currentStatus as Status);
  const [isPending, startTransition] = useTransition();

  const badge = RESERVATION_BADGE[status] ?? {
    label: status,
    className: "bg-black/5 text-black/60",
  };

  function handleChange(next: Status) {
    if (next === status) return;

    /**
     * ⚠️ আগে থেকেই বদলে দেখানো হয় (optimistic), আর ব্যর্থ হলে ফিরিয়ে
     * আনা হয়।
     *
     * server-এর উত্তরের অপেক্ষায় বসে থাকলে ব্যস্ত সময়ে staff-কে
     * প্রতিবার এক মুহূর্ত তাকিয়ে থাকতে হতো। কিন্তু ব্যর্থতা নীরবে
     * গিলে ফেলা হয় না — আগের কোডে শুধু state ফেরত যেত, তাই staff
     * বুঝতেই পারতেন না যে বদলটা সংরক্ষিত হয়নি। এখন একটা toast-ও আসে।
     */
    const previous = status;
    setStatus(next);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/reservations/${reservationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't update this reservation.");
        }
      } catch (error) {
        setStatus(previous);
        toast.error(
          error instanceof Error ? error.message : "Couldn't update this reservation."
        );
      }
    });
  }

  return (
    <FilterMenu
      value={status}
      options={OPTIONS}
      onSelect={handleChange}
      ariaLabel="Reservation status"
      className={isPending ? "pointer-events-none opacity-50" : ""}
      triggerClassName={`h-[38px] w-full px-4 text-[13px] font-semibold xl:w-[150px] ${badge.className}`}
    />
  );
}
