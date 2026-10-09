"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  RequiredMark,
  SelectField,
  TEXTAREA,
} from "@/components/admin/modal-ui";
import { MAX_COMBO_ITEMS } from "@/lib/validations/combo";

/**
 * src/app/admin/combos/ComboFormModal.tsx
 *
 * "Add Combo" / "Edit Combo". Built from the same modal-ui pieces as the
 * Category, Staff and Table modals, so it looks and behaves like them.
 *
 * There is no price field on purpose: the home page adds up the chosen items'
 * current prices (with any live offer). To discount a combo, put an offer on
 * its items — see the note on the Combos page.
 */
export type MenuOption = { value: string; label: string };

export type ComboDraft = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  items: { menuItemId: string; quantity: number }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  menuOptions: MenuOption[];
  /** Omit for "Add Combo"; pass to edit that combo. */
  combo?: ComboDraft;
};

type Line = { menuItemId: string; quantity: string };

export default function ComboFormModal(props: Props) {
  // Mounted only while open, so every opening starts from the initial state —
  // no hand-written reset list (same pattern as CategoryFormModal).
  if (!props.open) return null;
  return <ComboFormModalContent {...props} />;
}

function ComboFormModalContent({ open, onClose, menuOptions, combo }: Props) {
  const router = useRouter();
  const isEdit = Boolean(combo);

  const [name, setName] = useState(combo?.name ?? "");
  const [description, setDescription] = useState(combo?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(combo?.imageUrl ?? null);
  const [isActive, setIsActive] = useState(combo?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(combo?.sortOrder ?? 1));
  const [lines, setLines] = useState<Line[]>(
    combo
      ? combo.items.map((i) => ({ menuItemId: i.menuItemId, quantity: String(i.quantity) }))
      : [{ menuItemId: "", quantity: "1" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const taken = new Set(lines.map((l) => l.menuItemId).filter(Boolean));
  // An item already used in another row is not offered again — a combo lists
  // each item once; a second helping is the quantity.
  const optionsFor = (current: string) => [
    { value: "", label: "Select a menu item" },
    ...menuOptions.filter((o) => o.value === current || !taken.has(o.value)),
  ];

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) return setError("Please enter a combo name.");
    if (!trimmedDescription) return setError("Please add a short description.");

    const chosen = lines.filter((l) => l.menuItemId);
    if (chosen.length === 0) return setError("Choose at least one menu item for the combo.");

    const items = chosen.map((l) => ({ menuItemId: l.menuItemId, quantity: Number(l.quantity) }));
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
      return setError("Each quantity must be a whole number from 1 to 99.");
    }

    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0 || order > 9999) {
      return setError("Display order must be a whole number from 0 to 9999.");
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/combos/${combo!.id}` : "/api/admin/combos", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: trimmedDescription,
          imageUrl,
          isActive,
          sortOrder: order,
          items,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      onClose();
      router.refresh();
      toast.success(isEdit ? `"${trimmedName}" updated.` : `"${trimmedName}" added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="combo-form-title"
      title={isEdit ? "Edit Combo" : "Add Combo"}
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
            disabled={submitting || uploading}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      <div className="flex flex-col gap-2">
        <ImageDropzone
          value={imageUrl}
          onChange={setImageUrl}
          onError={setError}
          uploading={uploading}
          setUploading={setUploading}
        />
        <p className="font-sora text-[12px] leading-[1.6] text-black/60">
          Optional. Without a photo, the first item&apos;s photo is used.
        </p>
      </div>

      <div>
        <label htmlFor="combo-name" className={LABEL}>
          Combo Name
          <RequiredMark />
        </label>
        <input
          id="combo-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Classic Combo"
          maxLength={80}
          autoFocus
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="combo-description" className={LABEL}>
          Description
          <RequiredMark />
        </label>
        <textarea
          id="combo-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What makes this combo worth ordering"
          maxLength={300}
          className={TEXTAREA}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          id="combo-status"
          label="Home page"
          value={isActive ? "true" : "false"}
          onChange={(value) => setIsActive(value === "true")}
          options={[
            { value: "true", label: "Show" },
            { value: "false", label: "Hide" },
          ]}
        />
        <div>
          <label htmlFor="combo-order" className={LABEL}>
            Display order
          </label>
          <input
            id="combo-order"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className={FIELD}
          />
        </div>
        <p className="col-span-2 -mt-2 font-sora text-[12px] leading-[1.6] text-black/60">
          Combos with a lower order come first. The home page shows the first few live ones.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className={`${LABEL} mb-0`}>
          Items in this combo
          <RequiredMark />
        </span>

        {lines.map((line, index) => (
          <div key={index} className="flex items-end gap-2">
            <SelectField
              className="min-w-0 flex-1"
              id={`combo-item-${index}`}
              label={`Item ${index + 1}`}
              value={line.menuItemId}
              onChange={(value) => updateLine(index, { menuItemId: value })}
              options={optionsFor(line.menuItemId)}
            />
            <div className="w-[76px] shrink-0">
              <label htmlFor={`combo-qty-${index}`} className={LABEL}>
                Qty
              </label>
              <input
                id={`combo-qty-${index}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
                className={FIELD}
              />
            </div>
            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
              disabled={lines.length === 1}
              aria-label={`Remove item ${index + 1}`}
              className="flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08] disabled:opacity-40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
            >
              <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { menuItemId: "", quantity: "1" }])}
          disabled={lines.length >= MAX_COMBO_ITEMS}
          className={`${OUTLINE_BUTTON} self-start`}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Add another item
        </button>
      </div>
    </ModalShell>
  );
}