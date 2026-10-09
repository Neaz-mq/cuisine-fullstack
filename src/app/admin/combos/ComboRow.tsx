"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { ComboStatus, ComboStatusKind } from "@/lib/combo-pricing";
import ComboFormModal, { type MenuOption } from "./ComboFormModal";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

const PILL: Record<ComboStatusKind, string> = {
  live: "bg-[#E4F4E8] text-[#1E7B3A]",
  waiting: "bg-[#FFF0DC] text-[#A85A00]",
  hidden: "bg-black/[0.07] text-black/70",
  unavailable: "bg-[#FAE7EC] text-[#D72A37]",
};

export type ComboRowData = {
  id: string;
  name: string;
  description: string;
  /** The combo's own photo (null = falls back to an item's photo on the home page). */
  imageUrl: string | null;
  /** What to show as the thumbnail here: own photo, else first item's. */
  thumb: string | null;
  isActive: boolean;
  discountPercent: number;
  sortOrder: number;
  items: { menuItemId: string; title: string; quantity: number }[];
  /** Items added up at menu prices, after the combo discount. */
  totalLabel: string;
  status: ComboStatus;
};

const BUTTON =
  "flex h-10 flex-1 items-center justify-center rounded-full px-4 font-sora text-[14px] font-normal leading-none transition-colors disabled:opacity-50 md:h-[50px] md:flex-none md:text-[16px]";

export default function ComboRow({
  combo,
  menuOptions,
}: {
  combo: ComboRowData;
  menuOptions: MenuOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request(method: "PATCH" | "DELETE", body?: unknown): Promise<string | null> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/combos/${combo.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error ?? "Something went wrong. Please try again.";
      }
      router.refresh();
      return null;
    } catch {
      return "Couldn't reach the server. Check your connection and try again.";
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    const error = await request("PATCH", { isActive: !combo.isActive });
    if (error) toast.error(error);
    else toast.success(combo.isActive ? `"${combo.name}" hidden.` : `"${combo.name}" is now shown.`);
  }

  async function handleDelete() {
    const error = await request("DELETE");
    setConfirmingDelete(false);
    if (error) toast.error(error);
    else toast.success(`"${combo.name}" deleted.`);
  }

  const summary = combo.items
    .map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.title}` : i.title))
    .join(", ");

  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white md:h-[78px] md:w-[78px]">
          {combo.thumb ? (
            <Image src={combo.thumb} alt="" fill unoptimized sizes="78px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-black/20 md:h-6 md:w-6" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-frank-ruhl text-[17px] font-medium leading-[1.25] text-[#141921] md:text-[20px]">
              {combo.name}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-1 font-sora text-[11px] leading-none ${PILL[combo.status.kind]}`}
            >
              {combo.status.label}
            </span>
          </div>

          <p className="line-clamp-2 font-sora text-[12px] leading-[1.7] text-black/70">{summary}</p>

          <p className="font-sora text-[12px] leading-[1.5] text-black">
            <span className="font-semibold">{combo.totalLabel}</span>
            <span className="text-black/60">
              {combo.discountPercent > 0
                ? ` after ${combo.discountPercent}% combo discount`
                : " at menu prices, no discount"}
              {` · order ${combo.sortOrder}`}
            </span>
          </p>

          {combo.status.detail && (
            <p className="font-sora text-[12px] leading-[1.5] text-black/60">{combo.status.detail}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap md:gap-3">
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy}
          className={`${BUTTON} border border-black/70 text-black/70 hover:border-black hover:text-black ${FOCUS_RING}`}
        >
          {combo.isActive ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className={`${BUTTON} border border-black text-black hover:bg-black hover:text-white ${FOCUS_RING}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className={`${BUTTON} bg-[#D72A37] text-white hover:opacity-90 ${FOCUS_RING}`}
        >
          Delete
        </button>
      </div>

      <ComboFormModal
        open={editing}
        onClose={() => setEditing(false)}
        menuOptions={menuOptions}
        combo={combo}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${combo.name}"?`}
        message="The combo is removed from the home page. The menu items inside it are not deleted."
        confirmLabel="Delete combo"
        pending={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}