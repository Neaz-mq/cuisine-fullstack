"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type TableFormProps = {
  initialData?: {
    id: string;
    label: string;
    capacity: number;
    isActive: boolean;
  };
};

export default function TableForm({ initialData }: TableFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(initialData?.label ?? "");
  const [capacity, setCapacity] = useState(initialData?.capacity?.toString() ?? "4");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedCapacity = parseInt(capacity, 10);
    if (!label.trim() || isNaN(parsedCapacity) || parsedCapacity < 1) {
      setError("Please enter a valid label and capacity (at least 1).");
      return;
    }

    startTransition(async () => {
      const body = {
        label: label.trim(),
        capacity: parsedCapacity,
        isActive,
      };

      const res = await fetch(
        initialData ? `/api/admin/tables/${initialData.id}` : "/api/admin/tables",
        {
          method: initialData ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        router.push("/admin/tables");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label (e.g. T-1)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-gray-300"
        />
        Active (available for reservations)
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#FF4C15] text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving..." : initialData ? "Save Changes" : "Create Table"}
      </button>
    </form>
  );
}