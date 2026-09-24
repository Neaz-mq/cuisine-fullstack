"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import FilterMenu from "@/components/admin/FilterMenu";
import type { OrderStatus } from "@/generated/prisma/client";
import { nextStatuses } from "@/lib/order-state-machine";
import { ORDER_STATUS_BADGE, orderStatusLabel } from "@/lib/order-status-filter";

/**
 * সারির Status ব্যাজ — দেখায়ও, বদলায়ও।
 *
 * ⚠️ আগে এটা native `<select>` ছিল: খোলা তালিকাটা browser আঁকত (নীল
 * highlight, চৌকো কোণা), বাকি সিস্টেমের কোনো dropdown-এর সাথে মিলত না।
 * এখন reservation-এর status-এর মতোই FilterMenu — একই সাদা popup।
 *
 * ⚠️ তালিকায় শুধু **যেখানে যাওয়া যায়** সেগুলো থাকে
 * (lib/order-state-machine.ts)। আগে পাঁচটাই দেখাত, আর "Order Place"
 * থেকে সরাসরি "Delivered" বাছলে server সেটা ঠিকভাবেই আটকাত (রান্না না
 * হওয়া অর্ডার delivered হতে পারে না, আর Preparing-এ গেলেই stock কাটে)
 * — কিন্তু ভুলটা চেপে যাওয়া হতো, ব্যাজ চুপচাপ আগের অবস্থায় ফিরে যেত।
 * এখন অচল বিকল্প দেখানোই হয় না, আর অন্য কোনো কারণে ব্যর্থ হলে server-এর
 * বার্তাটা toast-এ আসে।
 *
 * Delivered / Cancelled শেষ অবস্থা — সেখান থেকে কোথাও যাওয়া যায় না,
 * তাই শুধু ব্যাজ, dropdown নয়।
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
  const next = nextStatuses(status as OrderStatus);

  if (next.length === 0) {
    return (
      <span
        className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] font-medium leading-none ${badgeClass}`}
      >
        {orderStatusLabel(status, orderType)}
      </span>
    );
  }

  const options = [status, ...next].map((value) => ({
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
