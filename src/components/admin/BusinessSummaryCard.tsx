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

/** Figma-র Primary gradient — sidebar-এর active item আর dashboard-এর
 *  Total Revenue কার্ডে ঠিক এই দুটো stop-ই ব্যবহার হয়। */
const GRADIENT = "bg-gradient-to-r from-[#FF9540] to-[#FF70C6]";

export default function BusinessSummaryCard() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/insights/summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        // model বন্ধ হয়ে যাওয়ার বার্তাটা লম্বা আর নির্দিষ্ট, তাই সেটা
        // যেন কাটা না পড়ে — toast-টা বেশিক্ষণ থাকে।
        toast.error(data.error ?? "Couldn't generate a summary right now.", {
          autoClose: res.status === 503 ? 10000 : undefined,
        });
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
    /**
     * ⚠️ xl/2xl-এর min-height ইচ্ছাকৃত deviation — stat card গুলোর
     * সাথে একই কারণে (দেখুন admin/page.tsx-এর ব্যাখ্যা)। এই কার্ডে
     * সমস্যাটা আরও প্রকট, কারণ এটা পুরো প্রস্থ জুড়ে একা দাঁড়ায়:
     * ১৫০০px চওড়া অথচ ৯০px উঁচু হলে সেটা কার্ড নয়, একটা ফিতে।
     *
     * `flex-col justify-between` — বাড়তি জায়গাটা যাতে শিরোনাম আর
     * নিচের সারির মধ্যে ছড়িয়ে যায়, পুরোটা নিচে না জমে।
     *
     * summary তৈরি হয়ে গেলে লেখাটা নিজেই এর চেয়ে লম্বা হয়ে যায়,
     * তাই তখন min-height-এর আর কোনো ভূমিকা থাকে না — সেটাই চাওয়া।
     */
    <div className="flex flex-col justify-between rounded-[20px] bg-white p-5 md:p-6 xl:min-h-[140px] xl:p-7 2xl:min-h-[160px] 2xl:p-8">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-sora text-[12px] font-semibold uppercase tracking-wide text-gray-500">
          <Sparkles className="h-4 w-4 text-[#FF9540]" aria-hidden="true" />
          AI Business Summary
        </h3>
        {summary && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-1 font-sora text-[12px] font-medium text-[#FF4C15] hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Regenerate
          </button>
        )}
      </div>

      {!summary ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-sora text-[14px] text-gray-400">
            Get a plain-English summary of this week&apos;s performance.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-sora text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${GRADIENT}`}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generating…
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>
      ) : (
        <p className="mt-3 font-sora text-[14px] leading-relaxed text-gray-700">{summary}</p>
      )}
    </div>
  );
}