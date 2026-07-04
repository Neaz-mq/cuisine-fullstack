"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function DeleteCategoryButton({
  categoryId,
  categoryName,
  itemCount,
}: {
  categoryId: string;
  categoryName: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete category "${categoryName}"? This cannot be undone.`)) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete category");
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
      {itemCount > 0 && !error && (
        <span className="text-xs text-gray-400 mt-1">Has {itemCount} item(s)</span>
      )}
      {error && <span className="text-xs text-red-500 mt-1 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}