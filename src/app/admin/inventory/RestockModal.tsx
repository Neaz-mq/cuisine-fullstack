"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
} from "@/components/admin/modal-ui";
import { UNIT_LABELS, formatQuantity } from "@/lib/inventory-status";
import type { IngredientDraft, SupplierOption } from "./IngredientFormModal";

/**
 * src/app/admin/inventory/RestockModal.tsx
 *
 * Figma-র "Items Restock" — মাল এলো, stock বাড়াও।
 *
 *   Restocking (পড়া-মাত্র)
 *   Currently (পড়া-মাত্র)  |  Max Capacity (পড়া-মাত্র)
 *   Supplier
 *   Quantity Received      |  Unit (পড়া-মাত্র)
 *   Cost Per Unit          |  Total Cost (হিসাব করা)
 *   New stock level after restock (হিসাব করা)
 *
 * ── কোনগুলো পড়া-মাত্র, আর কেন ───────────────────────────────────────
 *
 * Figma-তে ঘরগুলো দেখতে সবই সম্পাদনাযোগ্য, কিন্তু বাস্তবে অর্ধেকই
 * তথ্য, ইনপুট নয়।
 *
 * "Currently" আর "Max Capacity" — এগুলো উপকরণের বর্তমান অবস্থা।
 * এখানে বদলানোর সুযোগ দিলে এই modal-টা চুপিসারে একটা "উপকরণ
 * সম্পাদনা" form হয়ে যেত, অথচ নাম বলছে restock। max capacity
 * বদলাতে হলে Edit Ingredient।
 *
 * "Unit" — একটা উপকরণের একক বদলানো মানে তার সব পুরনো StockMovement-এর
 * অর্থ বদলে যাওয়া (৫০ "kg" হঠাৎ ৫০ "g" হয়ে গেলে ইতিহাসটাই মিথ্যা
 * হয়ে যায়)। সেটা একটা restock-এর পার্শ্বপ্রতিক্রিয়া হওয়া উচিত নয়।
 *
 * "Total Cost" আর "New stock level" — হিসাব করা। দুটোই হাতে লেখা গেলে
 * ওরা বাকি সংখ্যাগুলোর সাথে অমিল হতে পারত।
 */
export default function RestockModal({
  open,
  onClose,
  item,
  suppliers,
}: {
  open: boolean;
  onClose: () => void;
  item: IngredientDraft;
  suppliers: SupplierOption[];
}) {
  const router = useRouter();

  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState(
    item.costPerUnit ? String(item.costPerUnit) : ""
  );
  const [supplierId, setSupplierId] = useState(item.supplierId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unitLabel = UNIT_LABELS[item.unit] ?? item.unit;
  const received = Number(quantity) || 0;
  const totalCost = received * (Number(costPerUnit) || 0);
  const newLevel = item.currentStock + received;

  async function handleSubmit() {
    setError(null);

    if (!quantity.trim() || Number.isNaN(received) || received <= 0) {
      setError("Enter how much arrived.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/inventory/${item.id}/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantityReceived: received,
          // ⚠️ ফাঁকা থাকলে ক্ষেত্রটাই পাঠানো হয় না — route তখন পুরনো
          // দাম অক্ষত রাখে। `0` পাঠালে food cost-এর হিসাব শূন্য হয়ে
          // যেত, আর সেটা নীরবে ভুল উত্তর দিত।
          ...(costPerUnit.trim() ? { costPerUnit: Number(costPerUnit) } : {}),
          ...(supplierId ? { supplierId } : {}),
        }),
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

  /** পড়া-মাত্র ঘর — দেখতে "Fill", কিন্তু ইনপুট নয়। */
  const readOnlyBox = `${FIELD} flex cursor-not-allowed items-center text-black/50`;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="restock-title"
      title="Items Restock"
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
            {submitting ? "Saving…" : "Confirm Restock"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      <div>
        <span className={LABEL}>Restocking</span>
        <div className={readOnlyBox} aria-disabled="true">
          {item.name}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <div>
          <span className={LABEL}>Currently</span>
          <div className={readOnlyBox} aria-disabled="true">
            {formatQuantity(item.currentStock, item.unit)}
          </div>
        </div>

        <div>
          <span className={LABEL}>Max Capacity</span>
          <div className={readOnlyBox} aria-disabled="true">
            {item.maxCapacity > 0 ? formatQuantity(item.maxCapacity, item.unit) : "Not set"}
          </div>
        </div>

        <div className="md:col-span-2">
          <SelectField
            id="restock-supplier"
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={[
              { value: "", label: "— Not set —" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        <div>
          <label htmlFor="restock-quantity" className={LABEL}>
            Quantity Received
          </label>
          <input
            id="restock-quantity"
            type="number"
            min={0}
            step="0.01"
            autoFocus
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="12"
            className={FIELD}
          />
        </div>

        <div>
          <span className={LABEL}>Unit</span>
          {/* উপরের মন্তব্য দ্রষ্টব্য — একক বদলালে পুরনো ইতিহাসের
              অর্থই বদলে যেত। */}
          <div className={readOnlyBox} aria-disabled="true">
            {unitLabel}
          </div>
        </div>

        <div>
          <label htmlFor="restock-cost" className={LABEL}>
            Cost Per {unitLabel}{" "}
            <span className="font-sora text-[11px] font-normal text-black/40">(optional)</span>
          </label>
          <input
            id="restock-cost"
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
          <div className={readOnlyBox} aria-disabled="true">
            ৳ {totalCost.toFixed(2)}
          </div>
        </div>

        <div className="md:col-span-2">
          <span className={LABEL}>New stock level after restock</span>
          {/* ⚠️ এটাই এই modal-এর সবচেয়ে দরকারি ঘর: Confirm চাপার আগে
              ফলটা দেখা যায়। ধারণক্ষমতা ছাড়িয়ে গেলে সেটাও এখানেই
              ধরা পড়ে — আটকানো হয় না (বাস্তবে বেশি এসে যেতেই পারে),
              শুধু বলে দেওয়া হয়। */}
          <div className={readOnlyBox} aria-disabled="true">
            {formatQuantity(newLevel, item.unit)}
            {item.maxCapacity > 0 && ` / ${formatQuantity(item.maxCapacity, item.unit)}`}
          </div>
          {item.maxCapacity > 0 && newLevel > item.maxCapacity && (
            <p className="mt-1.5 font-sora text-[11px] leading-none text-[#FF9E00]">
              This goes over the max capacity — that&apos;s allowed, just check it&apos;s right.
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
