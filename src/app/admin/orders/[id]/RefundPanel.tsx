"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * src/app/admin/orders/[id]/RefundPanel.tsx
 *
 * Issues money back from an order's detail page.
 *
 * ── Why this is a form and not a one-click button ─────────────────────
 *
 * A refund is irreversible and moves real money. The amount defaults to
 * everything still refundable — the common case, and one keystroke away —
 * but it is typed rather than assumed, and the button says exactly how
 * much is about to leave. A single "Refund" button next to a status
 * dropdown is how someone refunds the wrong order at the end of a shift.
 *
 * All the arithmetic already happened server-side: the props below are
 * pre-formatted strings in the ORDER's own currency, never numbers to be
 * recomputed here.
 */
export default function RefundPanel({
  orderId,
  currency,
  /** What's still refundable, as a plain number for the input's max. */
  remaining,
  /** Display strings, already formatted for this order's currency. */
  chargedLabel,
  refundedLabel,
  remainingLabel,
  canRefund,
  blockedReason,
}: {
  orderId: string;
  currency: string;
  remaining: number;
  chargedLabel: string;
  refundedLabel: string | null;
  remainingLabel: string;
  canRefund: boolean;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Blank means "everything still refundable" — the server treats an
    // omitted amount the same way, so the two agree by construction.
    const parsed = amount.trim() === "" ? undefined : Number(amount);

    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError("Enter an amount greater than zero, or leave it blank to refund everything.");
      return;
    }
    if (parsed !== undefined && parsed > remaining) {
      setError(`That's more than the ${remainingLabel} still left to refund.`);
      return;
    }

    // The server re-checks all of this against the Order row — these
    // checks exist to save a round trip and give a clearer message, not
    // to be trusted.
    if (
      !window.confirm(
        `Send ${parsed === undefined ? remainingLabel : `${currency} ${parsed}`} back to the customer? This cannot be undone.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(parsed !== undefined ? { amount: parsed } : {}),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data?.detail ? `${data.error}: ${data.detail}` : (data?.error ?? "Refund failed."));
          return;
        }

        setIsOpen(false);
        setAmount("");
        setReason("");
        // Re-renders the server component so the badge, the totals and the
        // refund history below all come back from the database rather than
        // being patched up client-side.
        router.refresh();
      } catch {
        setError("Something went wrong. Check Stripe before trying again.");
      }
    });
  }

  return (
    <div className="border border-gray-200 rounded-md p-4 bg-white mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Refund</h2>
          <p className="text-xs text-gray-400 mt-1">
            Charged {chargedLabel}
            {refundedLabel ? ` · ${refundedLabel} already refunded` : ""} ·{" "}
            <span className="text-gray-600">{remainingLabel} refundable</span>
          </p>
        </div>

        {canRefund && !isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-xs font-semibold border border-[#FF4C15] text-[#FF4C15] px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors shrink-0"
          >
            Issue refund
          </button>
        )}
      </div>

      {!canRefund && blockedReason && <p className="text-xs text-gray-400">{blockedReason}</p>}

      {canRefund && isOpen && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(remaining)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">Blank refunds everything.</p>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="e.g. Wrong dish sent, customer called"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Stored on the refund record — worth writing for disputes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isPending ? "Refunding…" : "Confirm refund"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setError(null);
              }}
              className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
