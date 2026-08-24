"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Upload } from "lucide-react";

/**
 * src/components/admin/dashboard/ExportReportButton.tsx
 *
 * পর্দায় যে ছাঁকনি বসানো আছে (?q= / ?period=), হুবহু সেটাই API-তে
 * পাঠিয়ে CSV নামায়।
 *
 * সাধারণ <a download> হলে সহজ হতো, কিন্তু তাতে দুটো জিনিস হারাত: API
 * error (429 rate limit, 403 scope) নীরবে একটা ভাঙা ফাইল হয়ে নামত, আর
 * বড় export-এ কোনো "চলছে" ইঙ্গিত থাকত না। তাই fetch → blob → অস্থায়ী
 * link।
 */
export default function ExportReportButton() {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setError(null);

    let objectUrl: string | null = null;
    try {
      const params = new URLSearchParams();
      const q = searchParams.get("q");
      const period = searchParams.get("period");
      if (q) params.set("q", q);
      if (period) params.set("period", period);

      const res = await fetch(`/api/admin/insights/export?${params}`);

      if (!res.ok) {
        // Error গুলো JSON, সফল উত্তরটা CSV — তাই এখানেই আলাদা করে পড়া।
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Export failed. Please try again.");
      }

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);

      // Server-এর দেওয়া filename-টা Content-Disposition থেকে নেওয়া, যাতে
      // নামের নিয়ম এক জায়গাতেই (route-এ) থাকে।
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = match?.[1] ?? "cuisine-orders.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      // revokeObjectURL না করলে blob-টা tab বন্ধ না হওয়া পর্যন্ত
      // মেমরিতে বসে থাকে — বড় export বারবার করলে সেটা জমতে থাকে।
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-[#121212] px-5 py-3 font-sora text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        )}
        {busy ? "Exporting…" : "Export Report"}
      </button>

      {error && (
        <p role="alert" className="font-sora text-[12px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}