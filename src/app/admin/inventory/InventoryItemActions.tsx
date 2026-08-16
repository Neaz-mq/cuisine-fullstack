"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function InventoryItemActions({
  itemId,
  costPerUnit,
  currency,
  isActive,
}: {
  itemId: string;
  costPerUnit: number;
  /** Passed down from the server page rather than fetched here — no extra
   *  request, and no moment where the prompt shows the wrong currency. */
  currency: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) setActive(!next);
    });
  }

  function handleEditCost() {
    const input = window.prompt(
      `Current cost per unit is ${currency} ${costPerUnit.toFixed(4)}. Enter the new cost per unit:`,
      String(costPerUnit)
    );
    if (input === null) return;

    const next = Number(input);
    if (!Number.isFinite(next) || next < 0) {
      window.alert("Enter a valid non-negative number.");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/admin/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costPerUnit: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data?.error ?? "Failed to update cost per unit");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleEditCost}
        disabled={isPending}
        className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Edit Cost
      </button>
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
    </div>
  );
}