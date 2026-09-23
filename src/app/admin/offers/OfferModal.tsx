"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { CircleCheck, Loader2, SearchCheck, UtensilsCrossed } from "lucide-react";
import {
  DateField,
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  toISODate,
} from "@/components/admin/modal-ui";
import { formatAmount } from "@/lib/currency-format";
import type { EditableOffer, MoneyFormat, OfferProduct } from "./types";

/**
 * The offer form on /admin/offers — Figma "Create Offer" (735 wide,
 * padding 30, gap 40, radius 30). It opens three ways:
 *
 *   "Create Offer" (toolbar)   product search + list, then the form
 *   "Add Offer" (a row)        product already chosen — Figma's second
 *                              frame, without the list
 *   "Edit" (an offer card)     the offer's own values
 *
 * In the last two the chosen product is still shown as one (selected) row
 * above the form. The Figma frame leaves it out, but without it nothing
 * on the form says WHICH dish is being discounted.
 *
 * "New Price" is a preview worked out here; the server works the price out
 * again on save (and again at every checkout), so nothing typed here can
 * set a price by itself.
 */

const SECTION_TITLE = "font-frank-ruhl text-[18px] font-medium leading-[1.6] text-black";

// Figma: the read-only "New Price" / "Old Price" boxes look like the other
// fields, just not editable.
const READ_ONLY_BOX =
  "flex h-[43px] w-full items-center rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-[1.6] text-black/70";

const TYPE_OPTIONS = [
  { value: "PERCENT", label: "Percentage (%)" },
  { value: "FIXED", label: "Fixed Amount" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "All Customers" },
  { value: "MEMBERS", label: "Members Only (signed-in customers)" },
] as const;

type Mode =
  | { kind: "create"; products: OfferProduct[] }
  | { kind: "add"; product: OfferProduct }
  | { kind: "edit"; offer: EditableOffer };

export default function OfferModal({
  open,
  onClose,
  mode,
  money,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  money: MoneyFormat;
}) {
  // Remount on every open so the form starts from its values each time.
  if (!open) return null;
  return <OfferForm onClose={onClose} mode={mode} money={money} />;
}

