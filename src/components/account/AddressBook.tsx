"use client";

import { useState } from "react";
import { Briefcase, Home, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { MAX_SAVED_ADDRESSES, type SavedAddress } from "@/lib/validations/account";
import {
  CARD,
  CARD_SUBTITLE,
  CARD_TITLE,
  FIELD_ERROR,
  FIELD_INPUT,
  FIELD_LABEL,
  PRIMARY_BUTTON,
  SMALL_OUTLINE,
  SMALL_PRIMARY,
} from "./ui";

/**
 * Customer panel → Profile → "Saved addresses".
 *
 * Like the address book in food apps: save Home, Work, family… once,
 * then pick one with a tap at checkout. One address is the default —
 * checkout fills that one in automatically.
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
  isDefault: boolean;
};

/** Cream inputs on the white card (Figma). */
const INPUT = FIELD_INPUT;

const EMPTY: Draft = { label: "Home", address: "", apartment: "", city: "", state: "", zip: "", isDefault: false };
const QUICK_LABELS = ["Home", "Work", "Other"];

function iconFor(label: string) {
  const lower = label.toLowerCase();
  if (lower === "home") return Home;
  if (lower === "work" || lower === "office") return Briefcase;
  return MapPin;
}

export default function AddressBook({ initial }: { initial: SavedAddress[] }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initial);
  /** null = form closed, "new" = adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortDefaultFirst = (list: SavedAddress[]) => [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  const openNew = () => {
    setDraft({ ...EMPTY, isDefault: addresses.length === 0 });
    setErrors({});
    setEditing("new");
  };
  const openEdit = (address: SavedAddress) => {
    setDraft({
      label: address.label,
      address: address.address,
      apartment: address.apartment ?? "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      isDefault: address.isDefault,
    });
    setErrors({});
    setEditing(address.id);
  };
  const close = () => {
    if (!saving) setEditing(null);
  };

  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "isDefault" ? event.target.checked : event.target.value;
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
    const next: typeof errors = {};
    if (!draft.label.trim()) next.label = "Give this address a name, like Home.";
    if (!draft.address.trim()) next.address = "Please enter the street address.";
    if (!draft.city.trim()) next.city = "Please enter the city.";
    if (!draft.state.trim()) next.state = "Please enter the state.";
    if (!draft.zip.trim()) next.zip = "Please enter the zip code.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/account/addresses" : `/api/account/addresses/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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
        body: JSON.stringify({ ...address, apartment: address.apartment ?? "", isDefault: true }),
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
        toast.error(data?.error ?? "Couldn't delete this address.");
        return;
      }
      // The server may have moved "default" to another address — reload
      // the list so what's shown is exactly what checkout will use.
      const list = await fetch("/api/account/addresses", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      setAddresses(list?.addresses ?? addresses.filter((a) => a.id !== deleting.id));
      toast.success("Address deleted");
      if (editing === deleting.id) setEditing(null);
      setDeleting(null);
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setDeletePending(false);
    }
  };

  const atLimit = addresses.length >= MAX_SAVED_ADDRESSES;

  return (
    <section id="addresses" aria-labelledby="addresses-title" className={`${CARD} flex scroll-mt-6 flex-col gap-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="addresses-title" className={CARD_TITLE}>
            Saved Addresses
          </h2>
          <p className={CARD_SUBTITLE}>Pick one with a tap at checkout. Your default is filled in automatically.</p>
        </div>
        {editing === null && !atLimit && (
          <button type="button" onClick={openNew} className={SMALL_PRIMARY}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            Add address
          </button>
        )}
      </div>

      {addresses.length === 0 && editing === null && (
        <div className="flex flex-col items-center gap-2 rounded-[20px] bg-[#F9F6F3] px-4 py-8 text-center">
          <MapPin className="h-6 w-6 text-black/40" aria-hidden="true" />
          <p className="font-sora text-[13px] font-semibold text-black">No saved addresses yet</p>
          <p className="max-w-[340px] font-sora text-[12px] text-black/55">
            Save your home or office once — next time, checkout is just one tap.
          </p>
        </div>
      )}

      {addresses.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {addresses.map((address) => {
            const Icon = iconFor(address.label);
            return (
              <li
                key={address.id}
                className={`flex min-w-0 flex-col gap-3 rounded-[20px] bg-[#F9F6F3] p-4 md:p-5 ${address.isDefault ? "ring-2 ring-[#FF9540]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                    <Icon className="h-4 w-4 text-black" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-frank-ruhl text-[20px] font-semibold leading-[1.14] text-black">
                      {address.label}
                      {address.isDefault && (
                        <span className="rounded-full bg-[#FFF1E5] px-2.5 py-1 font-sora text-[11px] font-semibold leading-none text-[#FF7100]">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 break-words font-sora text-[13px] leading-[1.6] text-black/70 md:text-[14px]">
                      {address.address}
                      {address.apartment ? `, ${address.apartment}` : ""}
                      <br />
                      {address.city}, {address.state} {address.zip}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(address)} className={SMALL_OUTLINE}>
                    Edit
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => makeDefault(address)}
                      disabled={busyId === address.id}
                      className={SMALL_OUTLINE}
                    >
                      {busyId === address.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleting(address)}
                    className="inline-flex h-9 items-center rounded-full px-3 font-sora text-[12px] font-semibold text-[#D72A37] hover:bg-[#FAE7EC]"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {atLimit && editing === null && (
        <p className="font-sora text-[12px] text-black/55">
          You&apos;ve saved {MAX_SAVED_ADDRESSES} addresses, the most allowed. Delete one to add another.
        </p>
      )}

      {editing !== null && (
        <form onSubmit={save} noValidate className="flex flex-col gap-4 rounded-[20px] border border-black/10 bg-white p-4 md:p-5">
          <p className="font-sora text-[14px] font-semibold text-black">
            {editing === "new" ? "New address" : "Edit address"}
          </p>

          <div>
            <span className={FIELD_LABEL}>Save as</span>
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
              placeholder="e.g. Mom's place"
              className={`${INPUT} mt-2`}
            />
            {errors.label && <p className={FIELD_ERROR}>{errors.label}</p>}
          </div>

          <div>
            <label htmlFor="addr-street" className={FIELD_LABEL}>
              Street address <span className="text-[#D72A37]">*</span>
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
            {errors.address && <p className={FIELD_ERROR}>{errors.address}</p>}
          </div>

          <div>
            <label htmlFor="addr-apartment" className={FIELD_LABEL}>
              Apartment, floor etc <span className="font-normal text-black/40">(optional)</span>
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
                <label htmlFor={`addr-${key}`} className={FIELD_LABEL}>
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
                {errors[key] && <p className={FIELD_ERROR}>{errors[key]}</p>}
              </div>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={set("isDefault")}
              className="h-4 w-4 rounded border-black/20 accent-[#FF9540]"
            />
            <span className="font-sora text-[12px] text-black/75">Use as my default delivery address</span>
          </label>

          {errors.form && (
            <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
              {errors.form}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="inline-flex h-11 items-center rounded-full px-5 font-sora text-[14px] font-semibold text-black/70 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.label ?? ""}"?`}
        message={
          deleting?.isDefault && addresses.length > 1
            ? "This is your default address. Another saved address will become the default."
            : "Past orders keep their own copy of the address, so nothing already delivered changes."
        }
        confirmLabel="Delete"
        tone="danger"
        pending={deletePending}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
