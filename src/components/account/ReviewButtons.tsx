"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { ReviewDish } from "@/lib/customer-reviews";
import ReviewDialog from "./ReviewDialog";
import { GRADIENT } from "./ui";

/**
 * The buttons on My Reviews (Figma):
 *   • WriteReviewButton  — "Write a Review" on each "Rate Your Recent Orders" row;
 *   • ReviewCardActions  — "Delete" (outline) + "Edit" (gradient) on each review.
 */

type OrderInfo = {
  orderId: string;
  orderLabel: string;
  dishes: ReviewDish[];
};

export function WriteReviewButton({ order }: { order: OrderInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-[42px] shrink-0 items-center justify-center rounded-full ${GRADIENT} px-5 font-sora text-[14px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:h-[46px] md:text-[16px]`}
      >
        Write a Review
      </button>
      <ReviewDialog
        open={open}
        mode="write"
        orderId={order.orderId}
        orderLabel={order.orderLabel}
        dishes={order.dishes}
        initialRatings={{}}
        initialComment=""
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

export function ReviewCardActions({
  order,
  reviewId,
  ratings,
  comment,
}: {
  /** null = a single dish rating without an order: Delete only. */
  order: OrderInfo | null;
  reviewId: string | null;
  ratings: Record<string, number>;
  comment: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order ? { orderId: order.orderId } : { reviewId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't delete this review. Please try again.");
        return;
      }
      toast.success("Review deleted");
      setConfirming(false);
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 self-end">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-10 min-w-[83px] items-center justify-center rounded-full border border-black px-4 font-sora text-[12px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Delete
        </button>
        {order && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`inline-flex h-10 min-w-[83px] items-center justify-center rounded-full ${GRADIENT} px-4 font-sora text-[12px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
          >
            Edit
          </button>
        )}
      </div>

      {order && (
        <ReviewDialog
          open={editing}
          mode="edit"
          orderId={order.orderId}
          orderLabel={order.orderLabel}
          dishes={order.dishes}
          initialRatings={ratings}
          initialComment={comment}
          onClose={() => setEditing(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this review?"
        message="Your stars and comment will be removed, and it won't show on the site any more. You can write a new review later."
        confirmLabel="Delete"
        pending={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
