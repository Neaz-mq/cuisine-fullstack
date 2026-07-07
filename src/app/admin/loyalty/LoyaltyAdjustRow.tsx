"use client";

import { useState, useTransition } from "react";
import { toast } from "react-toastify";

export default function LoyaltyAdjustRow({
  userId,
  name,
  email,
  initialPoints,
}: {
  userId: string;
  name: string | null;
  email: string;
  initialPoints: number;
}) {
  const [points, setPoints] = useState(initialPoints);
  const [isOpen, setIsOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdjust(e: React.FormEvent) {
    e.preventDefault();

    const deltaValue = Number(delta);
    if (!Number.isInteger(deltaValue) || deltaValue === 0) {
      toast.error("Enter a non-zero whole number (use a minus sign to deduct).");
      return;
    }

    const prevPoints = points;
    setPoints((p) => p + deltaValue); // optimistic

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/loyalty/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, points: deltaValue, note: note.trim() || undefined }),
        });
        if (!res.ok) throw new Error("Failed to adjust points");

        toast.success(`${deltaValue > 0 ? "Added" : "Deducted"} ${Math.abs(deltaValue)} points`);
        setDelta("");
        setNote("");
        setIsOpen(false);
      } catch {
        setPoints(prevPoints); // revert
        toast.error("Couldn't adjust points. Please try again.");
      }
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{name ?? email}</p>
          <p className="text-xs text-gray-400">{email}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-[#FF4C15]">{points} pts</span>
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
          >
            {isOpen ? "Cancel" : "Adjust"}
          </button>
        </div>
      </div>

      {isOpen && (
        <form onSubmit={handleAdjust} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 20 or -10"
            className="w-32 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF4C15]/30 focus:border-[#FF4C15]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 min-w-[160px] px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF4C15]/30 focus:border-[#FF4C15]"
          />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-semibold bg-[#FF4C15] text-white px-3 py-1.5 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}