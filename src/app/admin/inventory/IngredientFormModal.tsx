"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
} from "@/components/admin/modal-ui";
import {
  INVENTORY_CATEGORIES,
  UNIT_LABELS,
  UNIT_OPTIONS,
} from "@/lib/inventory-status";

/**
 * src/app/admin/inventory/IngredientFormModal.tsx
 *
 * Figma-র "Add Ingredient" — এবং তার যমজ "Edit Ingredient"।
 *
 *   [ছবির drop-zone]
 *   Item Name        |  Category
 *   Used In Menu Items (পড়া-মাত্র)
 *   Supplier
 *   Starting Quantity |  Unit  |  Max Capacity
 *   Cost Per Unit     |  Total Cost (পড়া-মাত্র)
 *   Low Stock Threshold | Emergency Threshold
 *
 * ── Figma-র সাথে দুটো তফাত, দুটোই ইচ্ছাকৃত ──────────────────────────
 *
 * ⚠️ ১. "Used In Menu Items" নকশায় একটা **সম্পাদনাযোগ্য** ঘর ("5")।
 * এখানে সেটা পড়া-মাত্র, কারণ সংখ্যাটা হাতে লেখার জিনিস নয় — এটা
 * recipe থেকে গোনা হয় (MenuItemIngredient)। হাতে লেখার সুযোগ দিলে
 * সারিতে "Used in 5 menu items" লেখা থাকত অথচ বাস্তবে ৩টে — আর
 * তখন কোনটা সত্যি বোঝার উপায় থাকত না।
 *
 * ⚠️ ২. "Total Cost" ঘরটাও পড়া-মাত্র, আর সেটা হিসাব করা: পরিমাণ ×
 * একক-প্রতি দাম। দুটোই হাতে লেখা গেলে ওরা একে অন্যের সাথে অমিল
 * হতে পারত (৳30/kg × 15kg = ৳450, কিন্তু কেউ লিখল ৳360), আর তখন
 * food cost-এর হিসাব কোনটা ধরত?
 *
 * ── mode ─────────────────────────────────────────────────────────────
 *
 *   create  POST  /api/admin/inventory
 *   edit    PATCH /api/admin/inventory/[id]
 *
 * ⚠️ edit-এ "Starting Quantity" ঘরটা নেই। stock কখনো সরাসরি লেখা যায়
 * না — প্রতিটা পরিবর্তনের সাথে একটা StockMovement লেখা হয়, যাতে
 * "কে কখন কেন বদলাল" জানা যায় (schema.prisma-য় এটাই নিয়ম, আর
 * updateInventoryItemSchema-ও currentStock গ্রহণ করে না)। বাড়াতে
 * হলে Restock, কমাতে হলে wastage/adjustment।
 */

export type IngredientDraft = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  emergencyThreshold: number;
  maxCapacity: number;
  costPerUnit: number;
  category: string | null;
  supplierId: string | null;
  image: string | null;
  usedInRecipes: number;
};

export type SupplierOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  suppliers: SupplierOption[];
  /** না দিলে "Add Ingredient"; দিলে সেই উপকরণের সম্পাদনা। */
  item?: IngredientDraft;
};

export default function IngredientFormModal(props: Props) {
  // বন্ধ থাকলে কিছুই mount হয় না — প্রতিবার খোলা মানে নতুন mount, আর
  // `useState`-এর প্রাথমিক মানই একমাত্র সত্য। হাতে লেখা কোনো "reset"
  // তালিকা রক্ষণাবেক্ষণ করতে হয় না।
  if (!props.open) return null;
  return <IngredientFormModalContent {...props} />;
}

