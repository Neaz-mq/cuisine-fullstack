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

/**
 * Figma "Customer Ranking" card — the tiers.
 *
 * A ranking only needs the points it starts at; it runs up to where the
 * next one starts ("0–199 Points"), and the top one has no ceiling
 * ("1,000+ Points"). That way rankings can never overlap or leave a gap —
 * the classic problem with typing both ends of every range.
 *
 * Perks (optional): an automatic % off every order, and a % bonus on
 * points earned. The starting ranking (0 points) always exists and can't
 * be deleted; everyone lands there first.
 */
export type TierView = {
  id: string;
  name: string;
  minPoints: number;
  discountPercent: number;
  bonusPercent: number;
  rangeLabel: string;
  members: number;
};

const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
const ADD_BUTTON =
  "flex h-8 shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const SMALL_OUTLINE =
  "flex h-8 shrink-0 items-center justify-center rounded-full border border-black px-3 font-sora text-[12px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

function perksText(tier: Pick<TierView, "discountPercent" | "bonusPercent">): string {
  const parts: string[] = [];
  if (tier.discountPercent > 0) parts.push(`${tier.discountPercent}% off every order`);
  if (tier.bonusPercent > 0) parts.push(`${tier.bonusPercent}% bonus points`);
  return parts.length ? parts.join(" · ") : "No extra perks";
}

export default function RankingSection({ tiers, canManage }: { tiers: TierView[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TierView | "new" | null>(null);

  return (
    <section className="flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className={CARD_TITLE}>Customer Ranking</h2>
        {canManage && (
          <button type="button" onClick={() => setEditing("new")} className={ADD_BUTTON}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-4">
        {tiers.map((tier) => (
          <li
            key={tier.id}
            className="flex min-w-0 flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-frank-ruhl text-[16px] font-semibold leading-tight text-black min-[480px]:text-[18px]">
                {tier.name}
              </p>
              <p className="mt-1 font-sora text-[11px] leading-[1.5] text-black/60">
                {perksText(tier)} · {tier.members.toLocaleString("en-US")}{" "}
                {tier.members === 1 ? "member" : "members"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex h-8 items-center whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black">
                {tier.rangeLabel}
              </span>
              {canManage && (
                <button type="button" onClick={() => setEditing(tier)} className={SMALL_OUTLINE}>
                  Edit
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <TierModal
          tier={editing === "new" ? null : editing}
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

/** Figma "Add Customer Ranking": Ranking Name + Point, plus optional perks. */
function TierModal({
  tier,
  onClose,
  onSaved,
}: {
  tier: TierView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isBase = tier?.minPoints === 0;
  const [name, setName] = useState(tier?.name ?? "");
  const [minPoints, setMinPoints] = useState(tier ? String(tier.minPoints) : "");
  const [discount, setDiscount] = useState(tier ? String(tier.discountPercent) : "0");
  const [bonus, setBonus] = useState(tier ? String(tier.bonusPercent) : "0");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (!saving && !deleting) onClose();
  };

  const wholeNumber = (value: string) => value.trim() !== "" && Number.isInteger(Number(value)) && Number(value) >= 0;

  const save = async () => {
    if (!name.trim()) return setError("Enter a ranking name.");
    if (!wholeNumber(minPoints)) return setError("Enter the points this ranking starts at (a whole number).");
    if (!isBase && Number(minPoints) === 0) {
      return setError("0 points is the starting ranking. Pick a higher number.");
    }
    if (!wholeNumber(discount) || Number(discount) > 50) return setError("Discount must be 0–50%.");
    if (!wholeNumber(bonus) || Number(bonus) > 300) return setError("Bonus points must be 0–300%.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(tier ? `/api/admin/loyalty/tiers/${tier.id}` : "/api/admin/loyalty/tiers", {
        method: tier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          minPoints: Number(minPoints),
          discountPercent: Number(discount),
          bonusPercent: Number(bonus),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save this ranking.");
        return;
      }
      toast.success(tier ? "Ranking updated" : "Ranking added");
      onSaved();
    } catch {
      setError("Couldn't save this ranking.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!tier) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/loyalty/tiers/${tier.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfirmDelete(false);
        setError(data?.error ?? "Couldn't delete this ranking.");
        return;
      }
      toast.success("Ranking deleted");
      onSaved();
    } catch {
      setError("Couldn't delete this ranking.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ModalShell
        open
        onClose={close}
        title={tier ? "Edit Customer Ranking" : "Add Customer Ranking"}
        titleId="tier-modal-title"
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
            <label htmlFor="tier-name" className={LABEL}>
              Ranking Name
            </label>
            <input
              id="tier-name"
              type="text"
              maxLength={30}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VVIP Customer"
              className={FIELD}
              autoFocus
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="tier-points" className={LABEL}>
              Point
            </label>
            <input
              id="tier-points"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={minPoints}
              onChange={(event) => setMinPoints(event.target.value)}
              placeholder="300"
              disabled={isBase}
              className={`${FIELD} disabled:cursor-not-allowed disabled:text-black/50`}
            />
          </div>
        </div>
        <p className="-mt-2 font-sora text-[11px] leading-[1.6] text-black/60">
          {isBase
            ? "The starting ranking — every customer begins here, so it always starts at 0."
            : "Points needed to reach this ranking. It lasts until the next ranking starts."}
        </p>

        <div className="grid grid-cols-2 gap-4 min-[640px]:gap-6">
          <div className="min-w-0">
            <label htmlFor="tier-discount" className={LABEL}>
              Discount (%)
            </label>
            <input
              id="tier-discount"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              step={1}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              placeholder="0"
              className={FIELD}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="tier-bonus" className={LABEL}>
              Bonus Points (%)
            </label>
            <input
              id="tier-bonus"
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              step={1}
              value={bonus}
              onChange={(event) => setBonus(event.target.value)}
              placeholder="0"
              className={FIELD}
            />
          </div>
        </div>
        <p className="-mt-2 font-sora text-[11px] leading-[1.6] text-black/60">
          Optional perks: an automatic discount on every order, and extra points on what they earn.
        </p>

        {error && <ModalError message={error} />}

        {tier && !isBase && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="self-start font-sora text-[12px] font-semibold text-[#D72A37] hover:underline"
          >
            Delete this ranking
          </button>
        )}
      </ModalShell>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${tier?.name ?? ""}"?`}
        message={
          tier && tier.members > 0
            ? `${tier.members} ${tier.members === 1 ? "customer moves" : "customers move"} to the ranking below. Their points don't change.`
            : "No customer is in this ranking right now."
        }
        confirmLabel="Delete"
        tone="danger"
        pending={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
