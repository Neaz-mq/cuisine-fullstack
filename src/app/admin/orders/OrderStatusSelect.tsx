"use client";

import { useEffect, useState, useTransition } from "react";

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

  // currentStatus only matters as the INITIAL value to useState above —
  // React doesn't re-run that initializer on a prop change, so without
  // this effect, a status change made elsewhere (e.g. assign-rider
  // flipping the order to OUT_FOR_DELIVERY, followed by
  // AssignRiderPanel's router.refresh()) would silently NOT show up here:
  // the server-rendered prop updates, but this dropdown keeps rendering
  // its stale first-mount value until the user manually changes it.
  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

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