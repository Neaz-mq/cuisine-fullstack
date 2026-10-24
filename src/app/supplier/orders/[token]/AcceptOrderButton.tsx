"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * The one button on the supplier's order page. Accepting is a POST (never a
 * GET on page load) so an email scanner opening the link can't accept the
 * order — see app/api/supplier/orders/[token]/accept/route.ts.
 *
 * After a successful accept the page re-renders (router.refresh) and shows the
 * "You accepted this order" note instead of this button.
 */
export default function AcceptOrderButton({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/supplier/orders/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      // Keep the spinner until the refreshed page replaces this button.
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-[1.7] text-black/70">
        Press the button if you can deliver this order. Cuisine is told straight away.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 text-[13px] leading-[1.6] text-[#D72A37]"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={accept}
        disabled={submitting}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[16px] font-normal leading-none text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitting ? "Accepting…" : "Accept order"}
      </button>
    </div>
  );
}
