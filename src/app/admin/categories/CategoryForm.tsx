"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CategoryForm({
  initialData,
}: {
  initialData?: { id: string; name: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialData?.name ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a category name.");
      return;
    }

    startTransition(async () => {
      const res = await fetch(
        initialData ? `/api/admin/categories/${initialData.id}` : "/api/admin/categories",
        {
          method: initialData ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }
      );

      if (res.ok) {
        router.push("/admin/categories");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#FF4C15] text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving..." : initialData ? "Save Changes" : "Create Category"}
      </button>
    </form>
  );
}