"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import CouponModal from "./CouponModal";
import type { CategoryOption, CouponFormValues } from "./types";

/**
 * "Edit" (outline pill) and "Delete" (red pill) on each All Coupons row.
 *
 * A coupon customers have already used can't be deleted — it's part of
 * their orders. For those, the confirm box offers "Deactivate" instead,
 * which stops the code working but keeps its history.
 */
const OUTLINE =
  "flex h-9 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-black px-4 font-sora text-[13px] leading-none text-black transition-colors hover:bg-black/[0.04] md:flex-none xl:h-[46px] xl:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const DANGER =
  "flex h-9 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-[#D72A37] px-4 font-sora text-[13px] leading-none text-white transition-opacity hover:opacity-90 md:flex-none xl:h-[46px] xl:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function CouponRowActions({
  coupon,
  categories,
  currency,
}: {
  coupon: CouponFormValues;
  categories: CategoryOption[];
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const used = coupon.usageCount > 0;

  const run = async () => {
    setBusy(true);
    try {
      const res = used
        ? await fetch(`/api/admin/coupons/${coupon.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          })
        : await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the coupon.");
      toast.success(used ? `${coupon.code} deactivated` : `${coupon.code} deleted`);
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the coupon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full items-center gap-3 md:w-auto md:justify-end">
      <button type="button" onClick={() => setEditing(true)} className={OUTLINE}>
        Edit
      </button>
      <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
        Delete
      </button>

      <CouponModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={coupon}
        categories={categories}
        currency={currency}
      />
      <ConfirmDialog
        open={confirming}
        title={used ? `Deactivate ${coupon.code}?` : `Delete ${coupon.code}?`}
        message={
          used
            ? `It was used ${coupon.usageCount} ${coupon.usageCount === 1 ? "time" : "times"}, so it can't be deleted — those orders keep it on their receipts. Deactivating stops the code working now; you can switch it back on with Edit.`
            : "It hasn't been used yet, so it's removed for good."
        }
        confirmLabel={used ? "Deactivate" : "Delete"}
        pending={busy}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