function OfferForm({
  onClose,
  mode,
  money,
}: {
  onClose: () => void;
  mode: Mode;
  money: MoneyFormat;
}) {
  const router = useRouter();
  const editing = mode.kind === "edit" ? mode.offer : null;
  const today = toISODate(new Date());

  const [productId, setProductId] = useState<string | null>(
    mode.kind === "add" ? mode.product.id : mode.kind === "edit" ? mode.offer.product.id : null
  );
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">(editing?.type ?? "PERCENT");
  const [value, setValue] = useState(editing ? String(editing.value) : "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? today);
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [audience, setAudience] = useState<"ALL" | "MEMBERS">(editing?.audience ?? "ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useMemo<OfferProduct[]>(() => {
    if (mode.kind === "create") return mode.products;
    return [mode.kind === "add" ? mode.product : mode.offer.product];
  }, [mode]);

  const product = products.find((p) => p.id === productId) ?? null;

  const visibleProducts = useMemo(() => {
    if (mode.kind !== "create") return products;
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products;
  }, [mode.kind, products, search]);

  const label = (amount: number) => formatAmount(amount.toFixed(money.minorUnits), money.currency);

  // ── The preview ──────────────────────────────────────────────────────
  const numericValue = Number(value);
  const valueOk = value.trim() !== "" && Number.isFinite(numericValue) && numericValue > 0;
  let newPrice: number | null = null;
  if (product && valueOk) {
    const factor = 10 ** money.minorUnits;
    const raw =
      type === "PERCENT"
        ? (product.price * (100 - numericValue)) / 100
        : product.price - numericValue;
    newPrice = Math.round(raw * factor) / factor;
  }

  const problem = (() => {
    if (!product) return "Pick a product to put on offer.";
    if (!valueOk) return "Enter a discount value.";
    if (type === "PERCENT" && (!Number.isInteger(numericValue) || numericValue >= 100)) {
      return "Percentage must be a whole number from 1 to 99.";
    }
    if (newPrice === null || newPrice <= 0) return "The discount must leave a price above zero.";
    if (!startDate) return "Pick a start date.";
    if (endDate && endDate < startDate) return "Expiry date can't be before the start date.";
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
      const res = await fetch(editing ? `/api/admin/offers/${editing.id}` : "/api/admin/offers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId: product!.id,
          type,
          value: numericValue,
          audience,
          startDate,
          endDate: endDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Couldn't save the offer (error ${res.status}).`);

      toast.success(editing ? "Offer updated" : `Offer added to ${product!.title}`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the offer.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <ModalShell
      open
      onClose={close}
      title={editing ? "Edit Offer" : "Create Offer"}
      titleId="offer-modal-title"
      footer={
        // Figma Frame 2147236023: row, gap 8, two equal buttons.
        <div className="flex gap-2">
          <button type="button" onClick={close} disabled={saving} className={`${OUTLINE_BUTTON} flex-1`}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={`${PRIMARY_BUTTON} flex-1`}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />}
            {saving ? "Saving…" : editing ? "Save Change" : "Save Offer"}
          </button>
        </div>
      }
    >
      {/* ── Product ── */}
      {mode.kind === "create" && (
        // Figma: search "Search for a different product…", 43px, radius 12.
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for a different product..."
            aria-label="Search products"
            // 16px on phones so iOS doesn't zoom into the field.
            className={`${FIELD} pr-9 max-[639px]:text-[16px]`}
          />
          <SearchCheck
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/70"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
      )}

      {mode.kind === "create" ? (
        visibleProducts.length === 0 ? (
          <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[12px] leading-[1.6] text-black/70">
            {products.length === 0
              ? "Every product already has an offer. Edit or remove one to add another."
              : "No product matches that search."}
          </p>
        ) : (
          // Figma: column, gap 16. Three rows tall, then it scrolls, so a
          // long menu doesn't push the form off the screen.
          <div
            role="radiogroup"
            aria-label="Product"
            className="-mx-1 flex max-h-[324px] flex-col gap-4 overflow-y-auto px-1 py-1"
          >
            {visibleProducts.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                priceLabel={label(p.price)}
                selected={p.id === productId}
                onSelect={() => {
                  setProductId(p.id);
                  setError(null);
                }}
              />
            ))}
          </div>
        )
      ) : (
        product && (
          <ProductRow
            product={product}
            priceLabel={label(product.price)}
            // Editing: the dish HAS an offer — this is its normal price.
            note={mode.kind === "edit" ? "Normal price" : undefined}
            selected
          />
        )
      )}

      {/* ── Discount ── */}
      <div className="flex flex-col gap-5">
        <h3 className={SECTION_TITLE}>Discount</h3>

        <SelectField
          id="offer-type"
          label="Discount Type"
          value={type}
          onChange={(next) => setType(next as "PERCENT" | "FIXED")}
          options={TYPE_OPTIONS}
        />

        {/* Figma: three equal fields in a row. Below 640px the value takes
            the whole row and the two prices share the next one. */}
        <div className="grid grid-cols-2 gap-4 min-[640px]:grid-cols-3">
          <div className="col-span-2 min-w-0 min-[640px]:col-span-1">
            <label htmlFor="offer-value" className={LABEL}>
              Discount Value
            </label>
            <div className="relative">
              <input
                id="offer-value"
                type="number"
                inputMode="decimal"
                min={type === "PERCENT" ? 1 : 0}
                max={type === "PERCENT" ? 99 : undefined}
                step={type === "PERCENT" ? 1 : "any"}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={type === "PERCENT" ? "20" : "2.00"}
                className={`${FIELD} pr-8 max-[639px]:text-[16px]`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-sora text-[12px] text-black/70">
                {type === "PERCENT" ? "%" : money.currency}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <span className={LABEL}>New Price</span>
            <div className={`${READ_ONLY_BOX} ${newPrice !== null && newPrice > 0 ? "text-black" : ""}`}>
              {newPrice !== null && newPrice > 0 ? label(newPrice) : "—"}
            </div>
          </div>

          <div className="min-w-0">
            <span className={LABEL}>Old Price</span>
            <div className={READ_ONLY_BOX}>{product ? label(product.price) : "—"}</div>
          </div>
        </div>
      </div>

      {/* ── Validity ── */}
      <div className="flex flex-col gap-5">
        <h3 className={SECTION_TITLE}>Validity</h3>

        <div className="grid gap-4 min-[480px]:grid-cols-2">
          <DateField
            id="offer-start"
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            // An offer can't start in the past — except the start date a
            // running offer already has, which stays as it is.
            minDate={editing && editing.startDate < today ? undefined : new Date()}
          />
          <div className="flex flex-col">
            <DateField
              id="offer-end"
              label="Expiry Date (Optional)"
              value={endDate}
              onChange={setEndDate}
              minDate={new Date()}
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate("")}
                className="mt-1.5 self-start font-sora text-[12px] text-black/70 underline underline-offset-2 hover:text-black"
              >
                No end date
              </button>
            )}
          </div>
        </div>

        <SelectField
          id="offer-audience"
          label="Applies To"
          value={audience}
          onChange={(next) => setAudience(next as "ALL" | "MEMBERS")}
          options={AUDIENCE_OPTIONS}
        />

        <p className="font-sora text-[12px] leading-[1.6] text-black/70">
          {endDate
            ? "The offer runs through the whole expiry day, then the normal price comes back."
            : "With no expiry date the offer runs until you remove it."}{" "}
          {audience === "MEMBERS" && "Guests see the normal price, and a note that members save."}
        </p>
      </div>

      {error && <ModalError message={error} />}
    </ModalShell>
  );
}

/**
 * Figma Frame 2147236305: row, space-between, padding 16, radius 16, BG
 * #F9F6F3; the chosen one gets a 1px black border and a black tick.
 */
function ProductRow({
  product,
  priceLabel,
  selected,
  onSelect,
  note = "No active offer",
}: {
  product: OfferProduct;
  priceLabel: string;
  selected: boolean;
  onSelect?: () => void;
  note?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3 min-[480px]:gap-4">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-white min-[480px]:h-[60px] min-[480px]:w-[60px]">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt="" fill sizes="60px" unoptimized className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-black/20" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1 text-left">
          <span className="truncate font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black min-[480px]:text-[20px]">
            {product.title}
          </span>
          <span className="truncate font-sora text-[12px] leading-[1.7] text-black">
            {priceLabel} · {note}
          </span>
        </span>
      </span>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          selected ? "bg-black text-white" : "bg-white text-black"
        }`}
        aria-hidden="true"
      >
        <CircleCheck
          className="h-4 w-4"
          strokeWidth={selected ? 2 : 1.2}
          fill={selected ? "currentColor" : "none"}
          stroke={selected ? "#000" : "currentColor"}
        />
      </span>
    </>
  );

  const shell = `flex w-full items-center justify-between gap-4 rounded-[16px] border bg-[#F9F6F3] p-3 min-[480px]:p-4 ${
    selected ? "border-black" : "border-transparent"
  }`;

  if (!onSelect) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`${shell} transition-colors hover:border-black/30 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
    >
      {body}
    </button>
  );
}
