"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ReviewStatusBadge from "./ReviewStatusBadge";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export default function ReviewActions({
  reviewId,
  initialStatus,
}: {
  reviewId: string;
  initialStatus: ReviewStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  function updateStatus(newStatus: ReviewStatus) {
    const prevStatus = status;
    setStatus(newStatus); // optimistic update

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) throw new Error("Failed to update review status");

        toast.success(
          newStatus === "APPROVED" ? "Review approved" : "Review rejected"
        );
        router.refresh(); // resync list (removes row if filtered by a different status tab)
      } catch {
        setStatus(prevStatus); // revert on failure
        toast.error("Couldn't update the review. Please try again.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete review");

        toast.success("Review deleted");
        router.refresh();
      } catch {
        toast.error("Couldn't delete the review. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <ReviewStatusBadge status={status} />

      {status !== "APPROVED" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("APPROVED")}
          className="text-xs font-medium text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          Approve
        </button>
      )}

      {status !== "REJECTED" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("REJECTED")}
          className="text-xs font-medium text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className="text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}