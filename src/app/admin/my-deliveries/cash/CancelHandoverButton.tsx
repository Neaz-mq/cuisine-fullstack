"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Rider takes back a hand-in report the restaurant hasn't confirmed yet. */
export default function CancelHandoverButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const cancel = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rider/cash-handovers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't cancel this report.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="flex h-8 items-center gap-1.5 rounded-full border border-black/15 px-3 font-sora text-[12px] text-black transition-colors hover:border-[#D72A37] hover:text-[#D72A37] disabled:opacity-50 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        Cancel report
      </button>
      {error && <span className="font-sora text-[11px] text-[#D72A37]">{error}</span>}
    </span>
  );
}
