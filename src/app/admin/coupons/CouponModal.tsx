"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Loader2, Shuffle, X } from "lucide-react";
import {
  DateField,
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  TEXTAREA,
  toISODate,
} from "@/components/admin/modal-ui";
import type { CategoryOption, CouponFormValues } from "./types";

/**
 * "Create New Coupon" / "Edit Coupon" — Figma frame 735 wide, padding 30,
 * gap 40, radius 30; same fields and buttons as the other admin modals.
 *
 * Figma fields: Tag / Label, Coupon Code, Headline, Status, Description,
 * Discount Type, Discount Value, Minimum Order, Usage Limit, Start Date,
 * Expiry Date, Applies To.
 *
 * Added because checkout already supports them and a coupon without them
 * is easy to abuse: Max Discount (caps a percentage), Uses Per Customer,
 * and Valid On (limit to categories). "Free Delivery" is a discount type:
 * it waives the delivery fee instead of taking money off the food.
 *
 * Every rule is checked again on the server — here and at checkout.
 */

const SECTION_TITLE = "font-frank-ruhl text-[18px] font-medium leading-[1.6] text-black";
const HELP = "mt-1.5 font-sora text-[11px] leading-[1.5] text-black/60";

const LABEL_PRESETS = [
  "New Here",
  "Free Delivery",
  "Combo Saver",
  "Weekend Deal",
  "Limited Time",
  "Loyalty Reward",
  "Festival Offer",
];

const TYPE_OPTIONS = [
  { value: "PERCENT", label: "Percentage (%)" },
  { value: "FIXED", label: "Fixed Amount" },
  { value: "FREE_DELIVERY", label: "Free Delivery" },
] as const;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "All Customers" },
  { value: "NEW_CUSTOMERS", label: "First-Time Customers Only" },
  { value: "MEMBERS", label: "Members Only (signed-in customers)" },
] as const;

export const EMPTY_COUPON: CouponFormValues = {
  id: null,
  code: "",
  label: "",
  headline: "",
  description: "",
  isActive: true,
  type: "PERCENT",
  value: "",
  minOrderValue: "",
  usageLimit: "",
  maxDiscountAmount: "",
  perCustomerLimit: "1",
  startDate: "",
  endDate: "",
  audience: "ALL",
  restrictedCategoryIds: [],
  restrictedItems: [],
  usageCount: 0,
};

function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

export default function CouponModal({
  open,
  onClose,
  initial,
  categories,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  initial: CouponFormValues;
  categories: CategoryOption[];
  currency: string;
}) {
  // Remount on each open so the form starts from `initial` every time.
  if (!open) return null;
  return <CouponForm onClose={onClose} initial={initial} categories={categories} currency={currency} />;
}

