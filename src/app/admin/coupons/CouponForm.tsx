"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CouponForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const percentOffNum = Number(percentOff);
    if (!code.trim()) {
      setError("Code is required");
      return;
    }
    if (!Number.isInteger(percentOffNum) || percentOffNum < 1 || percentOffNum > 100) {
      setError("Percent off must be a whole number between 1 and 100");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, percentOff: percentOffNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create coupon");
        return;
      }
      router.push("/admin/coupons");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-md p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono uppercase"
        />
        <p className="text-xs text-gray-400 mt-1">
          Customers will type this exactly (not case-sensitive) at checkout.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Percent off</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
            className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        This code can be used exactly once, by whoever redeems it first, then it&apos;s
        permanently spent.
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-[#2C6252] text-white text-sm font-semibold px-4 py-2 rounded-md disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create Coupon"}
      </button>
    </form>
  );
}