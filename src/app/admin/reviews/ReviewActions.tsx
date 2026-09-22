"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  TEXTAREA,
} from "@/components/admin/modal-ui";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * The two buttons on the right of each review row. Figma: an outline pill
 * (black border, 50px) and a filled red pill, 12px apart.
 *
 *   PENDING  → Accept · Reject
 *   APPROVED → Reply  · Delete
 *   REJECTED → Accept · Delete
 *
 * "Reply" opens a small form right here; the app emails the answer to the
 * customer from Cuisine's own address (POST /api/admin/reviews/[id]/reply,
 * through Resend). It used to be a `mailto:` link, which on most staff PCs
 * opened an Outlook that was never set up. Only shown when the customer
 * has an email address.
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
  rating,
  comment,
}: {
  reviewId: string;
  status: ReviewStatus;
  customerName: string;
  customerEmail: string | null;
  itemTitle: string;
  /** Shown in the Reply form so staff can see what they're answering. */
  rating: number;
  comment: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Which button is busy, so only that one shows the spinner.
  const [busy, setBusy] = useState<"accept" | "reject" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function sendReply() {
    const message = replyText.trim();
    if (!message || replySending) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Couldn't send the reply (error ${res.status}).`);

      toast.success(`Reply sent to ${data.sentTo ?? customerName}`);
      setReplyOpen(false);
      setReplyText("");
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Couldn't send the reply.");
    } finally {
      setReplySending(false);
    }
  }

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


  return (
    <div className="flex w-full items-center gap-3 md:w-auto md:justify-end">
      {status === "APPROVED" ? (
        customerEmail && (
          <button
            type="button"
            onClick={() => {
              setReplyError(null);
              setReplyOpen(true);
            }}
            className={OUTLINE}
          >
            Reply
          </button>
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

      <ModalShell
        open={replyOpen}
        onClose={() => {
          if (!replySending) setReplyOpen(false);
        }}
        title="Reply to Review"
        titleId={`reply-title-${reviewId}`}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReplyOpen(false)}
              disabled={replySending}
              className={`${OUTLINE_BUTTON} flex-1`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sendReply}
              disabled={replySending || replyText.trim().length === 0}
              className={`${PRIMARY_BUTTON} flex-1`}
            >
              {replySending && spinner}
              {replySending ? "Sending…" : "Send Reply"}
            </button>
          </div>
        }
      >
        {/* What they wrote, so staff answer the right thing. */}
        <div className="flex flex-col gap-2 rounded-[12px] bg-[#F9F6F3] p-4">
          <p className="font-sora text-[12px] leading-[1.4] text-black/70">
            {customerName} · {itemTitle}
          </p>
          <p
            className="font-sora text-[16px] leading-none tracking-[2px] text-[#FF9540]"
            aria-label={`${rating} out of 5 stars`}
          >
            {"★".repeat(rating)}
            <span className="text-[#FF9540]/30">{"★".repeat(5 - rating)}</span>
          </p>
          {comment && (
            <p className="break-words font-sora text-[13px] italic leading-[1.5] text-black">
              “{comment}”
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`reply-text-${reviewId}`} className={LABEL}>
            Your reply
          </label>
          <textarea
            id={`reply-text-${reviewId}`}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder={`Hi ${customerName.split(" ")[0]}, thank you for your review…`}
            className={TEXTAREA}
          />
          <p className="mt-1.5 font-sora text-[12px] leading-[1.4] text-black/70">
            Sent by email to <span className="text-black">{customerEmail}</span> from Cuisine.
          </p>
        </div>

        {replyError && <ModalError message={replyError} />}
      </ModalShell>

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
