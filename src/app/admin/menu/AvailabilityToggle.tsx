"use client";

import { useState, useTransition } from "react";

export default function AvailabilityToggle({
  itemId,
  isAvailable,
}: {
  itemId: string;
  isAvailable: boolean;
}) {
  const [available, setAvailable] = useState(isAvailable);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !available;
    setAvailable(next); // optimistic
    startTransition(async () => {
      const res = await fetch(`/api/admin/menu-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: next }),
      });
      if (!res.ok) setAvailable(!next); // revert on failure
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
        available
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      }`}
    >
      {available ? "Available" : "Unavailable"}
    </button>
  );
}