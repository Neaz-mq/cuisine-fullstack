"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import FilterMenu from "@/components/admin/FilterMenu";
import type { OrderStatus } from "@/generated/prisma/client";
import { nextStatuses } from "@/lib/order-state-machine";
import { ORDER_STATUS_BADGE, orderStatusLabel } from "@/lib/order-status-filter";

/**
 * অর্ডারের নিজের পাতার (/admin/orders/[id]) Status ব্যাজ — **শুধু বাতিল করার জন্য**।
 *
 * ⚠️ Orders list-এ এখন কোনো dropdown নেই (দেখুন OrderStatusBadge) — status
 * ধাপে ধাপে নিজে বদলায়। তাই এখানেও আগের মতো "যেকোনো পরের status বেছে নাও"
 * নেই; তালিকায় থাকে কেবল বর্তমান অবস্থা আর "Cancelled", এবং সেটাও কেবল
 * তখনই যখন অর্ডারটা বাতিল করা যায় (lib/order-state-machine.ts)।
 *
 * বাতিল করার পথটা রাখা হয়েছে কারণ এটাই একমাত্র জায়গা যেখান থেকে admin
 * অর্ডার বাতিল করে — stock/coupon/gift card/card-payment ফেরত আসে cancelOrder()
 * দিয়ে (PATCH /api/orders/[id])।
 *
 * Delivered / Cancelled শেষ অবস্থা — সেখান থেকে কোথাও যাওয়া যায় না, তাই
 * শুধু ব্যাজ, dropdown নয়।
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

  // Server থেকে নতুন status এলে (অন্য জায়গা থেকে বদলালে) সেটাই দেখানো —
  // effect ছাড়া, render-এর মধ্যেই; React-এর সুপারিশ করা পদ্ধতি।
  const [prevCurrentStatus, setPrevCurrentStatus] = useState(currentStatus);
  if (currentStatus !== prevCurrentStatus) {
    setPrevCurrentStatus(currentStatus);
    setStatus(currentStatus);
  }

  const badgeClass = ORDER_STATUS_BADGE[status]?.className ?? "bg-black/5 text-black";
  const canCancel = nextStatuses(status as OrderStatus).includes("CANCELLED");

  if (!canCancel) {
    return (
      <span
        className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] font-medium leading-none ${badgeClass}`}
      >
        {orderStatusLabel(status, orderType)}
      </span>
    );
  }

  const options = [status, "CANCELLED"].map((value) => ({
    value,
    label: orderStatusLabel(value, orderType),
  }));

  function handleChange(newStatus: string) {
    if (newStatus === status) return;
    const previous = status;
    setStatus(newStatus); // optimistic
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Couldn't update this order.");
        }
        toast.success(`Order marked as ${orderStatusLabel(newStatus, orderType)}`);
        // Header-এর সংখ্যা আর ছাঁকা তালিকা যেন বাসি না থাকে।
        router.refresh();
      } catch (error) {
        setStatus(previous);
        toast.error(error instanceof Error ? error.message : "Couldn't update this order.");
      }
    });
  }

  return (
    <FilterMenu
      value={status}
      options={options}
      onSelect={handleChange}
      ariaLabel="Order status"
      menuPositionClassName="left-0"
      // self-start: flex parent-এর ভেতরে টেনে লম্বা না হয় — নাহলে
      // popup-টা ব্যাজের নিচে না খুলে সারির একদম তলায় খুলত।
      className={`self-start ${isPending ? "pointer-events-none opacity-50" : ""}`}
      triggerClassName={`h-8 px-3 text-[12px] font-medium ${badgeClass}`}
    />
  );
}
