"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { UNIT_OPTIONS } from "@/lib/inventory-status";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
} from "@/components/admin/modal-ui";

/**
 * src/app/admin/kitchen/prep/AddPrepTaskModal.tsx
 *
 * Figma "Add Task" (Frame 2147236222): title · Task Name (full width) ·
 * Quantity + Unit side by side (Unit defaults to Kg) · Cancel / Save Change.
 * The shell, fields and buttons are the same ones every other modal uses,
 * so it matches them by construction.
 */
export default function AddPrepTaskModal(props: { open: boolean; onClose: () => void }) {
  // Nothing is mounted while closed, so every open starts from empty
  // fields without a hand-written reset (same approach as SupplierFormModal).
  if (!props.open) return null;
  return <AddPrepTaskModalContent {...props} />;
}

function AddPrepTaskModalContent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("KILOGRAM");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Task name is required.");
      return;
    }
    const amount = Number(quantity);
    // Number("") is 0, so the empty field is caught by the same check.
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Quantity must be a number greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/kitchen/prep-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, quantity: amount, unit }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="prep-task-title"
      title="Add Task"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${OUTLINE_BUTTON} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {/* Enter in either text field saves — a form without a <form>. */}
      <div
        className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      >
        <div className="md:col-span-2">
          <label htmlFor="prep-task-name" className={LABEL}>
            Task Name
          </label>
          <input
            id="prep-task-name"
            type="text"
            autoFocus
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Chop onions & peppers"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="prep-task-quantity" className={LABEL}>
            Quantity
          </label>
          <input
            id="prep-task-quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="3"
            className={FIELD}
          />
        </div>

        <SelectField
          id="prep-task-unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
          options={UNIT_OPTIONS}
        />
      </div>
    </ModalShell>
  );
}
