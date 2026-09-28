"use client";

import { useEffect, useState } from "react";
import { Building2, Heart, Home, Loader2, MapPin, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import CountryCodeSelect, { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/components/CountryCodeSelect";
import { splitE164 } from "@/lib/checkout-profile";
import { examplePhone, formatPhone, isValidPhone, toE164 } from "@/lib/phone";
import { MAX_SAVED_ADDRESSES, type SavedAddress } from "@/lib/validations/account";
import { CARD, CARD_TITLE, GRADIENT } from "./ui";

/**
 * Customer panel → Saved Addresses (Figma "Save Addresses").
 *
 *   header — title + "Add New Address" (gradient, + icon)
 *   rows   — cream card: 80px picture tile, name + "Default" chip, the
 *            address on one line, its phone below; Edit (gradient) over
 *            Remove (outline) on the right
 *
 * Adding and editing happen in a pop-up (same look as Upload Photo), so the
 * list keeps Figma's clean shape. "Set as default" stays as a small link on
 * the other addresses — checkout fills the default in automatically.
 *
 * The list is kept in local state and updated from each API answer, so
 * changes show instantly without reloading the page.
 */

type Draft = {
  label: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string;
  isDefault: boolean;
};

type DraftKey = Exclude<keyof Draft, "isDefault">;

const EMPTY: Draft = {
  label: "Home",
  address: "",
  apartment: "",
  city: "",
  state: "",
  zip: "",
  phoneNumber: "",
  isDefault: false,
};
const QUICK_LABELS = ["Home", "Office", "Other"];

/** Figma field label + input, same as Profile Details. */
const LABEL = "mb-1.5 block font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black";
const INPUT =
  "h-[43px] w-full rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[12px]";
const ERROR = "mt-1.5 font-sora text-[12px] text-[#D72A37]";

/** A picture for the tile, from the name the customer gave the address. */
function iconFor(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("home") || lower.includes("house")) return Home;
  if (lower.includes("work") || lower.includes("office")) return Building2;
  if (lower.includes("mom") || lower.includes("dad") || lower.includes("family") || lower.includes("parent")) return Heart;
  return MapPin;
}

function oneLine(address: SavedAddress) {
  return [address.address, address.apartment, address.city, address.state, address.zip].filter(Boolean).join(", ");
}

export default function AddressBook({ initial }: { initial: SavedAddress[] }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initial);
  /** null = pop-up closed, "new" = adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [errors, setErrors] = useState<Partial<Record<DraftKey | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortDefaultFirst = (list: SavedAddress[]) => [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const atLimit = addresses.length >= MAX_SAVED_ADDRESSES;

  const openNew = () => {
    setDraft({ ...EMPTY, isDefault: addresses.length === 0 });
    setCountry(DEFAULT_COUNTRY);
    setErrors({});
    setEditing("new");
  };
  const openEdit = (address: SavedAddress) => {
    const phone = address.phone ? splitE164(address.phone) : null;
    setDraft({
      label: address.label,
      address: address.address,
      apartment: address.apartment ?? "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      phoneNumber: phone?.number ?? "",
      isDefault: address.isDefault,
    });
    setCountry(COUNTRIES.find((c) => c.code === phone?.countryCode) ?? DEFAULT_COUNTRY);
    setErrors({});
    setEditing(address.id);
  };
  const close = () => {
    if (!saving) setEditing(null);
  };

  // Escape closes the pop-up; the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (editing === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setEditing(null);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [editing, saving]);

  const set = (key: DraftKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "phoneNumber" ? event.target.value.replace(/[^\d]/g, "") : event.target.value;
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const applySaved = (saved: SavedAddress) => {
    setAddresses((prev) => {
      const others = prev
        .filter((a) => a.id !== saved.id)
        .map((a) => (saved.isDefault ? { ...a, isDefault: false } : a));
      return sortDefaultFirst([saved, ...others]);
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const phone = draft.phoneNumber.trim() ? toE164(country.dial, draft.phoneNumber) : "";
    const next: typeof errors = {};
    if (!draft.label.trim()) next.label = "Give this address a name, like Home.";
    if (!draft.address.trim()) next.address = "Please enter the street address.";
    if (!draft.city.trim()) next.city = "Please enter the city.";
    if (!draft.state.trim()) next.state = "Please enter the state.";
    if (!draft.zip.trim()) next.zip = "Please enter the zip code.";
    if (phone && !isValidPhone(phone)) next.phoneNumber = `That doesn't look like a valid ${country.name} number.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const isNew = editing === "new";
      const fields = {
        label: draft.label,
        address: draft.address,
        apartment: draft.apartment,
        city: draft.city,
        state: draft.state,
        zip: draft.zip,
        isDefault: draft.isDefault,
      };
      const res = await fetch(isNew ? "/api/account/addresses" : `/api/account/addresses/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: data?.error ?? "Couldn't save this address." });
        return;
      }
      applySaved(data.address as SavedAddress);
      toast.success(isNew ? "Address saved" : "Address updated");
      setEditing(null);
    } catch {
      setErrors({ form: "No connection. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (address: SavedAddress) => {
    setBusyId(address.id);
    try {
      const res = await fetch(`/api/account/addresses/${address.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...address,
          apartment: address.apartment ?? "",
          phone: address.phone ?? "",
          isDefault: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't change the default address.");
        return;
      }
      applySaved(data.address as SavedAddress);
      toast.success(`${address.label} is now your default address`);
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/account/addresses/${deleting.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't remove this address.");
        return;
      }
      // The server may have moved "default" to another address — reload
      // the list so what's shown is exactly what checkout will use.
      const list = await fetch("/api/account/addresses", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      setAddresses(list?.addresses ?? addresses.filter((a) => a.id !== deleting.id));
      toast.success("Address removed");
      setDeleting(null);
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <section aria-labelledby="addresses-title" className={`${CARD} flex flex-col gap-6 md:gap-10`}>
      {/* Figma: title left, "Add New Address" right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="addresses-title" className={CARD_TITLE}>
          Saved Addresses
        </h2>
        {!atLimit && (
          <button
            type="button"
            onClick={openNew}
            className={`inline-flex h-[42px] items-center justify-center gap-1.5 rounded-full ${GRADIENT} px-4 font-sora text-[14px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:h-[46px] md:px-5 md:text-[16px]`}
          >
            <Plus className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} aria-hidden="true" />
            Add New Address
          </button>
        )}
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[20px] bg-[#F9F6F3] px-4 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
            <MapPin className="h-6 w-6 text-[#FF9540]" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="mt-2 font-frank-ruhl text-[22px] font-semibold text-black">No saved addresses yet</p>
          <p className="max-w-[360px] font-sora text-[14px] text-black/70">
            Save your home or office once — next time, checkout is just one tap.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {addresses.map((address) => {
            const Icon = iconFor(address.label);
            return (
              <li
                key={address.id}
                className="flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* Figma: 80px picture, radius 20 */}
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] bg-white md:h-20 md:w-20 md:rounded-[20px]">
                    <Icon className="h-7 w-7 text-[#FF9540] md:h-8 md:w-8" strokeWidth={1.4} aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="break-words font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[24px]">
                        {address.label}
                      </p>
                      {address.isDefault && (
                        <span className="rounded-[6px] bg-white p-1.5 font-sora text-[12px] leading-[1.14] tracking-[-0.01em] text-black/70">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="font-sora text-[13px] leading-[1.5] text-black/70 md:text-[14px]">
                      <p className="break-words">{oneLine(address)}</p>
                      {address.phone && <p>{formatPhone(address.phone)}</p>}
                    </div>
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => makeDefault(address)}
                        disabled={busyId === address.id}
                        className="inline-flex items-center gap-1.5 self-start font-sora text-[12px] font-semibold text-[#FF7100] hover:underline disabled:opacity-60"
                      >
                        {busyId === address.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        Set as default
                      </button>
                    )}
                  </div>
                </div>

                {/* Figma: Edit (gradient) over Remove (outline), 83 × 40 */}
                <div className="flex shrink-0 gap-2 self-end min-[560px]:flex-col min-[560px]:self-center">
                  <button
                    type="button"
                    onClick={() => openEdit(address)}
                    className={`inline-flex h-10 min-w-[83px] items-center justify-center rounded-full ${GRADIENT} px-4 font-sora text-[12px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(address)}
                    className="inline-flex h-10 min-w-[83px] items-center justify-center rounded-full border border-black px-4 font-sora text-[12px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {atLimit && (
        <p className="font-sora text-[12px] text-black/60">
          You&apos;ve saved {MAX_SAVED_ADDRESSES} addresses, the most allowed. Remove one to add another.
        </p>
      )}

      {/* Add / Edit pop-up */}
      {editing !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-dialog-title"
        >
          <form
            onSubmit={save}
            noValidate
            className="flex max-h-[calc(100dvh-32px)] w-full max-w-[603px] flex-col gap-5 overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:rounded-[30px] md:p-[30px]"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="address-dialog-title"
                className="font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
              >
                {editing === "new" ? "Add New Address" : "Edit Address"}
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <div>
              <span className={LABEL}>
                Save as <span className="text-[#D72A37]">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_LABELS.map((label) => {
                  const active = draft.label === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, label }));
                        setErrors((prev) => ({ ...prev, label: undefined }));
                      }}
                      aria-pressed={active}
                      className={`h-9 rounded-full px-4 font-sora text-[12px] font-semibold transition-colors ${
                        active ? "bg-black text-white" : "bg-[#F9F6F3] text-black/70 hover:text-black"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                aria-label="Address name"
                maxLength={30}
                value={draft.label}
                onChange={set("label")}
                placeholder="e.g. Mom's Place"
                className={`${INPUT} mt-2`}
              />
              {errors.label && <p className={ERROR}>{errors.label}</p>}
            </div>

            <div>
              <label htmlFor="addr-street" className={LABEL}>
                Street Address <span className="text-[#D72A37]">*</span>
              </label>
              <input
                id="addr-street"
                type="text"
                autoComplete="street-address"
                maxLength={200}
                value={draft.address}
                onChange={set("address")}
                placeholder="House, road, area"
                className={INPUT}
              />
              {errors.address && <p className={ERROR}>{errors.address}</p>}
            </div>

            <div>
              <label htmlFor="addr-apartment" className={LABEL}>
                Apartment, Floor etc <span className="font-sora text-[11px] font-normal text-black/50">(optional)</span>
              </label>
              <input
                id="addr-apartment"
                type="text"
                autoComplete="address-line2"
                maxLength={100}
                value={draft.apartment}
                onChange={set("apartment")}
                placeholder="Flat 4B, 3rd floor"
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
              {(
                [
                  ["city", "City", "address-level2", "Dhaka"],
                  ["state", "State", "address-level1", "Dhaka Division"],
                  ["zip", "Zip", "postal-code", "1212"],
                ] as const
              ).map(([key, label, autoComplete, placeholder]) => (
                <div key={key} className="min-w-0">
                  <label htmlFor={`addr-${key}`} className={LABEL}>
                    {label} <span className="text-[#D72A37]">*</span>
                  </label>
                  <input
                    id={`addr-${key}`}
                    type="text"
                    autoComplete={autoComplete}
                    maxLength={key === "zip" ? 20 : 80}
                    value={draft[key]}
                    onChange={set(key)}
                    placeholder={placeholder}
                    className={INPUT}
                  />
                  {errors[key] && <p className={ERROR}>{errors[key]}</p>}
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="addr-phone" className={LABEL}>
                Phone Number <span className="font-sora text-[11px] font-normal text-black/50">(optional)</span>
              </label>
              <div className="flex h-[43px] items-center rounded-[12px] bg-[#F9F6F3] focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                <div className="flex h-full shrink-0 items-stretch [&_button]:border-r-0 [&_button]:bg-transparent [&_button]:pl-3 [&_button]:pr-0 [&_button]:text-[12px] [&_button]:text-black/70">
                  <CountryCodeSelect value={country} onChange={setCountry} />
                </div>
                <span className="ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
                <input
                  id="addr-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={draft.phoneNumber}
                  onChange={set("phoneNumber")}
                  placeholder={examplePhone(country.code) || "Phone number"}
                  className="h-full min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/60 focus:outline-none md:text-[12px]"
                />
              </div>
              {errors.phoneNumber ? (
                <p className={ERROR}>{errors.phoneNumber}</p>
              ) : (
                <p className="mt-1.5 font-sora text-[11px] text-black/50">
                  Who the rider should call here — filled into checkout when you pick this address.
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(event) => setDraft((prev) => ({ ...prev, isDefault: event.target.checked }))}
                className="h-4 w-4 rounded border-black/20 accent-[#FF9540]"
              />
              <span className="font-sora text-[13px] text-black/75">Use as my default delivery address</span>
            </label>

            {errors.form && (
              <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
                {errors.form}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="inline-flex h-[46px] flex-1 items-center justify-center rounded-full border border-black px-5 font-sora text-[15px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 md:text-[16px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full ${GRADIENT} px-5 font-sora text-[15px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:text-[16px]`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? "Saving…" : editing === "new" ? "Save Address" : "Save Change"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Remove "${deleting?.label ?? ""}"?`}
        message={
          deleting?.isDefault && addresses.length > 1
            ? "This is your default address. Another saved address will become the default."
            : "Past orders keep their own copy of the address, so nothing already delivered changes."
        }
        confirmLabel="Remove"
        tone="danger"
        pending={deletePending}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
