"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import CountryCodeSelect, { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/components/CountryCodeSelect";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { CARD, CARD_SUBTITLE, CARD_TITLE, FIELD_ERROR, FIELD_INPUT, FIELD_LABEL, PRIMARY_BUTTON } from "./ui";

/**
 * Customer panel → Profile → "Personal details" and "Offers by email".
 *
 * The phone box works exactly like the register page and checkout: flag
 * picker + national number, stored as E.164. On save the navbar name is
 * refreshed straight away (session update) — no need to sign out and in.
 */
export default function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    email: string;
    phoneCountryCode: string | null;
    phoneNumber: string;
    marketingConsent: boolean;
    signedInWithGoogle: boolean;
  };
}) {
  const router = useRouter();
  const { update } = useSession();

  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === initial.phoneCountryCode) ?? DEFAULT_COUNTRY
  );
  const [number, setNumber] = useState(initial.phoneNumber);
  const [offers, setOffers] = useState(initial.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});

  const phoneE164 = number.trim() ? toE164(country.dial, number) : "";
  const dirty =
    name.trim() !== initial.name.trim() ||
    offers !== initial.marketingConsent ||
    number.trim() !== initial.phoneNumber.trim() ||
    (number.trim() !== "" && country.code !== (initial.phoneCountryCode ?? DEFAULT_COUNTRY.code));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (phoneE164 && !isValidPhone(phoneE164)) next.phone = `That doesn't look like a valid ${country.name} number.`;
    setErrors(next);
    if (next.name || next.phone) return;

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phoneE164, marketingConsent: offers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: data?.error ?? "Couldn't save your details." });
        return;
      }
      await update({ name: name.trim() });
      toast.success("Your details are saved");
      router.refresh();
    } catch {
      setErrors({ form: "No connection. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className={`${CARD} flex flex-col gap-5`} noValidate>
      <div>
        <h2 className={CARD_TITLE}>Profile Details</h2>
        <p className={CARD_SUBTITLE}>Used to fill in checkout and to reach you about your order.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="profile-name" className={FIELD_LABEL}>
            Full name <span className="text-[#D72A37]">*</span>
          </label>
          <input
            id="profile-name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            className={FIELD_INPUT}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className={FIELD_ERROR}>{errors.name}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="profile-phone" className={FIELD_LABEL}>
            Phone number
          </label>
          <div className="flex h-[50px] items-stretch rounded-[12px] bg-[#F9F6F3] focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
            <div className="flex shrink-0 items-stretch [&_button]:border-r-0 [&_button]:pl-3 [&_button]:pr-0 [&_button]:text-[13px]">
              <CountryCodeSelect value={country} onChange={setCountry} />
            </div>
            <span className="my-auto ml-3 h-7 w-px shrink-0 bg-[#E6E1DC]" aria-hidden="true" />
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value.replace(/[^\d]/g, ""));
                setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              placeholder={examplePhone(country.code) || "Phone number"}
              className="min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[13px] leading-none text-black placeholder:text-black/35 focus:outline-none"
              aria-invalid={Boolean(errors.phone)}
            />
          </div>
          {errors.phone && <p className={FIELD_ERROR}>{errors.phone}</p>}
        </div>

        <div className="min-w-0 min-[640px]:col-span-2">
          <label htmlFor="profile-email" className={FIELD_LABEL}>
            Email address
          </label>
          <input id="profile-email" type="email" value={initial.email} disabled className={FIELD_INPUT} />
          <p className="mt-1.5 font-sora text-[11px] text-black/50">
            {initial.signedInWithGoogle
              ? "You sign in with this Google account, so the email can't be changed here."
              : "This is your login, so it can't be changed here. Contact us if you need to move your account."}
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[16px] bg-[#F9F6F3] px-4 py-3.5">
        <input
          type="checkbox"
          checked={offers}
          onChange={(e) => setOffers(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 accent-[#FF9540]"
        />
        <span>
          <span className="block font-sora text-[13px] font-semibold text-black">Email me offers and discounts</span>
          <span className="block font-sora text-[12px] text-black/55">
            New dishes, coupon codes and member deals. No spam — turn it off any time.
          </span>
        </span>
      </label>

      {errors.form && (
        <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
          {errors.form}
        </p>
      )}

      <button type="submit" disabled={saving || !dirty} className={`${PRIMARY_BUTTON} self-start`}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
