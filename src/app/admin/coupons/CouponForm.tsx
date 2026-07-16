"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DiscountType = "PERCENT" | "FIXED";
type RestrictionScope = "NONE" | "CATEGORIES" | "ITEMS";

type MenuCategory = {
  id: string;
  label: string;
  items: { id: string; title: string; price: number }[];
};

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

  // Item/category restriction — see the scoping note on the Coupon model
  // in schema.prisma. "NONE" (the default) keeps every existing coupon's
  // behavior: applies to the whole cart.
  const [restrictionScope, setRestrictionScope] = useState<RestrictionScope>("NONE");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  // Only set from the effect's async failure branch (never synchronously),
  // so "loading" below can be derived instead of tracked as its own state
  // that gets flipped true/false synchronously in the effect body.
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // "Loading" is true whenever we need the menu but don't have it yet and
  // haven't already failed to fetch it — derived from existing state
  // rather than a separate flag flipped synchronously inside the effect.
  const menuLoading = restrictionScope !== "NONE" && menu.length === 0 && !menuLoadFailed;

  // Menu is only needed once the admin actually wants to restrict a
  // coupon, so it's fetched lazily on first switch to Categories/Items
  // rather than on every form load. /api/menu is the same public,
  // already-grouped-by-category endpoint the customer-facing /menu page
  // uses — reused here rather than adding a parallel admin-only route.
  useEffect(() => {
    if (restrictionScope === "NONE" || menu.length > 0 || menuLoadFailed) return;
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => setMenu(Array.isArray(data) ? data : []))
      .catch(() => {
        setMenuLoadFailed(true);
        setError("Couldn't load menu items/categories. Please try again.");
      });
  }, [restrictionScope, menu.length, menuLoadFailed]);

  function toggleSet(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Code is required");
      return;
    }

    if (restrictionScope === "CATEGORIES" && selectedCategoryIds.size === 0) {
      setError('Select at least one category, or switch back to "No restriction"');
      return;
    }
    if (restrictionScope === "ITEMS" && selectedItemIds.size === 0) {
      setError('Select at least one item, or switch back to "No restriction"');
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
      restrictedCategoryIds: restrictionScope === "CATEGORIES" ? Array.from(selectedCategoryIds) : [],
      restrictedItemIds: restrictionScope === "ITEMS" ? Array.from(selectedItemIds) : [],
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
  const scopeButtonClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium border ${
      active ? "bg-[#2C6252] text-white border-[#2C6252]" : "bg-white text-gray-600 border-gray-300"
    }`;

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
          <p className="text-xs text-gray-400 mt-1">
            Checked against the customer&apos;s full cart, even if this coupon is
            restricted to specific items below.
          </p>
        </div>
      </div>

      {/* Item/category restriction */}
      <div className="border-t border-gray-100 pt-4">
        <label className={labelClass}>Restrict to (optional)</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setRestrictionScope("NONE")}
            className={scopeButtonClass(restrictionScope === "NONE")}
          >
            No restriction
          </button>
          <button
            type="button"
            onClick={() => setRestrictionScope("CATEGORIES")}
            className={scopeButtonClass(restrictionScope === "CATEGORIES")}
          >
            Specific categories
          </button>
          <button
            type="button"
            onClick={() => setRestrictionScope("ITEMS")}
            className={scopeButtonClass(restrictionScope === "ITEMS")}
          >
            Specific items
          </button>
        </div>

        {restrictionScope === "NONE" && (
          <p className="text-xs text-gray-400">Applies to every item in the cart — the default.</p>
        )}

        {restrictionScope !== "NONE" && (
          <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto p-3">
            {menuLoading && <p className="text-sm text-gray-400">Loading menu…</p>}
            {!menuLoading && menu.length === 0 && (
              <p className="text-sm text-gray-400">No menu items found.</p>
            )}

            {restrictionScope === "CATEGORIES" &&
              menu.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.has(cat.id)}
                    onChange={() => toggleSet(selectedCategoryIds, setSelectedCategoryIds, cat.id)}
                  />
                  {cat.label}
                  <span className="text-xs text-gray-400">({cat.items.length} items)</span>
                </label>
              ))}

            {restrictionScope === "ITEMS" &&
              menu.map((cat) => (
                <div key={cat.id} className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mt-2">{cat.label}</p>
                  {cat.items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 py-1 text-sm text-gray-700 pl-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleSet(selectedItemIds, setSelectedItemIds, item.id)}
                      />
                      {item.title}
                      <span className="text-xs text-gray-400">${item.price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1">
          When set, the discount only applies to matching items — the rest of the
          customer&apos;s cart stays full price.
        </p>
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