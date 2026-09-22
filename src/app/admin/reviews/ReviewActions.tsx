"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * The two buttons on the right of each review row. Figma: an outline pill
 * (black border, 50px) and a filled red pill, 12px apart.
 *
 *   PENDING  → Accept · Reject
 *   APPROVED → Reply  · Delete
 *   REJECTED → Accept · Delete
 *
 * "Reply" opens the staff member's own email app with the customer's
 * address and a subject line filled in — reviews have no reply field in
 * the database, and an email is how the customer actually gets an answer.
 * It is only shown when the customer has an email address.
 */
const OUTLINE =
  "flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-black px-4 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black/[0.04] disabled:opacity-50 md:flex-none xl:h-[50px] xl:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";
const DANGER =
  "flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#D72A37] px-4 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:flex-none xl:h-[50px] xl:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function ReviewActions({
  reviewId,
  status,
  customerName,
  customerEmail,
  itemTitle,
}: {
  reviewId: string;
  status: ReviewStatus;
  customerName: string;
  customerEmail: string | null;
  itemTitle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Which button is busy, so only that one shows the spinner.
  const [busy, setBusy] = useState<"accept" | "reject" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function updateStatus(next: "APPROVED" | "REJECTED") {
    setBusy(next === "APPROVED" ? "accept" : "reject");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error("Failed to update review status");

        toast.success(next === "APPROVED" ? "Review accepted" : "Review rejected");
        // Re-reads the list, the status pill and the Overview numbers.
        router.refresh();
      } catch {
        toast.error("Couldn't update the review. Please try again.");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleDelete() {
    setBusy("delete");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete review");

        toast.success("Review deleted");
        setConfirmingDelete(false);
        router.refresh();
      } catch {
        toast.error("Couldn't delete the review. Please try again.");
      } finally {
        setBusy(null);
      }
    });
  }

  const spinner = <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />;

  const replyHref = customerEmail
    ? `mailto:${customerEmail}?subject=${encodeURIComponent(
        `About your review of ${itemTitle}`
      )}&body=${encodeURIComponent(`Hi ${customerName},\n\nThank you for your review of ${itemTitle}.\n\n`)}`
    : null;

  return (
    <div className="flex w-full items-center gap-3 md:w-auto md:justify-end">
      {status === "APPROVED" ? (
        replyHref && (
          <a href={replyHref} className={OUTLINE}>
            Reply
          </a>
        )
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("APPROVED")}
          className={OUTLINE}
        >
          {busy === "accept" && spinner}
          Accept
        </button>
      )}

      {status === "PENDING" ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("REJECTED")}
          className={DANGER}
        >
          {busy === "reject" && spinner}
          Reject
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirmingDelete(true)}
          className={DANGER}
        >
          Delete
        </button>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this review?"
        message={`${customerName}'s review of ${itemTitle} will be removed for good. This can't be undone.`}
        confirmLabel="Delete"
        pending={busy === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
