"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { OfferStatus } from "@/lib/product-offers";
import OfferModal from "./OfferModal";
import type { EditableOffer, MoneyFormat } from "./types";

/**
 * "Edit" (outline pill) and "Remove" (red pill) on an offer card.
 *
 * What "Remove" does depends on the offer (see DELETE
 * /api/admin/offers/[id]): a running offer ends at once and moves to
 * "Ended"; a scheduled or ended one is deleted. The confirm box says
 * which, so nobody is surprised.
 */
const OUTLINE =
  "flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-black px-3.5 font-sora text-[12px] leading-none text-black transition-colors hover:bg-black/[0.04] min-[480px]:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const DANGER =
  "flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-[#D72A37] px-3.5 font-sora text-[12px] leading-none text-white transition-opacity hover:opacity-90 min-[480px]:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function OfferCardActions({
  offer,
  status,
  normalPriceLabel,
  money,
}: {
  offer: EditableOffer;
  status: OfferStatus;
  normalPriceLabel: string;
  money: MoneyFormat;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't remove the offer.");
      toast.success(data.result === "ended" ? "Offer ended" : "Offer deleted");
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove the offer.");
    } finally {
      setRemoving(false);
    }
  };

  const confirmText =
    status === "active"
      ? {
          title: "End this offer now?",
          message: `${offer.product.title} goes back to ${normalPriceLabel} right away. The offer stays under "Ended" with its orders.`,
          label: "End Offer",
        }
      : status === "scheduled"
        ? {
            title: "Delete this scheduled offer?",
            message: `It hasn't started yet, so ${offer.product.title} keeps its normal price.`,
            label: "Delete",
          }
        : {
            title: "Delete this offer for good?",
            message: "Past orders keep the prices they were charged.",
            label: "Delete",
          };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className={OUTLINE}>
        Edit
      </button>
      <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
        {status === "active" ? "Remove" : "Delete"}
      </button>

      <OfferModal
        open={editing}
        onClose={() => setEditing(false)}
        mode={{ kind: "edit", offer }}
        money={money}
      />
      <ConfirmDialog
        open={confirming}
        title={confirmText.title}
        message={confirmText.message}
        confirmLabel={confirmText.label}
        pending={removing}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
