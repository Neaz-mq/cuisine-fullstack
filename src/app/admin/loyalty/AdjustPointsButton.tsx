"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { FIELD, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, PRIMARY_BUTTON } from "@/components/admin/modal-ui";

/**
 * "Adjust" on a member row — add or take away points by hand (a goodwill
 * gesture, a missed order, a correction). Every change is written to the
 * customer's points history with the reason, and the balance can't go
 * below 0 (the API refuses it).
 */
export default function AdjustPointsButton({
  userId,
  name,
  points,
}: {
  userId: string;
  name: string;
  points: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const valid = Number.isInteger(value) && value > 0;
  const delta = valid ? (mode === "add" ? value : -value) : 0;
  const after = points + delta;

  const reset = () => {
    setOpen(false);
    setMode("add");
    setAmount("");
    setNote("");
    setError(null);
  };

  const close = () => {
    if (!saving) reset();
  };

  const save = async () => {
    if (!valid) {
      setError("Enter a whole number of points, more than 0.");
      return;
    }
    if (after < 0) {
      setError(`${name} only has ${points.toLocaleString("en-US")} points.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/loyalty/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, points: delta, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't adjust points. Please try again.");
        return;
      }
      toast.success(`${delta > 0 ? "Added" : "Deducted"} ${Math.abs(delta)} points`);
      reset();
      router.refresh();
    } catch {
      setError("Couldn't adjust points. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const tab = (active: boolean) =>
    `flex h-[38px] flex-1 items-center justify-center rounded-full font-sora text-[13px] font-semibold transition-colors ${
      active ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.05]"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 shrink-0 items-center justify-center rounded-full border border-black px-3 font-sora text-[12px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        Adjust
      </button>

      <ModalShell
        open={open}
        onClose={close}
        title="Adjust Points"
        titleId={`adjust-points-${userId}`}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={saving} className={`${OUTLINE_BUTTON} flex-1`}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className={`${PRIMARY_BUTTON} flex-1`}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />}
              {saving ? "Saving…" : "Save Change"}
            </button>
          </div>
        }
      >
        <p className="font-sora text-[13px] leading-[1.6] text-black/70">
          <span className="font-semibold text-black">{name}</span> has{" "}
          <span className="font-semibold text-black">{points.toLocaleString("en-US")}</span> points.
        </p>

        <div className="flex gap-1 rounded-full bg-[#F9F6F3] p-1" role="group" aria-label="Add or deduct">
          <button type="button" className={tab(mode === "add")} aria-pressed={mode === "add"} onClick={() => setMode("add")}>
            Add points
          </button>
          <button
            type="button"
            className={tab(mode === "deduct")}
            aria-pressed={mode === "deduct"}
            onClick={() => setMode("deduct")}
          >
            Deduct points
          </button>
        </div>

        <div className="grid gap-4 min-[560px]:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`adjust-amount-${userId}`} className={LABEL}>
              Points
            </label>
            <input
              id={`adjust-amount-${userId}`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="20"
              className={FIELD}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={`adjust-note-${userId}`} className={LABEL}>
              Reason
            </label>
            <input
              id={`adjust-note-${userId}`}
              type="text"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Sorry for the late delivery"
              className={FIELD}
            />
          </div>
        </div>

        {valid && (
          <p className={`font-sora text-[12px] leading-[1.6] ${after < 0 ? "text-[#D72A37]" : "text-black/70"}`}>
            New balance: <span className="font-semibold">{after.toLocaleString("en-US")} points</span>
          </p>
        )}

        {error && <ModalError message={error} />}
      </ModalShell>
    </>
  );
}
