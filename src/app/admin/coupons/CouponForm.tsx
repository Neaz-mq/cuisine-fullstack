"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DiscountType = "PERCENT" | "FIXED";

export default function CouponForm() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [type, setType] = useState<DiscountType>("PERCENT");
  const [percentOff, setPercentOff] = useState("10");
  const [fixedOff, setFixedOff] = useState("5");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [unlimitedPerCustomer, setUnlimitedPerCustomer] = useState(false);
  const [perCustomerLimit, setPerCustomerLimit] = useState("1");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Code is required");
      return;
    }

    const body: Record<string, unknown> = {
      code,
      type,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      minOrderValue: minOrderValue ? Number(minOrderValue) : null,
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      perCustomerLimit: unlimitedPerCustomer ? null : Number(perCustomerLimit),
    };

    if (type === "PERCENT") {
      body.percentOff = Number(percentOff);
    } else {
      body.fixedOff = Number(fixedOff);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-md p-6">
      <div>
        <label className={labelClass}>Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className={`${inputClass} font-mono uppercase`}
        />
        <p className="text-xs text-gray-400 mt-1">
          Customers will type this exactly (not case-sensitive) at checkout.
        </p>
      </div>

      {/* Discount type + amount */}
      <div className="border-t border-gray-100 pt-4">
        <label className={labelClass}>Discount type</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setType("PERCENT")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              type === "PERCENT"
                ? "bg-[#2C6252] text-white border-[#2C6252]"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            Percent off
          </button>
          <button
            type="button"
            onClick={() => setType("FIXED")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              type === "FIXED"
                ? "bg-[#2C6252] text-white border-[#2C6252]"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            Fixed amount off
          </button>
        </div>

        {type === "PERCENT" ? (
          <div>
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
            <p className="text-xs text-gray-400 mt-1">
              Tip: set a max discount cap below so a big order doesn&apos;t get an
              unexpectedly large discount.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={fixedOff}
              onChange={(e) => setFixedOff(e.target.value)}
              className="w-28 border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-sm text-gray-500">off</span>
          </div>
        )}
      </div>

      {/* Order conditions */}
      <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-4">
        {type === "PERCENT" && (
          <div>
            <label className={labelClass}>Max discount cap (optional)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                placeholder="No cap"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Minimum order value (optional)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="No minimum"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Redemption window */}
      <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Starts (optional)</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Expires (optional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Usage limits */}
      <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Total usage limit (optional)</label>
          <input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">
            Across every customer combined, e.g. &quot;first 100 redemptions&quot;.
          </p>
        </div>

        <div>
          <label className={labelClass}>Per-customer limit</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
              disabled={unlimitedPerCustomer}
              className={`${inputClass} w-24 disabled:opacity-50`}
            />
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={unlimitedPerCustomer}
                onChange={(e) => setUnlimitedPerCustomer(e.target.checked)}
              />
              Unlimited per customer
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Identified by account, or by phone number for guest checkout.
          </p>
        </div>
      </div>

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
