"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function DeleteTableButton({
  tableId,
  tableLabel,
}: {
  tableId: string;
  tableLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete table "${tableLabel}"? This cannot be undone.`)) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete table");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
      >
        Delete
      </button>
      {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
    </div>
  );
}