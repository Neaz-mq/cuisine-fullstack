"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { DANGER_BUTTON, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, TEXTAREA } from "@/components/admin/modal-ui";

/**
 * Admin → Rider Cash → a rider's hand-in report: "Confirm Received" once
 * the cash is really in hand, or "Dispute" with a reason the rider sees.
 * PATCH /api/admin/rider-cash/[id].
 */
export default function CashRequestActions({ id, amount, rider }: { id: string; amount: string; rider: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const decide = async (action: "CONFIRM" | "DISPUTE") => {
    if (action === "DISPUTE" && !note.trim()) {
      setError("Please say why — the rider will see this.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/rider-cash/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "DISPUTE" ? { action, note: note.trim() } : { action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't update this report.");
        // The confirm dialog covers the page — close it so the error shows.
        setConfirming(false);
        return;
      }
      setConfirming(false);
      setDisputing(false);
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
            setDisputing(true);
          }}
          className="h-9 rounded-full border border-black/15 px-4 font-sora text-[13px] text-black transition-colors hover:border-[#D72A37] hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
        >
          Dispute
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
          className="h-9 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
        >
          Confirm Received
        </button>
      </div>
      {error && !disputing && !confirming && <p className="font-sora text-[12px] text-[#D72A37]">{error}</p>}

      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`Confirm ${amount} received?`}
        message={`Only confirm after ${rider} has actually handed you this cash. It will count as settled and can't be undone.`}
        confirmLabel="Yes, I received it"
        pending={pending}
        onConfirm={() => decide("CONFIRM")}
        onCancel={() => setConfirming(false)}
      />

      <ModalShell
        open={disputing}
        onClose={() => setDisputing(false)}
        title="Dispute hand-in"
        titleId={`dispute-${id}`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDisputing(false)} className={OUTLINE_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={() => decide("DISPUTE")} disabled={pending} className={DANGER_BUTTON}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Dispute
            </button>
          </div>
        }
      >
        <p className="font-sora text-[14px] leading-[1.6] text-black/70">
          {rider} says they handed you {amount}. If it didn&apos;t arrive, or the amount is different, dispute it — the
          cash stays counted as with the rider. If they gave you a different amount, dispute this and use{" "}
          <strong>Record cash</strong> with the real amount.
        </p>
        <label className="block">
          <span className={LABEL}>Reason (the rider sees this)</span>
          <textarea
            className={TEXTAREA}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="e.g. Only $30.00 was handed over"
          />
        </label>
        {error && <ModalError message={error} />}
      </ModalShell>
    </div>
  );
}