function IngredientFormModalContent({ open, onClose, suppliers, item }: Props) {
  const router = useRouter();
  const isEdit = Boolean(item);

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [supplierId, setSupplierId] = useState(item?.supplierId ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "KILOGRAM");
  const [startingQuantity, setStartingQuantity] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(
    item?.maxCapacity ? String(item.maxCapacity) : ""
  );
  const [costPerUnit, setCostPerUnit] = useState(
    item?.costPerUnit ? String(item.costPerUnit) : ""
  );
  const [reorderThreshold, setReorderThreshold] = useState(
    item?.reorderThreshold ? String(item.reorderThreshold) : ""
  );
  const [emergencyThreshold, setEmergencyThreshold] = useState(
    item?.emergencyThreshold ? String(item.emergencyThreshold) : ""
  );
  const [image, setImage] = useState<string | null>(item?.image ?? null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unitLabel = UNIT_LABELS[unit] ?? unit;
  // পরিমাণ × একক-প্রতি দাম — উপরের ⚠️ ২ নম্বর মন্তব্য দ্রষ্টব্য।
  const quantityForTotal = isEdit ? (item?.currentStock ?? 0) : Number(startingQuantity) || 0;
  const totalCost = quantityForTotal * (Number(costPerUnit) || 0);

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    const numberOrZero = (value: string) => (value.trim() ? Number(value) : 0);
    if ([maxCapacity, costPerUnit, reorderThreshold, emergencyThreshold].some((value) =>
      value.trim() ? Number.isNaN(Number(value)) : false
    )) {
      setError("Please enter valid numbers.");
      return;
    }

    // ⚠️ জরুরি-সীমা কখনো low-stock সীমার উপরে হতে পারে না — হলে
    // stockStateOf() প্রতিটা "low" জিনিসকেই "emergency" বলত, আর
    // দুটো ধাপের তফাতই মুছে যেত।
    const reorder = numberOrZero(reorderThreshold);
    const emergency = numberOrZero(emergencyThreshold);
    if (reorder > 0 && emergency > reorder) {
      setError("Emergency threshold must be at or below the low stock threshold.");
      return;
    }

    const shared = {
      name: name.trim(),
      unit,
      category,
      supplierId,
      image: image ?? "",
      maxCapacity: numberOrZero(maxCapacity),
      costPerUnit: numberOrZero(costPerUnit),
      reorderThreshold: reorder,
      emergencyThreshold: emergency,
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/inventory/${item!.id}` : "/api/admin/inventory",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? // ⚠️ PATCH-এ `null` পাঠানো হয় (ফাঁকা string নয়) —
                // updateInventoryItemSchema nullable, আর null মানে
                // "মুছে দাও"। create-এ উল্টো: সেখানে ফাঁকা string।
                {
                  ...shared,
                  category: category || null,
                  supplierId: supplierId || null,
                  image: image || null,
                }
              : { ...shared, currentStock: numberOrZero(startingQuantity) }
          ),
        }
      );

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
      titleId="ingredient-form-title"
      title={isEdit ? "Edit Ingredient" : "Add Ingredient"}
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

      <ImageDropzone
        value={image}
        onChange={setImage}
        onError={setError}
        uploading={uploading}
        setUploading={setUploading}
      />

      {/* Frame 2147236092: প্রতিটা সারি gap 16, সারিগুলোর মাঝে 20। */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <div>
          <label htmlFor="ingredient-name" className={LABEL}>
            Item Name
          </label>
          <input
            id="ingredient-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Chicken Breast"
            className={FIELD}
          />
        </div>

        <SelectField
          id="ingredient-category"
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "", label: "— Not set —" },
            ...INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />

        {isEdit && (
          <div className="md:col-span-2">
            <span className={LABEL}>
              Used In Menu Items{" "}
              <span className="font-sora text-[11px] font-normal text-black/40">
                (from recipes)
              </span>
            </span>
            {/* উপরের ⚠️ ১ নম্বর মন্তব্য দ্রষ্টব্য — এটা গোনা হয়, লেখা হয় না। */}
            <div
              className={`${FIELD} flex cursor-not-allowed items-center text-black/50`}
              aria-disabled="true"
            >
              {item!.usedInRecipes} menu {item!.usedInRecipes === 1 ? "item" : "items"}
            </div>
          </div>
        )}

        <div className="md:col-span-2">
          <SelectField
            id="ingredient-supplier"
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={[
              { value: "", label: "— Not set —" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="ingredient-quantity" className={LABEL}>
              Starting Quantity
            </label>
            {/* ⚠️ কেবল create-এ — edit-এ stock সরাসরি লেখা যায় না
                (শীর্ষ মন্তব্য দ্রষ্টব্য)। */}
            <input
              id="ingredient-quantity"
              type="number"
              min={0}
              step="0.01"
              value={startingQuantity}
              onChange={(event) => setStartingQuantity(event.target.value)}
              placeholder="15"
              className={FIELD}
            />
          </div>
        )}

        <SelectField
          id="ingredient-unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
          options={UNIT_OPTIONS.map((u) => ({ value: u.value, label: u.label }))}
        />

        <div className={isEdit ? "" : "md:col-span-2"}>
          <label htmlFor="ingredient-max" className={LABEL}>
            Max Capacity
          </label>
          <input
            id="ingredient-max"
            type="number"
            min={0}
            step="0.01"
            value={maxCapacity}
            onChange={(event) => setMaxCapacity(event.target.value)}
            placeholder="15"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="ingredient-cost" className={LABEL}>
            Cost Per {unitLabel}
          </label>
          <input
            id="ingredient-cost"
            type="number"
            min={0}
            step="0.001"
            value={costPerUnit}
            onChange={(event) => setCostPerUnit(event.target.value)}
            placeholder="30.00"
            className={FIELD}
          />
        </div>

        <div>
          <span className={LABEL}>
            Total Cost{" "}
            <span className="font-sora text-[11px] font-normal text-black/40">(calculated)</span>
          </span>
          {/* উপরের ⚠️ ২ নম্বর মন্তব্য দ্রষ্টব্য। */}
          <div
            className={`${FIELD} flex cursor-not-allowed items-center text-black/50`}
            aria-disabled="true"
          >
            ৳ {totalCost.toFixed(2)}
          </div>
        </div>

        <div>
          <label htmlFor="ingredient-reorder" className={LABEL}>
            Low Stock Threshold
          </label>
          <input
            id="ingredient-reorder"
            type="number"
            min={0}
            step="0.01"
            value={reorderThreshold}
            onChange={(event) => setReorderThreshold(event.target.value)}
            placeholder="3"
            className={FIELD}
          />
          <p className="mt-1.5 font-sora text-[11px] leading-none text-black/70">
            Alert when stock falls below this amount
          </p>
        </div>

        <div>
          <label htmlFor="ingredient-emergency" className={LABEL}>
            Emergency Threshold
          </label>
          <input
            id="ingredient-emergency"
            type="number"
            min={0}
            step="0.01"
            value={emergencyThreshold}
            onChange={(event) => setEmergencyThreshold(event.target.value)}
            placeholder="1"
            className={FIELD}
          />
          <p className="mt-1.5 font-sora text-[11px] leading-none text-black/70">
            Flag as urgent when stock falls below this
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
