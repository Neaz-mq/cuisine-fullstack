"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import type { ReviewDish, ReviewRider } from "@/lib/customer-reviews";
import { GRADIENT } from "./ui";

/**
 * My Reviews → "Write a Review" / "Edit": rate each dish of the order and
 * write a few words — without leaving the page.
 *
 * Sends to the same endpoint as the pop-up on the tracking page
 * (POST /api/orders/[id]/review), so the rules are identical: ratings go
 * to the restaurant for approval first, and an edited review is checked
 * again before it goes public.
 */

const STAR_PATH =
  "M12 2.5l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.33l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.5Z";

const BUTTON =
  "inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-sora text-[15px] font-semibold leading-[1.3] transition focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]";

export default function ReviewDialog({
  open,
  mode,
  orderId,
  orderLabel,
  dishes,
  initialRatings,
  initialComment,
  rider = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "write" | "edit";
  orderId: string;
  orderLabel: string;
  dishes: ReviewDish[];
  initialRatings: Record<string, number>;
  initialComment: string;
  /** Restaurant's own rider delivered it: "Rate your rider" stars. */
  rider?: ReviewRider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const [comment, setComment] = useState(initialComment);
  const [riderRating, setRiderRating] = useState(rider?.rating ?? 0);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Each time it opens, start from what's saved (render-time reset, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRatings(initialRatings);
      setComment(initialComment);
      setRiderRating(rider?.rating ?? 0);
    }
  }

  // Escape closes; the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const rated = Object.entries(ratings).filter(([, value]) => value >= 1);
  const trimmed = comment.trim();
  const clearComment = mode === "edit" && initialComment.trim() !== "" && trimmed === "";
  const canSave = trimmed.length > 0 || rated.length > 0 || riderRating > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: trimmed,
          ratings: rated.map(([menuItemId, rating]) => ({ menuItemId, rating })),
          clearComment,
          // Only when it changed — re-sending the same stars would tell
          // the rider they were rated again.
          ...(rider && riderRating > 0 && riderRating !== rider.rating ? { riderRating } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't save your review. Please try again.");
        return;
      }
      toast.success(mode === "edit" ? "Your review is updated" : "Thanks for your review!");
      onSaved();
      onClose();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
    >
      <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-[603px] flex-col gap-5 overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:rounded-[30px] md:p-[30px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="review-dialog-title"
              className="font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
            >
              {mode === "edit" ? "Edit Your Review" : "Write a Review"}
            </h2>
            <p className="mt-2 font-sora text-[13px] text-black/70 md:text-[14px]">{orderLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-frank-ruhl text-[16px] font-medium text-black">Rate your dishes</p>
          <ul className="flex flex-col gap-2">
            {dishes.map((dish) => {
              const current = ratings[dish.menuItemId] ?? 0;
              return (
                <li
                  key={dish.menuItemId}
                  className="flex flex-col gap-2 rounded-[16px] bg-[#F9F6F3] p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {dish.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small thumbnail from any allowed host
                      <img src={dish.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-[8px] object-cover" />
                    ) : (
                      <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-[8px] bg-white" />
                    )}
                    <span className="min-w-0 break-words font-sora text-[14px] font-medium leading-[1.3] text-black">
                      {dish.title}
                    </span>
                  </span>
                  <div role="radiogroup" aria-label={`Rate ${dish.title}`} className="flex shrink-0 items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={current === value}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        onClick={() => setRatings((prev) => ({ ...prev, [dish.menuItemId]: value }))}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill={value <= current ? "#FF9540" : "none"}
                          stroke="#FF9540"
                          strokeWidth={1.5}
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d={STAR_PATH} />
                        </svg>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {rider && (
          <div className="flex flex-col gap-3">
            <p className="font-frank-ruhl text-[16px] font-medium text-black">Rate your rider</p>
            <div className="flex flex-col gap-2 rounded-[16px] bg-[#F9F6F3] p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <span className="min-w-0 break-words font-sora text-[14px] font-medium leading-[1.3] text-black">
                {rider.name}
                <span className="block font-normal text-black/60">Brought your order</span>
              </span>
              <div role="radiogroup" aria-label={`Rate ${rider.name}`} className="flex shrink-0 items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={riderRating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onClick={() => setRiderRating(value)}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill={value <= riderRating ? "#FF9540" : "none"}
                      stroke="#FF9540"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={STAR_PATH} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-frank-ruhl text-[16px] font-medium text-black">Your review</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="What did you love? How was the delivery?"
            className="h-[121px] w-full resize-none rounded-[12px] bg-[#F9F6F3] p-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[14px]"
          />
          <span className="font-sora text-[11px] text-black/50">
            New and edited reviews are checked by the restaurant before they appear on the site.
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${BUTTON} border border-black text-black hover:bg-black hover:text-white`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !canSave}
            className={`${BUTTON} ${GRADIENT} text-white hover:opacity-90`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : mode === "edit" ? "Save Change" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
