"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatAmount } from "@/lib/currency-format";
import { FIELD, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, PRIMARY_BUTTON, TEXTAREA } from "@/components/admin/modal-ui";

/**
 * Admin → Rider Cash → "Record cash": the owner took cash from a rider and
 * writes it down straight away (already confirmed — it's the owner's own
 * record). POST /api/admin/rider-cash { riderId, amount, note }.
 */
export default function RecordCashButton({
  riderId,
  riderName,
  max,
  currency,
  minorUnits,
}: {
  riderId: string;
  riderName: string;
  /** Cash the rider holds that nobody has reported or recorded yet. */
  max: number;
  currency: string;
  minorUnits: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const factor = 10 ** minorUnits;
  const parsed = Number.parseFloat(amount.replace(/,/g, ""));
  const rounded = Number.isFinite(parsed) ? Math.round(parsed * factor) / factor : NaN;
  const valid = Number.isFinite(rounded) && rounded > 0 && rounded <= max + 0.001;

  const submit = async () => {
    if (!valid) {
      setError(`Enter an amount up to ${formatAmount(max, currency)}.`);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rider-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId, amount: rounded, note: note.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't record the cash.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={max <= 0}
        onClick={() => {
          setAmount(max.toFixed(minorUnits));
          setNote("");
          setError("");
          setOpen(true);
        }}
        className="h-9 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
      >
        Record cash
      </button>

      <ModalShell
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Record cash received"
        titleId={`record-cash-${riderId}`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={OUTLINE_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={pending || !valid} className={PRIMARY_BUTTON}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Record
            </button>
          </div>
        }
      >
        <p className="font-sora text-[14px] leading-[1.6] text-black/70">
          Cash you received from <strong>{riderName}</strong>. It is saved as confirmed right away and shows on their
          Cash Collected page. They hold {formatAmount(max, currency)} that hasn&apos;t been recorded.
        </p>
        <label className="block">
          <span className={LABEL}>Amount received</span>
          <input className={FIELD} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className={LABEL}>Note (optional)</span>
          <textarea
            className={TEXTAREA}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. End-of-shift handover"
          />
        </label>
        {error && <ModalError message={error} />}
      </ModalShell>
    </>
  );
}
