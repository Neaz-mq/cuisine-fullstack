"use client";

import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

/**
 * src/components/admin/BusinessSummaryCard.tsx
 *
 * Renders on the admin dashboard (src/app/admin/page.tsx). Generated on
 * demand rather than automatically on every dashboard load — see the
 * comment in the API route (src/app/api/admin/insights/summary/route.ts)
 * for why. Nothing is persisted: the summary lives only in this
 * component's state, so it disappears on refresh and the owner clicks
 * "Generate" again next time they want one. That's a deliberate v1
 * simplification (no new DB table / caching layer yet), not an
 * oversight — worth revisiting if this gets used often enough that
 * re-generating every visit feels wasteful.
 */
export default function BusinessSummaryCard() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/insights/summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't generate a summary right now.");
        return;
      }
      setSummary(data.summary);
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-md p-5 bg-white mb-8">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#2C6252]" />
          AI Business Summary
        </h3>
        {summary && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs text-[#2C6252] font-medium hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        )}
      </div>

      {!summary ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            Get a plain-English summary of this week&apos;s performance.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="shrink-0 bg-[#2C6252] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#234f42] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed mt-3">{summary}</p>
      )}
    </div>
  );
}