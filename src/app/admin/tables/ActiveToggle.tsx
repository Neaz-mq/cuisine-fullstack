"use client";

import { useState, useTransition } from "react";

export default function ActiveToggle({
  tableId,
  isActive,
}: {
  tableId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) setActive(!next);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
        active
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}