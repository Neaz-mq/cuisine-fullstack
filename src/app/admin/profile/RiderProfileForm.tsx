"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Lock, Save } from "lucide-react";
import { toast } from "react-toastify";
import CountryCodeSelect, { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/components/CountryCodeSelect";
import { DateField, SelectField } from "@/components/admin/modal-ui";
import AvatarUploadDialog from "@/components/account/AvatarUploadDialog";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { GENDER_OPTIONS } from "@/lib/validations/account";
import { RIDER_VEHICLE_TYPES } from "@/lib/validations/delivery";
import type { RiderDocumentView } from "@/lib/rider-documents";
import { GRADIENT_BG, RiderPageHeader } from "@/app/admin/my-deliveries/rider-ui";
import RiderDocuments from "./RiderDocuments";

/**
 * Rider panel → My Profile (Figma "Profile"):
 *
 *   Welcome Back, Ridoy Ahmed!                  [date] [Save Change]
 *   Profile Details          Member since Jun 2024
 *     photo + Change Photo
 *     Full Name | Phone Number · Email · Permanent Address | NID ·
 *     Date of Birth · Gender
 *   Vehicle Details   Vehicle Type | Model · License Plate | Driving License
 *   Documents         Driving License · Vehicle Registration · Insurance
 *
 * One "Save Change" saves the profile and vehicle together
 * (PATCH /api/rider/profile). The photo and each document save on their
 * own, from their dialogs. Email is the login and can't change here; the
 * NID can be added once, then only the restaurant changes it.
 *
 * Figma's search box and Export Report are left out — there is nothing to
 * search or export on a profile.
 */

const CARD = "flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:gap-10 md:rounded-[30px] md:p-[30px]";
const CARD_TITLE =
  "font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[32px] xl:text-[36px]";
const LABEL = "block font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black";
const INPUT =
  "h-[43px] w-full rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[12px]";
const ERROR = "font-sora text-[12px] text-[#D72A37]";
const GRID = "grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[640px]:gap-4";
const PRIMARY =
  `inline-flex h-[45px] items-center justify-center gap-2 whitespace-nowrap rounded-full ${GRADIENT_BG} px-4 font-sora text-[14px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:text-[16px]`;
const OUTLINE =
  "inline-flex h-[45px] items-center justify-center whitespace-nowrap rounded-[90px] border border-black px-4 font-sora text-[14px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:text-[16px]";

const GENDER_SELECT_OPTIONS = [{ value: "", label: "Prefer not to say" }, ...GENDER_OPTIONS];
const VEHICLE_OPTIONS = [{ value: "", label: "Not set" }, ...RIDER_VEHICLE_TYPES.map((type) => ({ value: type, label: type }))];

export type RiderProfileInitial = {
  name: string;
  email: string;
  image: string | null;
  hasUploadedPhoto: boolean;
  phoneCountryCode: string | null;
  phoneNumber: string;
  address: string;
  nid: string;
  dateOfBirth: string;
  gender: string;
  memberSinceLabel: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlate: string;
  drivingLicenseNumber: string;
};

type Errors = Partial<Record<"name" | "phone" | "dateOfBirth" | "nid" | "form", string>>;

export default function RiderProfileForm({
  initial,
  documents,
  today,
  nowIso,
}: {
  initial: RiderProfileInitial;
  documents: RiderDocumentView[];
  /** Restaurant's today, "YYYY-MM-DD". */
  today: string;
  nowIso: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [ty, tm, td] = today.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);

  const initialCountry = COUNTRIES.find((c) => c.code === initial.phoneCountryCode) ?? DEFAULT_COUNTRY;
  const [values, setValues] = useState(initial);
  const [country, setCountry] = useState<Country>(initialCountry);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const nidLocked = initial.nid !== "";

  const set = <K extends keyof RiderProfileInitial>(key: K, value: RiderProfileInitial[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const phoneE164 = values.phoneNumber.trim() ? toE164(country.dial, values.phoneNumber) : "";
  const dirty =
    (Object.keys(initial) as (keyof RiderProfileInitial)[]).some(
      (key) => typeof initial[key] === "string" && (values[key] as string).trim() !== (initial[key] as string).trim()
    ) ||
    (values.phoneNumber.trim() !== "" && country.code !== initialCountry.code);

  const reset = () => {
    setValues(initial);
    setCountry(initialCountry);
    setErrors({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!values.name.trim()) next.name = "Please enter your name.";
    if (phoneE164 && !isValidPhone(phoneE164)) next.phone = `That doesn't look like a valid ${country.name} number.`;
    if (values.dateOfBirth && values.dateOfBirth > today) next.dateOfBirth = "Your date of birth can't be in the future.";
    const nid = values.nid.replace(/\s+/g, "");
    if (!nidLocked && nid && !/^(\d{10}|\d{13}|\d{17})$/.test(nid)) next.nid = "NID should be 10, 13 or 17 digits.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      const res = await fetch("/api/rider/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: phoneE164,
          address: values.address.trim(),
          nid: nidLocked ? "" : nid,
          dateOfBirth: values.dateOfBirth,
          gender: values.gender,
          vehicleType: values.vehicleType,
          vehicleModel: values.vehicleModel.trim(),
          vehiclePlate: values.vehiclePlate.trim(),
          drivingLicenseNumber: values.drivingLicenseNumber.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: data?.error ?? "Couldn't save your details." });
        return;
      }
      if (values.name.trim() !== initial.name.trim()) await update({ name: values.name.trim() });
      toast.success("Your profile is saved");
      router.refresh();
    } catch {
      setErrors({ form: "No connection. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const initialLetter = (initial.name || initial.email).trim().charAt(0).toUpperCase() || "?";

  const actions = (compact: boolean) => (
    <>
      {dirty && (
        <button type="button" onClick={reset} disabled={saving} className={OUTLINE}>
          Cancel
        </button>
      )}
      <button type="submit" form="rider-profile-form" disabled={saving || !dirty} className={PRIMARY}>
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          compact && <Save className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        )}
        {saving ? "Saving…" : "Save Change"}
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader name={initial.name || undefined} now={new Date(nowIso)} actions={actions(true)} />

      <form id="rider-profile-form" onSubmit={save} noValidate className="flex flex-col gap-5">
        {/* --- Profile Details --- */}
        <section aria-labelledby="rider-profile-title" className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h2 id="rider-profile-title" className={CARD_TITLE}>
              Profile Details
            </h2>
            <p className="font-sora text-[14px] leading-[1.14] tracking-[-0.01em] text-black/70 md:text-[18px]">
              Member since {initial.memberSinceLabel}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-5">
              <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9D9D9] md:h-[82px] md:w-[82px]">
                {initial.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Google or Supabase URL, already sized
                  <img src={initial.image} alt="Your profile photo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="font-frank-ruhl text-[30px] font-semibold text-black/70" aria-hidden="true">
                    {initialLetter}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => setPhotoOpen(true)} className={PRIMARY.replace("h-[45px]", "h-[46px] px-5")}>
                Change Photo
              </button>
            </div>

            <div className="h-px w-full bg-[#D9D9D9]" aria-hidden="true" />

            <div className="flex flex-col gap-5">
              <div className={GRID}>
                <Field id="rider-name" label="Full Name" required error={errors.name}>
                  <input
                    id="rider-name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Your full name"
                    value={values.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={INPUT}
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>

                <Field id="rider-phone" label="Phone Number" error={errors.phone}>
                  <div className="flex h-[43px] items-center rounded-[12px] bg-[#F9F6F3] focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                    <div className="flex h-full shrink-0 items-stretch [&_button]:border-r-0 [&_button]:bg-transparent [&_button]:pl-3 [&_button]:pr-0 [&_button]:text-[12px] [&_button]:text-black/70">
                      <CountryCodeSelect value={country} onChange={setCountry} />
                    </div>
                    <span className="ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
                    <input
                      id="rider-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      value={values.phoneNumber}
                      onChange={(e) => set("phoneNumber", e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={examplePhone(country.code) || "0000000000"}
                      className="h-full min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none md:text-[12px]"
                      aria-invalid={Boolean(errors.phone)}
                    />
                  </div>
                </Field>
              </div>

              <Field id="rider-email" label="Email Address" hint="This is your login, so it can't be changed here.">
                <div className="relative">
                  <input
                    id="rider-email"
                    type="email"
                    value={initial.email}
                    readOnly
                    className={`${INPUT} cursor-not-allowed pr-10 text-black/70`}
                  />
                  <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/50" aria-hidden="true" />
                </div>
              </Field>

              <div className={GRID}>
                <Field id="rider-address" label="Permanent Address">
                  <input
                    id="rider-address"
                    type="text"
                    autoComplete="street-address"
                    maxLength={200}
                    placeholder="House, road, area, city"
                    value={values.address}
                    onChange={(e) => set("address", e.target.value)}
                    className={INPUT}
                  />
                </Field>

                <Field
                  id="rider-nid"
                  label="NID Number"
                  error={errors.nid}
                  hint={nidLocked ? "On file — ask the restaurant to change it." : "10, 13 or 17 digits. You can add it once."}
                >
                  <div className="relative">
                    <input
                      id="rider-nid"
                      type="text"
                      inputMode="numeric"
                      maxLength={20}
                      placeholder="2356 7654 8634"
                      value={values.nid}
                      readOnly={nidLocked}
                      onChange={(e) => set("nid", e.target.value.replace(/[^\d\s]/g, ""))}
                      className={`${INPUT} ${nidLocked ? "cursor-not-allowed pr-10 text-black/70" : ""}`}
                      aria-invalid={Boolean(errors.nid)}
                    />
                    {nidLocked && (
                      <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/50" aria-hidden="true" />
                    )}
                  </div>
                </Field>
              </div>

              <div className="min-w-0">
                <DateField
                  id="rider-dob"
                  label="Date of Birth"
                  value={values.dateOfBirth}
                  onChange={(value) => set("dateOfBirth", value)}
                  minDate={new Date(1900, 0, 1)}
                  maxDate={todayDate}
                  yearPicker
                  showToday={false}
                  clearable
                  compact
                  placeholder="mm/dd/yyyy"
                />
                {errors.dateOfBirth && <p className={ERROR}>{errors.dateOfBirth}</p>}
              </div>

              <SelectField
                id="rider-gender"
                label="Gender"
                value={values.gender}
                onChange={(value) => set("gender", value)}
                options={GENDER_SELECT_OPTIONS}
                className="min-w-0"
              />
            </div>
          </div>
        </section>

        {/* --- Vehicle Details --- */}
        <section aria-labelledby="rider-vehicle-title" className={CARD.replace("md:gap-10", "md:gap-6")}>
          <h2 id="rider-vehicle-title" className={CARD_TITLE}>
            Vehicle Details
          </h2>
          <div className="flex flex-col gap-5">
            <div className={GRID}>
              <SelectField
                id="rider-vehicle-type"
                label="Vehicle Type"
                value={values.vehicleType}
                onChange={(value) => set("vehicleType", value)}
                options={VEHICLE_OPTIONS}
                className="min-w-0"
              />
              <Field id="rider-vehicle-model" label="Model">
                <input
                  id="rider-vehicle-model"
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Honda CB Hornet 160R"
                  value={values.vehicleModel}
                  onChange={(e) => set("vehicleModel", e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
            <div className={GRID}>
              <Field id="rider-vehicle-plate" label="License Plate">
                <input
                  id="rider-vehicle-plate"
                  type="text"
                  maxLength={30}
                  placeholder="e.g. DHAKA METRO-LA 12-3456"
                  value={values.vehiclePlate}
                  onChange={(e) => set("vehiclePlate", e.target.value.toUpperCase())}
                  className={INPUT}
                />
              </Field>
              <Field id="rider-license" label="Driving License Number">
                <input
                  id="rider-license"
                  type="text"
                  maxLength={30}
                  placeholder="e.g. DL-99213847"
                  value={values.drivingLicenseNumber}
                  onChange={(e) => set("drivingLicenseNumber", e.target.value.toUpperCase())}
                  className={INPUT}
                />
              </Field>
            </div>
          </div>

          {errors.form && (
            <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
              {errors.form}
            </p>
          )}

          {/* The same buttons as the header, for whoever scrolled down to edit. */}
          <div className="flex flex-wrap items-center gap-2">{actions(false)}</div>
        </section>
      </form>

      <RiderDocuments initial={documents} today={today} />

      <p className="rounded-[16px] bg-white px-4 py-3 font-sora text-[13px] text-black/70">
        Password and two-step sign-in are in{" "}
        <Link href="/admin/my-deliveries/settings" className="font-semibold text-[#FF7100] hover:underline">
          Settings
        </Link>
        .
      </p>

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
    </div>
  );
}

function Field({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label} {required && <span className="text-[#D72A37]">*</span>}
      </label>
      {children}
      {error ? (
        <p className={ERROR}>{error}</p>
      ) : (
        hint && <p className="font-sora text-[11px] leading-[1.5] text-black/50">{hint}</p>
      )}
    </div>
  );
}
