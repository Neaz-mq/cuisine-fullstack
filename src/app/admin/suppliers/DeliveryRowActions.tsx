"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

/**
 * src/app/admin/suppliers/DeliveryRowActions.tsx
 *
 * The buttons on a Recent Deliveries row, depending on where the order is:
 *
 *   Pending (ORDERED)      → "Resend" (email the supplier again) · "Cancel"
 *   On the Way (ON_THE_WAY)→ "Confirm delivery" (goods arrived → Delivered,
 *                            stock goes up) · "Cancel"
 *   Delivered / Cancelled  → nothing — those are history.
 *
 * ⚠️ "Confirm delivery" is the ONLY thing in the whole flow that adds stock
 * (lib/receive-purchase-order.ts), so it asks first.
 */
export default function DeliveryRowActions({
  purchaseOrderId,
  status,
  emailPending,
}: {
  purchaseOrderId: string;
  status: string;
  /** Pending and the email hasn't gone out yet — Resend is then the main action. */
  emailPending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "resend" | "receive" | "cancel">(null);
  const [confirm, setConfirm] = useState<null | "receive" | "cancel">(null);

  if (status !== "ORDERED" && status !== "ON_THE_WAY") return null;

  async function call(
    kind: "resend" | "receive" | "cancel",
    url: string,
    init: RequestInit,
    success: string
  ) {
    setBusy(kind);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      toast.success(success);
      setConfirm(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const pill =
    "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 font-sora text-[13px] font-normal leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status === "ORDERED" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              call(
                "resend",
                `/api/admin/purchase-orders/${purchaseOrderId}/resend`,
                { method: "POST" },
                "Email sent to the supplier."
              )
            }
            className={`${pill} ${
              emailPending
                ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90"
                : "border border-black text-black hover:bg-black hover:text-white"
            }`}
          >
            {busy === "resend" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {emailPending ? "Send email" : "Resend"}
          </button>
        )}

        {status === "ON_THE_WAY" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirm("receive")}
            className={`${pill} bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90`}
          >
            {busy === "receive" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Confirm delivery
          </button>
        )}

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setConfirm("cancel")}
          className={`${pill} border border-[#D72A37]/40 text-[#D72A37] hover:bg-[#FAE7EC]`}
        >
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={confirm === "receive"}
        tone="primary"
        title="Confirm this delivery?"
        message="Only confirm once the goods have really arrived. The full ordered quantity is added to your stock and the order becomes Delivered."
        confirmLabel="Yes, it arrived"
        pending={busy === "receive"}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          call(
            "receive",
            `/api/admin/purchase-orders/${purchaseOrderId}/receive`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            },
            "Delivery confirmed — stock updated."
          )
        }
      />

      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancel this order?"
        message="The supplier's link will show the order as cancelled. No stock is changed."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        pending={busy === "cancel"}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          call(
            "cancel",
            `/api/admin/purchase-orders/${purchaseOrderId}`,
            { method: "DELETE" },
            "Order cancelled."
          )
        }
      />
    </>
  );
}
