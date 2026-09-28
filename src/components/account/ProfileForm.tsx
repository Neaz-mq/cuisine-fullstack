"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarDays, Loader2, Lock } from "lucide-react";
import { toast } from "react-toastify";
import CountryCodeSelect, { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/components/CountryCodeSelect";
import { SelectField } from "@/components/admin/modal-ui";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { GENDER_OPTIONS } from "@/lib/validations/account";
import AvatarUploadDialog from "./AvatarUploadDialog";
import { CARD, CARD_TITLE, GRADIENT } from "./ui";

/**
 * Customer panel → Profile Details (Figma "Web/My Account — Profile").
 *
 *   header   — "Profile Details" + "Member since Jun 2024"
 *   photo    — 82px avatar + "Change Photo" (opens AvatarUploadDialog)
 *   fields   — Full Name | Phone Number, Email Address (read-only),
 *              Date of Birth, Gender
 *   buttons  — Save Change (gradient) + Cancel (outline, puts the saved
 *              values back)
 *
 * The phone box works like the register page and checkout: flag picker +
 * national number, stored as E.164. After saving, the navbar name updates
 * straight away (session update) — no need to sign out and in.
 */

/** Figma field label: Frank Ruhl Libre 500, 14px, line-height 160%. */
const LABEL = "block font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black";

/** Figma field: 43px, cream #F9F6F3, radius 12, padding 12, Sora 12px. */
const INPUT =
  "h-[43px] w-full rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[12px]";

const ERROR = "font-sora text-[12px] text-[#D72A37]";

/** "" (not answered) shows as "Prefer not to say", first in the list. */
const GENDER_SELECT_OPTIONS = [{ value: "", label: "Prefer not to say" }, ...GENDER_OPTIONS];

type Initial = {
  name: string;
  email: string;
  image: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string;
  /** "YYYY-MM-DD" or "". */
  dateOfBirth: string;
  /** A GENDER_OPTIONS value, or "" = prefer not to say. */
  gender: string;
  memberSinceLabel: string;
  signedInWithGoogle: boolean;
  hasUploadedPhoto: boolean;
};

export default function ProfileForm({ initial, today }: { initial: Initial; today: string }) {
  const router = useRouter();
  const { update } = useSession();

  const initialCountry = COUNTRIES.find((c) => c.code === initial.phoneCountryCode) ?? DEFAULT_COUNTRY;

  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState<Country>(initialCountry);
  const [number, setNumber] = useState(initial.phoneNumber);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [gender, setGender] = useState(initial.gender);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; dateOfBirth?: string; form?: string }>({});

  const phoneE164 = number.trim() ? toE164(country.dial, number) : "";
  const dirty =
    name.trim() !== initial.name.trim() ||
    number.trim() !== initial.phoneNumber.trim() ||
    (number.trim() !== "" && country.code !== initialCountry.code) ||
    dateOfBirth !== initial.dateOfBirth ||
    gender !== initial.gender;

  const reset = () => {
    setName(initial.name);
    setCountry(initialCountry);
    setNumber(initial.phoneNumber);
    setDateOfBirth(initial.dateOfBirth);
    setGender(initial.gender);
    setErrors({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (phoneE164 && !isValidPhone(phoneE164)) next.phone = `That doesn't look like a valid ${country.name} number.`;
    if (dateOfBirth && dateOfBirth > today) next.dateOfBirth = "Your date of birth can't be in the future.";
    setErrors(next);
    if (next.name || next.phone || next.dateOfBirth) return;

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phoneE164, dateOfBirth, gender }),
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

  const initialLetter = (initial.name || initial.email).trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <form
        onSubmit={save}
        noValidate
        aria-labelledby="profile-details-title"
        className={`${CARD} flex flex-col gap-8 md:gap-10`}
      >
        {/* Figma: title left, "Member since" right */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 id="profile-details-title" className={CARD_TITLE}>
            Profile Details
          </h2>
          <p className="font-sora text-[14px] leading-[1.14] tracking-[-0.01em] text-black/70 md:text-[18px]">
            Member since {initial.memberSinceLabel}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Photo */}
          <div className="flex items-center gap-5">
            <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9D9D9] md:h-[82px] md:w-[82px]">
              {initial.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- Google or Supabase URL, already sized
                <img
                  src={initial.image}
                  alt="Your profile photo"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-frank-ruhl text-[30px] font-semibold text-black/70" aria-hidden="true">
                  {initialLetter}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className={`inline-flex h-[46px] items-center justify-center rounded-full ${GRADIENT} px-5 font-sora text-[15px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]`}
            >
              Change Photo
            </button>
          </div>

          <div className="h-px w-full bg-[#D9D9D9]" aria-hidden="true" />

          <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-5">
              {/* Full Name | Phone Number */}
              <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[640px]:gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="profile-name" className={LABEL}>
                    Full Name <span className="text-[#D72A37]">*</span>
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    className={INPUT}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className={ERROR}>{errors.name}</p>}
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="profile-phone" className={LABEL}>
                    Phone Number
                  </label>
                  <div className="flex h-[43px] items-center rounded-[12px] bg-[#F9F6F3] focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                    <div className="flex h-full shrink-0 items-stretch [&_button]:border-r-0 [&_button]:bg-transparent [&_button]:pl-3 [&_button]:pr-0 [&_button]:text-[12px] [&_button]:text-black/70">
                      <CountryCodeSelect value={country} onChange={setCountry} />
                    </div>
                    <span className="ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
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
                      placeholder={examplePhone(country.code) || "0000000000"}
                      className="h-full min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none md:text-[12px]"
                      aria-invalid={Boolean(errors.phone)}
                    />
                  </div>
                  {errors.phone && <p className={ERROR}>{errors.phone}</p>}
                </div>
              </div>

              {/* Email Address — the login, so read-only */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="profile-email" className={LABEL}>
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="profile-email"
                    type="email"
                    value={initial.email}
                    readOnly
                    aria-describedby="profile-email-note"
                    className={`${INPUT} cursor-not-allowed pr-10 text-black/70`}
                  />
                  <Lock
                    className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/50"
                    aria-hidden="true"
                  />
                </div>
                <p id="profile-email-note" className="font-sora text-[11px] leading-[1.5] text-black/50">
                  {initial.signedInWithGoogle
                    ? "You sign in with this Google account, so the email can't be changed here."
                    : "This is your login, so it can't be changed here."}
                </p>
              </div>

              {/* Date of Birth */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="profile-dob" className={LABEL}>
                  Date of Birth
                </label>
                <div className="relative">
                  <input
                    id="profile-dob"
                    type="date"
                    min="1900-01-01"
                    max={today}
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
                    }}
                    className={`${INPUT} pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:h-6 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${
                      dateOfBirth ? "" : "text-black/70"
                    }`}
                    aria-invalid={Boolean(errors.dateOfBirth)}
                  />
                  <CalendarDays
                    className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </div>
                {errors.dateOfBirth && <p className={ERROR}>{errors.dateOfBirth}</p>}
              </div>

              {/* Gender — the same dropdown as the rest of the site
                  (reservation form, admin modals), not the browser's. */}
              <SelectField
                id="profile-gender"
                label="Gender"
                value={gender}
                onChange={setGender}
                options={GENDER_SELECT_OPTIONS}
                className="min-w-0"
              />
            </div>

            {errors.form && (
              <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
                {errors.form}
              </p>
            )}

            {/* Figma: Save Change (gradient) + Cancel (outline), 8px apart */}
            <div className="flex flex-wrap items-start gap-2">
              <button
                type="submit"
                disabled={saving || !dirty}
                className={`inline-flex h-[46px] items-center justify-center gap-2 rounded-full ${GRADIENT} px-5 font-sora text-[15px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? "Saving…" : "Save Change"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={saving || !dirty}
                className="inline-flex h-[46px] items-center justify-center rounded-[90px] border border-black px-5 font-sora text-[15px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-black md:text-[16px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>

      <AvatarUploadDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        currentImage={initial.image}
        canRemove={initial.hasUploadedPhoto}
        onSaved={async (image) => {
          await update({ image });
          router.refresh();
        }}
      />
    </>
  );
}
