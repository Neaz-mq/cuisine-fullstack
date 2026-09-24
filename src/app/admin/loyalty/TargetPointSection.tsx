"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
} from "@/components/admin/modal-ui";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { earnSentence, formatSpend } from "@/lib/loyalty-tiers";

/**
 * Figma "Target Point" card — how customers earn points.
 *
 * Each row: "Spend $1,000 on food and earn 10 points as a reward." with
 * Edit and Apply. Only one target is in use at a time — Apply switches to
 * it, and that row shows "Applied" instead. Points are worked out on the
 * food subtotal when an order is delivered, proportionally and rounded
 * down (so $1,000 → 10 means 1 point per $100).
 *
 * Only owner/manager ("settings" scope) see the buttons — the API checks
 * the same thing.
 */
export type EarnRuleView = { id: string; spend: number; points: number; isActive: boolean };

const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
const ADD_BUTTON =
  "flex h-8 shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const SMALL_OUTLINE =
  "flex h-8 shrink-0 items-center justify-center rounded-full border border-black px-3 font-sora text-[12px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const SMALL_PRIMARY =
  "flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** "1 point per $100" — the same rule said the other way round. */
function perPointHint(spend: number, points: number, currency: string): string {
  if (points <= 0 || spend <= 0) return "";
  const perPoint = spend / points;
  return `= 1 point per ${formatSpend(Math.round(perPoint * 100) / 100, currency)} spent`;
}

export default function TargetPointSection({
  rules,
  currency,
  canManage,
}: {
  rules: EarnRuleView[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EarnRuleView | "new" | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const apply = async (rule: EarnRuleView) => {
    setApplying(rule.id);
    try {
      const res = await fetch(`/api/admin/loyalty/earn-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't apply this target.");
        return;
      }
      toast.success("Target applied — new orders earn points this way");
      router.refresh();
    } catch {
      toast.error("Couldn't apply this target.");
    } finally {
      setApplying(null);
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className={CARD_TITLE}>Target Point</h2>
        {canManage && (
          <button type="button" onClick={() => setEditing("new")} className={ADD_BUTTON}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <p className="font-sora text-[14px] leading-[1.5] text-black/70">
          No target yet — customers don&apos;t earn points until one is applied.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex min-w-0 flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
            >
              <div className="min-w-0">
                <p className="font-sora text-[14px] leading-[1.5] text-black">
                  Spend <span className="font-semibold">{formatSpend(rule.spend, currency)}</span> on food and
                  earn <span className="font-semibold">{rule.points.toLocaleString("en-US")}</span>{" "}
                  {rule.points === 1 ? "point" : "points"} as a reward.
                </p>
                <p className="mt-1 font-sora text-[11px] leading-none text-black/50">
                  {perPointHint(rule.spend, rule.points, currency)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canManage && (
                  <button type="button" onClick={() => setEditing(rule)} className={SMALL_OUTLINE}>
                    Edit
                  </button>
                )}
                {rule.isActive ? (
                  <span className="flex h-8 items-center rounded-full bg-[#E8FFEC] px-3 font-sora text-[12px] font-semibold leading-none text-[#0ECF00]">
                    Applied
                  </span>
                ) : (
                  canManage && (
                    <button
                      type="button"
                      onClick={() => apply(rule)}
                      disabled={applying !== null}
                      className={SMALL_PRIMARY}
                    >
                      {applying === rule.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                      )}
                      Apply
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EarnRuleModal
          rule={editing === "new" ? null : editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/** Figma "Add Target Point": Spent + Point, Cancel / Save Change. */
function EarnRuleModal({
  rule,
  currency,
  onClose,
  onSaved,
}: {
  rule: EarnRuleView | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [spend, setSpend] = useState(rule ? String(rule.spend) : "");
  const [points, setPoints] = useState(rule ? String(rule.points) : "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spendValue = Number(spend);
  const pointsValue = Number(points);
  const valid =
    spend.trim() !== "" &&
    points.trim() !== "" &&
    Number.isFinite(spendValue) &&
    spendValue > 0 &&
    Number.isInteger(pointsValue) &&
    pointsValue >= 1;

  const close = () => {
    if (!saving && !deleting) onClose();
  };

  const save = async () => {
    if (!valid) {
      setError("Enter the amount spent (more than 0) and whole points (at least 1).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        rule ? `/api/admin/loyalty/earn-rules/${rule.id}` : "/api/admin/loyalty/earn-rules",
        {
          method: rule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spendAmount: spendValue, points: pointsValue }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save this target.");
        return;
      }
      toast.success(rule ? "Target updated" : "Target added");
      onSaved();
    } catch {
      setError("Couldn't save this target.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!rule) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/loyalty/earn-rules/${rule.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfirmDelete(false);
        setError(data?.error ?? "Couldn't delete this target.");
        return;
      }
      toast.success("Target deleted");
      onSaved();
    } catch {
      setError("Couldn't delete this target.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ModalShell
        open
        onClose={close}
        title={rule ? "Edit Target Point" : "Add Target Point"}
        titleId="earn-rule-modal-title"
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
        <div className="grid grid-cols-2 gap-4 min-[640px]:gap-6">
          <div className="min-w-0">
            <label htmlFor="earn-spend" className={LABEL}>
              Spent
            </label>
            <input
              id="earn-spend"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={spend}
              onChange={(event) => setSpend(event.target.value)}
              placeholder="2500"
              className={FIELD}
              autoFocus
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="earn-points" className={LABEL}>
              Point
            </label>
            <input
              id="earn-points"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              placeholder="25"
              className={FIELD}
            />
          </div>
        </div>

        {valid && (
          <p className="font-sora text-[12px] leading-[1.6] text-black/70">
            {earnSentence(spendValue, pointsValue, currency)} as a reward{" "}
            <span className="text-black/50">({perPointHint(spendValue, pointsValue, currency).slice(2)})</span>.
          </p>
        )}

        {rule?.isActive && (
          <p className="font-sora text-[12px] leading-[1.6] text-black/60">
            This target is in use. A change applies to orders delivered from now on — points already given
            stay as they are.
          </p>
        )}

        {error && <ModalError message={error} />}

        {rule && !rule.isActive && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="self-start font-sora text-[12px] font-semibold text-[#D72A37] hover:underline"
          >
            Delete this target
          </button>
        )}
      </ModalShell>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this target?"
        message="It isn't in use, so no customer is affected."
        confirmLabel="Delete"
        tone="danger"
        pending={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
