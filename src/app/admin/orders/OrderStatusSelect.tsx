"use client";

import { useState, useTransition } from "react";

const STATUSES = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

// The backend enum value stays OUT_FOR_DELIVERY for both order types
// (deliberately not adding a separate DINE_IN status — see project notes),
// but a dine-in order was never "out for delivery", so it displays as
// "Ready to Serve" instead.
function labelFor(status: string, orderType?: "DELIVERY" | "DINE_IN") {
  if (status === "OUT_FOR_DELIVERY" && orderType === "DINE_IN") return "READY TO SERVE";
  return status.replace(/_/g, " ");
}

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

  async function handleChange(newStatus: string) {
    const previous = status;
    setStatus(newStatus); // optimistic update
    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) setStatus(previous); // revert on failure
    });
  }

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs font-semibold px-2 py-1 rounded-full border border-gray-300 disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {labelFor(s, orderType)}
        </option>
      ))}
    </select>
  );
}
