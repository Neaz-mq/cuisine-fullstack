"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const UNIT_OPTIONS = [
  { value: "GRAM", label: "Grams (g)" },
  { value: "KILOGRAM", label: "Kilograms (kg)" },
  { value: "MILLILITER", label: "Milliliters (ml)" },
  { value: "LITER", label: "Liters (L)" },
  { value: "PIECE", label: "Pieces (pc)" },
];


/**
 * The restaurant's configured currency, for labelling amount inputs.
 *
 * A client component can't read RestaurantSettings directly (that would
 * drag Prisma into the browser bundle), so it comes over /api/settings.
 * Empty string until it arrives — the label just reads "Amount" for a
 * moment rather than flashing a wrong currency.
 */
function useCurrency() {
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.currency && setCurrency(data.currency))
      .catch(() => {
        // Label falls back to no currency — nothing else breaks.
      });
  }, []);

  return currency;
}

export default function AddInventoryItemForm() {
  const currency = useCurrency();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("GRAM");
  const [currentStock, setCurrentStock] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setUnit("GRAM");
    setCurrentStock("");
    setReorderThreshold("");
    setCostPerUnit("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          unit,
          currentStock: currentStock ? Number(currentStock) : 0,
          reorderThreshold: reorderThreshold ? Number(reorderThreshold) : 0,
          costPerUnit: costPerUnit ? Number(costPerUnit) : 0,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Failed to add inventory item");
        return;
      }

      resetForm();
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
      >
        + Add Inventory Item
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-md p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="e.g. Chicken Breast"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cost per unit{currency ? ` (${currency})` : ""}
          </label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="0.0080"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Starting stock (optional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reorder threshold (optional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={reorderThreshold}
            onChange={(e) => setReorderThreshold(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add Item"}
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsOpen(false);
          }}
          className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}