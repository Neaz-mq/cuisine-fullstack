"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2 } from "lucide-react";
import { formatAmount } from "@/lib/currency-format";
import { FIELD, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, PRIMARY_BUTTON, TEXTAREA } from "@/components/admin/modal-ui";

/**
 * Rider panel → Cash Collected → "Hand In Cash".
 *
 * The rider reports cash they just gave to the restaurant. This does NOT
 * reduce what they owe by itself — it creates a dated report the owner
 * confirms (or disputes) on Admin → Rider Cash. That dated report is the
 * rider's protection if the owner forgets to record it. POST
 * /api/rider/cash-handovers { amount, note }.
 */
export default function HandInCashButton({
  inHand,
  currency,
  minorUnits,
}: {
  /** Cash the rider holds and hasn't reported yet. */
  inHand: number;
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
  const valid = Number.isFinite(rounded) && rounded > 0 && rounded <= inHand + 0.001;

  const openModal = () => {
    setAmount(inHand.toFixed(minorUnits));
    setNote("");
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    if (!valid) {
      setError(`Enter an amount between ${formatAmount(1 / factor, currency)} and ${formatAmount(inHand, currency)}.`);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/rider/cash-handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: rounded, note: note.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't save your hand-in.");
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
        onClick={openModal}
        disabled={inHand <= 0}
        className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:h-[50px] min-[480px]:px-5 min-[480px]:text-[16px]"
      >
        <HandCoins className="h-4 w-4 min-[480px]:h-5 min-[480px]:w-5" strokeWidth={1.5} aria-hidden="true" />
        Hand In Cash
      </button>

      <ModalShell
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Hand In Cash"
        titleId="hand-in-cash-title"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={OUTLINE_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={pending || !valid} className={PRIMARY_BUTTON}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Report Hand-In
            </button>
          </div>
        }
      >
        <p className="font-sora text-[14px] leading-[1.6] text-black/70">
          Only report cash you have <strong>already given</strong> to the restaurant. You hold{" "}
          <strong>{formatAmount(inHand, currency)}</strong>. The restaurant confirms it — until then it shows as
          &ldquo;awaiting confirmation&rdquo;, with today&apos;s date and time, so you always have a record.
        </p>
        <label className="block">
          <span className={LABEL}>Amount you handed in</span>
          <input
            className={FIELD}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby="hand-in-max"
          />
          <span id="hand-in-max" className="mt-1.5 block font-sora text-[12px] text-black/70">
            Maximum {formatAmount(inHand, currency)}
          </span>
        </label>
        <label className="block">
          <span className={LABEL}>Note (optional)</span>
          <textarea
            className={TEXTAREA}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. Gave to the cashier at the counter"
          />
        </label>
        {error && <ModalError message={error} />}
      </ModalShell>
    </>
  );
}
