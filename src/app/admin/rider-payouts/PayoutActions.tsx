"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { DANGER_BUTTON, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, TEXTAREA } from "@/components/admin/modal-ui";

/**
 * Admin → Rider Payouts → a pending request: "Mark as Paid" (after the
 * owner has sent the money by bank / bKash) or "Reject" with a reason the
 * rider sees. PATCH /api/admin/rider-payouts/[id].
 */
export default function PayoutActions({ id, amount, rider }: { id: string; amount: string; rider: string }) {
  const router = useRouter();
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const decide = async (action: "PAID" | "REJECTED") => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/rider-payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "REJECTED" ? { action, note: note.trim() || undefined } : { action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't update this request.");
        return;
      }
      setConfirmPaid(false);
      setRejecting(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 min-[480px]:items-end">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setError("");
            setRejecting(true);
          }}
          className="h-9 rounded-full border border-black/15 px-4 font-sora text-[13px] text-black transition-colors hover:border-[#D72A37] hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirmPaid(true);
          }}
          className="h-9 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
        >
          Mark as Paid
        </button>
      </div>
      {error && !rejecting && <p className="font-sora text-[12px] text-[#D72A37]">{error}</p>}

      <ConfirmDialog
        open={confirmPaid}
        tone="primary"
        title={`Mark ${amount} as paid?`}
        message={`Only do this after you've sent the money to ${rider}. They'll see it as Paid, and it can't be undone.`}
        confirmLabel="Yes, it's paid"
        pending={pending}
        onConfirm={() => decide("PAID")}
        onCancel={() => setConfirmPaid(false)}
      />

      <ModalShell
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject cash out"
        titleId={`reject-${id}`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRejecting(false)} className={OUTLINE_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={() => decide("REJECTED")} disabled={pending} className={DANGER_BUTTON}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Reject
            </button>
          </div>
        }
      >
        <p className="font-sora text-[14px] leading-[1.6] text-black/70">
          {amount} goes back to {rider}&apos;s balance, so they can request it again (for example with a corrected account).
        </p>
        <label className="block">
          <span className={LABEL}>Reason (the rider sees this)</span>
          <textarea
            className={TEXTAREA}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="e.g. The account number doesn't match the name"
          />
        </label>
        {error && <ModalError message={error} />}
      </ModalShell>
    </div>
  );
}