function CouponForm({
  onClose,
  initial,
  categories,
  currency,
}: {
  onClose: () => void;
  initial: CouponFormValues;
  categories: CategoryOption[];
  currency: string;
}) {
  const router = useRouter();
  const editing = initial.id !== null;
  const codeLocked = editing && initial.usageCount > 0;
  const today = toISODate(new Date());

  const [v, setV] = useState<CouponFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const labelOptions = [
    { value: "", label: "No label" },
    ...LABEL_PRESETS.map((preset) => ({ value: preset, label: preset })),
    // A label typed some other way earlier stays selectable.
    ...(v.label && !LABEL_PRESETS.includes(v.label) ? [{ value: v.label, label: v.label }] : []),
  ];

  const toggleCategory = (id: string) =>
    set(
      "restrictedCategoryIds",
      v.restrictedCategoryIds.includes(id)
        ? v.restrictedCategoryIds.filter((c) => c !== id)
        : [...v.restrictedCategoryIds, id]
    );

  const num = (text: string) => (text.trim() === "" ? null : Number(text));

  const problem = (() => {
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(v.code.trim())) {
      return "Coupon code: 3–30 letters or numbers (- and _ allowed, no spaces).";
    }
    if (v.type === "PERCENT") {
      const pct = num(v.value);
      if (pct === null || !Number.isInteger(pct) || pct < 1 || pct > 100) {
        return "Discount value: a whole percentage from 1 to 100.";
      }
    }
    if (v.type === "FIXED") {
      const amount = num(v.value);
      if (amount === null || !(amount > 0)) return "Discount value: an amount above 0.";
    }
    for (const [text, name] of [
      [v.minOrderValue, "Minimum order"],
      [v.maxDiscountAmount, "Max discount"],
    ] as const) {
      const n = num(text);
      if (n !== null && (!Number.isFinite(n) || n < 0)) return `${name} must be a positive number.`;
    }
    for (const [text, name] of [
      [v.usageLimit, "Usage limit"],
      [v.perCustomerLimit, "Uses per customer"],
    ] as const) {
      const n = num(text);
      if (n !== null && (!Number.isInteger(n) || n < 1)) return `${name} must be a whole number of 1 or more.`;
    }
    if (v.startDate && v.endDate && v.endDate < v.startDate) return "Expiry date can't be before the start date.";
    return null;
  })();

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        code: v.code.trim().toUpperCase(),
        label: v.label || null,
        headline: v.headline.trim() || null,
        description: v.description.trim() || null,
        isActive: v.isActive,
        type: v.type,
        value: v.type === "FREE_DELIVERY" ? null : num(v.value),
        minOrderValue: num(v.minOrderValue),
        usageLimit: num(v.usageLimit),
        maxDiscountAmount: v.type === "PERCENT" ? num(v.maxDiscountAmount) : null,
        perCustomerLimit: num(v.perCustomerLimit),
        startDate: v.startDate || null,
        endDate: v.endDate || null,
        audience: v.audience,
        restrictedCategoryIds: v.restrictedCategoryIds,
        restrictedItemIds: v.restrictedItems.map((item) => item.id),
      };
      const res = await fetch(editing ? `/api/admin/coupons/${initial.id}` : "/api/admin/coupons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Couldn't save the coupon (error ${res.status}).`);

      toast.success(editing ? `${body.code} updated` : `${body.code} created`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the coupon.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  const fieldClass = `${FIELD} max-[639px]:text-[16px]`;

  return (
    <ModalShell
      open
      onClose={close}
      title={editing ? "Edit Coupon" : "Create New Coupon"}
      titleId="coupon-modal-title"
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={close} disabled={saving} className={`${OUTLINE_BUTTON} flex-1`}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={`${PRIMARY_BUTTON} flex-1`}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />}
            {saving ? "Saving…" : editing ? "Save Change" : "Create Coupon"}
          </button>
        </div>
      }
    >
      {/* ── What customers see ── */}
      <div className="grid gap-4 min-[560px]:grid-cols-2">
        <SelectField id="coupon-label" label="Tag / Label" value={v.label} onChange={(x) => set("label", x)} options={labelOptions} />

        <div className="min-w-0">
          <label htmlFor="coupon-code" className={LABEL}>
            Coupon Code
          </label>
          <div className="relative">
            <input
              id="coupon-code"
              value={v.code}
              onChange={(event) => set("code", event.target.value.toUpperCase().replace(/\s/g, ""))}
              disabled={codeLocked}
              maxLength={30}
              placeholder="WELCOME20"
              autoComplete="off"
              className={`${fieldClass} pr-10 font-semibold uppercase tracking-wide disabled:opacity-60`}
            />
            {!codeLocked && (
              <button
                type="button"
                onClick={() => set("code", randomCode())}
                title="Make a random code"
                aria-label="Make a random code"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-black/60 transition-colors hover:bg-black/[0.06] hover:text-black"
              >
                <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
          {codeLocked && <p className={HELP}>Already used {initial.usageCount}×, so the code can&apos;t change.</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="coupon-headline" className={LABEL}>
            Headline
          </label>
          <input
            id="coupon-headline"
            value={v.headline}
            onChange={(event) => set("headline", event.target.value)}
            maxLength={80}
            placeholder="20% Off Your First Order"
            className={fieldClass}
          />
        </div>

        <SelectField
          id="coupon-status"
          label="Status"
          value={v.isActive ? "active" : "inactive"}
          onChange={(x) => set("isActive", x === "active")}
          options={STATUS_OPTIONS}
        />

        <div className="min-w-0 min-[560px]:col-span-2">
          <label htmlFor="coupon-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="coupon-description"
            value={v.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Use the code below at checkout on any order over $15."
            className={`${TEXTAREA} max-[639px]:text-[16px]`}
          />
          <p className={HELP}>Shown on the coupon card on the menu page. Leave blank to describe the rules automatically.</p>
        </div>
      </div>

      {/* ── Discount Rules ── */}
      <div className="flex flex-col gap-5">
        <h3 className={SECTION_TITLE}>Discount Rules</h3>

        <SelectField
          id="coupon-type"
          label="Discount Type"
          value={v.type}
          onChange={(x) => set("type", x as CouponFormValues["type"])}
          options={TYPE_OPTIONS}
        />

        <div className="grid grid-cols-2 gap-4 min-[640px]:grid-cols-3">
          <div className="col-span-2 min-w-0 min-[640px]:col-span-1">
            <label htmlFor="coupon-value" className={LABEL}>
              Discount Value
            </label>
            {v.type === "FREE_DELIVERY" ? (
              <div className="flex h-[43px] items-center rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] text-black/70">
                Delivery fee waived
              </div>
            ) : (
              <div className="relative">
                <input
                  id="coupon-value"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={v.type === "PERCENT" ? 1 : "any"}
                  value={v.value}
                  onChange={(event) => set("value", event.target.value)}
                  placeholder={v.type === "PERCENT" ? "20" : "5.00"}
                  className={`${fieldClass} pr-12`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-sora text-[12px] text-black/70">
                  {v.type === "PERCENT" ? "%" : currency}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="coupon-min" className={LABEL}>
              Minimum Order
            </label>
            <input
              id="coupon-min"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={v.minOrderValue}
              onChange={(event) => set("minOrderValue", event.target.value)}
              placeholder="No minimum"
              className={fieldClass}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="coupon-limit" className={LABEL}>
              Usage Limit
            </label>
            <input
              id="coupon-limit"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={v.usageLimit}
              onChange={(event) => set("usageLimit", event.target.value)}
              placeholder="No limit"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="coupon-per-customer" className={LABEL}>
              Uses Per Customer
            </label>
            <input
              id="coupon-per-customer"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={v.perCustomerLimit}
              onChange={(event) => set("perCustomerLimit", event.target.value)}
              placeholder="No limit"
              className={fieldClass}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="coupon-max" className={LABEL}>
              Max Discount
            </label>
            <input
              id="coupon-max"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={v.type === "PERCENT" ? v.maxDiscountAmount : ""}
              onChange={(event) => set("maxDiscountAmount", event.target.value)}
              disabled={v.type !== "PERCENT"}
              placeholder={v.type === "PERCENT" ? "No cap" : "Only for %"}
              className={`${fieldClass} disabled:opacity-60`}
            />
          </div>
        </div>
      </div>

      {/* ── Validity ── */}
      <div className="flex flex-col gap-5">
        <h3 className={SECTION_TITLE}>Validity</h3>

        <div className="grid gap-4 min-[480px]:grid-cols-2">
          <div className="flex flex-col">
            <DateField
              id="coupon-start"
              label="Start Date"
              value={v.startDate}
              onChange={(x) => set("startDate", x)}
              minDate={editing && initial.startDate && initial.startDate < today ? undefined : new Date()}
            />
            <p className={HELP}>{v.startDate ? "Works from the start of this day." : "Blank = works right away."}</p>
          </div>
          <div className="flex flex-col">
            <DateField
              id="coupon-end"
              label="Expiry Date (Optional)"
              value={v.endDate}
              onChange={(x) => set("endDate", x)}
              minDate={new Date()}
            />
            {v.endDate ? (
              <button
                type="button"
                onClick={() => set("endDate", "")}
                className="mt-1.5 self-start font-sora text-[11px] text-black/70 underline underline-offset-2 hover:text-black"
              >
                No expiry
              </button>
            ) : (
              <p className={HELP}>Blank = never expires.</p>
            )}
          </div>
        </div>

        <SelectField
          id="coupon-audience"
          label="Applies To"
          value={v.audience}
          onChange={(x) => set("audience", x as CouponFormValues["audience"])}
          options={AUDIENCE_OPTIONS}
        />

        {/* Valid On — which dishes the discount counts against */}
        {v.type !== "FREE_DELIVERY" && categories.length > 0 && (
          <div>
            <span className={LABEL}>Valid On</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set("restrictedCategoryIds", [])}
                className={`h-9 rounded-full px-3.5 font-sora text-[12px] transition-colors ${
                  v.restrictedCategoryIds.length === 0 ? "bg-black text-white" : "bg-[#F9F6F3] text-black hover:bg-black/[0.06]"
                }`}
              >
                Whole menu
              </button>
              {categories.map((category) => {
                const on = v.restrictedCategoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(category.id)}
                    className={`h-9 rounded-full px-3.5 font-sora text-[12px] transition-colors ${
                      on ? "bg-black text-white" : "bg-[#F9F6F3] text-black hover:bg-black/[0.06]"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
            <p className={HELP}>
              With categories picked, the discount only counts dishes from them — other dishes in the cart
              stay full price.
            </p>
          </div>
        )}

        {v.restrictedItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[#FFF2DA] p-3 font-sora text-[12px] text-black">
            <span>
              Also limited to {v.restrictedItems.length === 1 ? "one dish" : `${v.restrictedItems.length} dishes`}:{" "}
              {v.restrictedItems
                .slice(0, 4)
                .map((item) => item.title)
                .join(", ")}
              {v.restrictedItems.length > 4 ? "…" : ""}
            </span>
            <button
              type="button"
              onClick={() => set("restrictedItems", [])}
              className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] hover:bg-black/[0.04]"
            >
              <X className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
              Remove dish limit
            </button>
          </div>
        )}
      </div>

      {error && <ModalError message={error} />}
    </ModalShell>
  );
}
