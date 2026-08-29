"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Upload } from "lucide-react";

/**
 * src/components/admin/dashboard/ExportReportButton.tsx
 *
 * পর্দায় যে ছাঁকনি বসানো আছে, হুবহু সেটাই API-তে পাঠিয়ে CSV নামায়।
 *
 * সাধারণ <a download> হলে সহজ হতো, কিন্তু তাতে দুটো জিনিস হারাত: API
 * error (429 rate limit, 403 scope) নীরবে একটা ভাঙা ফাইল হয়ে নামত, আর
 * বড় export-এ কোনো "চলছে" ইঙ্গিত থাকত না। তাই fetch → blob → অস্থায়ী
 * link।
 *
 * ⚠️ কোন route, আর কোন parameter গুলো সাথে যাবে — দুটোই এখন prop,
 * হার্ডকোড নয়। Dashboard আর /admin/users দুই পাতাতেই বোতামটা একই
 * দেখতে, কিন্তু একটা order-এর হিসাব নামায় আর অন্যটা গ্রাহকের তালিকা।
 * ডিফল্ট মানগুলো dashboard-এর, তাই সেখানে `<ExportReportButton />`
 * আগের মতোই কাজ করে।
 *
 * parameter-এর তালিকাটা ইচ্ছাকৃতভাবে সাদা-তালিকা — পুরো URL তুলে
 * পাঠানো হয় না। নাহলে এক পাতার `?page=3` বা `?revenue=month` API-তে
 * চলে যেত, আর route সেগুলো চেনে না বলে নীরবে অগ্রাহ্য করত — কিন্তু
 * সেই নীরবতাটাই বিপদ: কেউ ধরে নিতেন page ৩-এর দশটা সারি নামছে।
 */
export default function ExportReportButton({
  endpoint = "/api/admin/insights/export",
  forwardParams = ["q", "period"],
  fallbackFilename = "cuisine-orders.csv",
}: {
  endpoint?: string;
  forwardParams?: string[];
  /** Server যদি Content-Disposition না পাঠায় তবেই ব্যবহার হয়। */
  fallbackFilename?: string;
}) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setError(null);

    let objectUrl: string | null = null;
    try {
      const params = new URLSearchParams();
      forwardParams.forEach((key) => {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
      });

      const res = await fetch(`${endpoint}?${params}`);

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
      link.download = match?.[1] ?? fallbackFilename;
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
        // h-11 — পাশের তারিখ-pill-ও ৪৪px, তাই দুটোর উপর-নিচ একসারিতে
        // পড়ে। আগে `py-3` ছিল, যেটা ~৪৬px দিত আর বোতামটা এক-দুই পিক্সেল
        // নিচে ঝুলে থাকত। whitespace-nowrap: সরু পর্দায় "Export Report"
        // দু'লাইনে ভাঙলে বোতামটা লম্বা হয়ে যেত।
        className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#121212] px-5 font-sora text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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