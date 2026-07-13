"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function DeactivateStaffButton({
  userId,
  isActive,
  name,
}: {
  userId: string;
  isActive: boolean;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const next = !isActive;
    const verb = next ? "reactivate" : "deactivate";
    if (!confirm(`${verb[0].toUpperCase() + verb.slice(1)} ${name}?`)) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/staff/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed to ${verb} staff member`);
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`text-sm font-medium disabled:opacity-50 ${
          isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"
        }`}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      {error && <span className="text-xs text-red-500 mt-1 max-w-[160px] text-right">{error}</span>}
    </div>
  );
}
