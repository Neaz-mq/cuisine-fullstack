"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function GiftCardActions({
  giftCardId,
  isActive,
  balance,
}: {
  giftCardId: string;
  isActive: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/gift-cards/${giftCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) setActive(!next);
    });
  }

  function handleAdjust() {
    const input = window.prompt(
      `Current balance is $${balance.toFixed(2)}. Enter an amount to add (e.g. 10) or deduct (e.g. -5):`
    );
    if (!input) return;

    const amount = Number(input);
    if (!Number.isFinite(amount) || amount === 0) {
      window.alert("Enter a non-zero number.");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/admin/gift-cards/${giftCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data?.error ?? "Failed to adjust balance");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleAdjust}
        disabled={isPending}
        className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Adjust
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
