"use client";

import { useEffect, useState } from "react";

const UNIT_LABELS: Record<string, string> = {
  GRAM: "g",
  KILOGRAM: "kg",
  MILLILITER: "ml",
  LITER: "L",
  PIECE: "pc",
};

type InventoryOption = { id: string; name: string; unit: string };

type RecipeRow = {
  // Client-only key for React list rendering / removal — not sent to
  // the API (the PUT body only needs inventoryItemId + quantityRequired,
  // see setMenuItemRecipeSchema). Distinct from MenuItemIngredient.id.
  key: string;
  inventoryItemId: string;
  quantityRequired: string;
  // Captured from the initial /ingredients response. Used as a fallback
  // display (name + unit) when this row's ingredient is no longer in the
  // `inventoryItems` prop — i.e. it was made Inactive after this recipe
  // was saved. Without this, the <select> silently falls back to showing
  // whatever the first option happens to be, which looks like the recipe
  // uses a completely different ingredient than what's actually saved.
  savedName?: string;
  savedUnit?: string;
};

function newRow(inventoryItemId = ""): RecipeRow {
  return { key: crypto.randomUUID(), inventoryItemId, quantityRequired: "" };
}

export default function RecipeEditor({
  menuItemId,
  inventoryItems,
}: {
  menuItemId: string;
  inventoryItems: InventoryOption[];
}) {
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/menu-items/${menuItemId}/ingredients`);
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setRows(
            data.map(
              (line: {
                inventoryItem: { id: string; name: string; unit: string };
                quantityRequired: number;
              }) => ({
                key: crypto.randomUUID(),
                inventoryItemId: line.inventoryItem.id,
                quantityRequired: String(line.quantityRequired),
                savedName: line.inventoryItem.name,
                savedUnit: line.inventoryItem.unit,
              })
            )
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuItemId]);

  function updateRow(key: string, patch: Partial<RecipeRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              ...patch,
              // Once the user explicitly changes the ingredient, drop the
              // stale saved-name/unit fallback so it doesn't linger and
              // mislabel the newly picked ingredient.
              ...(patch.inventoryItemId !== undefined
                ? { savedName: undefined, savedUnit: undefined }
                : {}),
            }
          : r
      )
    );
    setSavedMessage(false);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSavedMessage(false);
  }

  function addRow() {
    setRows((prev) => [...prev, newRow(inventoryItems[0]?.id ?? "")]);
    setSavedMessage(false);
  }

  async function handleSave() {
    setError(null);

    const usedIds = new Set<string>();
    for (const row of rows) {
      if (!row.inventoryItemId) {
        setError("Every row needs an ingredient selected.");
        return;
      }
      if (usedIds.has(row.inventoryItemId)) {
        setError("Each ingredient can only appear once in a recipe.");
        return;
      }
      usedIds.add(row.inventoryItemId);

      const qty = Number(row.quantityRequired);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Every row needs a quantity greater than 0.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/menu-items/${menuItemId}/ingredients`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: rows.map((r) => ({
            inventoryItemId: r.inventoryItemId,
            quantityRequired: Number(r.quantityRequired),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to save recipe");
        return;
      }
      setSavedMessage(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading recipe…</p>;
  }

  if (inventoryItems.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No inventory items exist yet — add some under{" "}
        <a href="/admin/inventory" className="underline hover:text-gray-600">
          Inventory
        </a>{" "}
        before building a recipe here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          No recipe set — this item won&apos;t show a food cost on Insights until you add
          ingredients.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const selected = inventoryItems.find((i) => i.id === row.inventoryItemId);
            // The ingredient this row points to isn't in the active list —
            // either it was made Inactive, or (edge case) deleted outright.
            const isOrphaned = !selected && row.inventoryItemId !== "";
            const unitLabel = selected
              ? UNIT_LABELS[selected.unit]
              : row.savedUnit
              ? UNIT_LABELS[row.savedUnit]
              : "";

            return (
              <div key={row.key}>
                <div className="flex items-center gap-2">
                  <select
                    value={row.inventoryItemId}
                    onChange={(e) => updateRow(row.key, { inventoryItemId: e.target.value })}
                    className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 ${
                      isOrphaned ? "border-amber-300 bg-amber-50" : "border-gray-300"
                    }`}
                  >
                    <option value="" disabled>
                      Select ingredient…
                    </option>
                    {isOrphaned && (
                      <option value={row.inventoryItemId} disabled>
                        {row.savedName ?? "Unknown ingredient"} (inactive)
                      </option>
                    )}
                    {inventoryItems.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.quantityRequired}
                    onChange={(e) => updateRow(row.key, { quantityRequired: e.target.value })}
                    placeholder="Qty"
                    className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <span className="text-xs text-gray-400 w-8">{unitLabel}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-xs text-gray-400 hover:text-red-500 px-2"
                    aria-label="Remove ingredient"
                  >
                    ✕
                  </button>
                </div>
                {isOrphaned && (
                  <p className="text-xs text-amber-600 mt-1 ml-1">
                    ⚠ {row.savedName ?? "This ingredient"} is inactive. The recipe keeps using it
                    until you pick a different ingredient or reactivate it under Inventory.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          + Add Ingredient
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2C6252] text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Recipe"}
        </button>
        {savedMessage && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}