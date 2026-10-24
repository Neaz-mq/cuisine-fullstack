"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
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
import { formatAmount } from "@/lib/currency-format";
import type { IngredientDraft, SupplierOption } from "./IngredientFormModal";

/**
 * src/app/admin/inventory/RestockModal.tsx
 *
 * Figma-র "Items Restock" — সরবরাহকারীর কাছে নতুন করে মাল চাওয়া।
 *
 *   Restocking (পড়া-মাত্র)
 *   Currently (পড়া-মাত্র)  |  Max Capacity (পড়া-মাত্র)
 *   Supplier
 *   Quantity to Order      |  Unit (পড়া-মাত্র)
 *   Cost Per Unit          |  Total Cost (হিসাব করা)
 *   Stock after delivery (হিসাব করা)
 *
 * ── এই modal এখন stock বাড়ায় না ───────────────────────────────────────
 *
 * ⚠️ আগে "Confirm Restock" সরাসরি stock বাড়াত (মাল এসে গেছে ধরে নিয়ে)।
 * এখন এটা একটা **অর্ডার**: Pending purchase order তৈরি হয় আর
 * সরবরাহকারীর কাছে email যায়। তিনি accept করলে "On the Way", আর মাল
 * পৌঁছলে Suppliers → Recent Deliveries থেকে "Confirm delivery" চাপলে
 * তবেই stock বাড়ে। না হলে মাল না আসতেই Inventory পাতা মিথ্যা বলত।
 *
 * ── কোনগুলো পড়া-মাত্র, আর কেন ───────────────────────────────────────
 *
 * "Currently" আর "Max Capacity" — উপকরণের বর্তমান অবস্থা; বদলাতে হলে
 * Edit Ingredient। "Unit" — একক বদলালে পুরনো StockMovement-এর অর্থ বদলে
 * যেত। "Total Cost" আর "Stock after delivery" — হিসাব করা, হাতে লেখা গেলে
 * বাকি সংখ্যার সাথে অমিল হতে পারত।
 */
export default function RestockModal({
  open,
  onClose,
  item,
  suppliers,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  item: IngredientDraft;
  suppliers: SupplierOption[];
  /**
   * ⚠️ মুদ্রার চিহ্নটা এখানে হার্ডকোড করা যায় না — RestaurantSettings-এ
   * `currency` একটা সেটিং, আর অ্যাপের বাকি সব জায়গা `formatAmount()`
   * দিয়ে সেটাই মানে। client component বলে settings নিজে পড়া যায় না,
   * তাই server থেকে নেমে আসে।
   */
  currency: string;
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
  const ordering = Number(quantity) || 0;
  const totalCost = ordering * (Number(costPerUnit) || 0);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const onOrder = item.openOrder?.quantity ?? 0;
  // Stock once THIS order and anything already on order have arrived.
  const newLevel = item.currentStock + onOrder + ordering;

  async function handleSubmit() {
    setError(null);

    if (!supplierId || !selectedSupplier) {
      setError("Pick a supplier — the order is emailed to them.");
      return;
    }
    if (!selectedSupplier.email) {
      setError(
        `${selectedSupplier.name} has no email address, so the order can't be sent. Add one on the Suppliers page first.`
      );
      return;
    }
    if (!quantity.trim() || Number.isNaN(ordering) || ordering <= 0) {
      setError("Enter how much to order.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/inventory/${item.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: ordering,
          supplierId,
          // ⚠️ ফাঁকা থাকলে ক্ষেত্রটাই পাঠানো হয় না — server তখন
          // উপকরণের চলতি দাম ধরে। `0` পাঠালে food cost শূন্য হয়ে যেত।
          ...(costPerUnit.trim() ? { costPerUnit: Number(costPerUnit) } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      if (data.emailed) {
        toast.success(`Order emailed to ${data.supplierName}. It stays Pending until they accept.`);
      } else {
        toast.warning(
          "Order saved as Pending, but the email didn't go out. Use “Send email” on Suppliers → Recent Deliveries."
        );
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
            {submitting ? "Sending…" : "Confirm Restock"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {item.openOrder && (
        <p className="rounded-[12px] bg-[#FFF2DA] px-4 py-3 font-sora text-[12px] leading-[1.6] text-[#B36B00]">
          {formatQuantity(item.openOrder.quantity, item.unit)} of {item.name} is already on order
          from {item.openOrder.supplierName} (
          {item.openOrder.status === "ON_THE_WAY" ? "on the way" : "waiting for them to accept"}).
          Order more only if you really need it.
        </p>
      )}

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
              { value: "", label: "— Select a supplier —" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          {selectedSupplier && (
            <p className="mt-1.5 font-sora text-[11px] leading-[1.5] text-black/70">
              {selectedSupplier.email
                ? `The order is emailed to ${selectedSupplier.email}.`
                : `${selectedSupplier.name} has no email address — add one on the Suppliers page first.`}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="restock-quantity" className={LABEL}>
            Quantity to Order
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
            {formatAmount(totalCost, currency)}
          </div>
        </div>

        <div className="md:col-span-2">
          <span className={LABEL}>Stock after delivery</span>
          {/* ⚠️ এই সংখ্যাটা এখনো "হবে", "হয়েছে" নয় — মাল আসা পর্যন্ত
              stock বদলায় না। ধারণক্ষমতা ছাড়ালে বলে দেওয়া হয়, আটকানো
              হয় না (বাস্তবে বেশি এসে যেতেই পারে)। */}
          <div className={readOnlyBox} aria-disabled="true">
            {formatQuantity(newLevel, item.unit)}
            {item.maxCapacity > 0 && ` / ${formatQuantity(item.maxCapacity, item.unit)}`}
          </div>
          <p className="mt-1.5 font-sora text-[11px] leading-[1.5] text-black/70">
            Stock only goes up once you confirm the delivery on Suppliers → Recent Deliveries.
          </p>
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
