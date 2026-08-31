"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, Loader2, X } from "lucide-react";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  type Country,
} from "@/components/CountryCodeSelect";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { SHIFTS, SHIFT_LABELS } from "@/lib/staff-shift";
import { ROLE_LABELS } from "@/lib/staff-roles";
import { STAFF_ROLES, type StaffRole } from "@/lib/permissions";

/**
 * src/app/admin/staff/AddStaffModal.tsx
 *
 * Figma-র "Add New Staff" modal — ছবি upload, নাম, ফোন (country code সহ),
 * ইমেইল, স্থায়ী ঠিকানা, NID, role, join date, shift, status।
 *
 * ── কেন modal, আলাদা পাতা নয় ──────────────────────────────────────────
 *
 * /admin/staff/new পাতাটা রয়ে গেছে (StaffForm সহ) এবং এখনো কাজ করে —
 * সেখানে department, employment type, salary, password reset-এর মতো
 * ক্ষেত্রগুলো আছে যেগুলো নকশার modal-এ নেই। অর্থাৎ modal-টা দ্রুত
 * "কর্মী যোগ করুন", আর পাতাটা পূর্ণ record সম্পাদনা। দুটোই একই API
 * (POST /api/admin/staff) ব্যবহার করে, তাই নিয়মকানুন এক জায়গাতেই থাকে।
 *
 * ── password ─────────────────────────────────────────────────────────
 *
 * নকশায় password-এর কোনো ঘর নেই, তাই modal থেকে কোনো password পাঠানোও
 * হয় না। route তখন একটা random password বসিয়ে কর্মীকে "নিজের password
 * ঠিক করুন" link পাঠায় — বিস্তারিত ব্যাখ্যা POST /api/admin/staff-এ।
 */

/* ── Figma-র ইনপুট গড়ন, এক জায়গায় ────────────────────────────────────
 *
 * উচ্চতা 50, radius 12, BG #F9F6F3, কোনো পাড় নেই, লেখা Sora 400 15px।
 * placeholder Black/40 — নকশার ধূসর নমুনা লেখাগুলো ("Chicken Breast",
 * "Charmatha, Bogura") আসলে placeholder, ভরাট মান নয়।
 *
 * focus চিহ্নটা `ring-*` নয়, `outline` — কারণ Tailwind-এর ring একটা
 * দুই-স্তরের box-shadow যার প্রথম স্তর (ring-offset-color) ডিফল্টে সাদা,
 * আর cream ইনপুটের কিনারায় সেই সাদা রেখাটা ফাঁক হয়ে ফুটে ওঠে।
 * বিস্তারিত FilterMenu.tsx-এ।
 */
const FIELD =
  "h-[50px] w-full rounded-[12px] border-0 bg-[#F9F6F3] px-4 font-sora text-[15px] font-normal leading-none text-black placeholder:text-black/40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

const LABEL = "mb-2 block font-frank-ruhl text-[15px] font-medium leading-none text-black";

type Props = {
  open: boolean;
  onClose: () => void;
  viewerRole?: string;
  /** OWNER কি না — NID ঘরটা কেবল তখনই দেখানো হয়, নিচের মন্তব্য দ্রষ্টব্য। */
  canSeeSensitive: boolean;
};

export default function AddStaffModal({ open, onClose, viewerRole, canSeeSensitive }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nid, setNid] = useState("");
  const [role, setRole] = useState<StaffRole>("MANAGER");
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<string>("EVENING");
  const [isActive, setIsActive] = useState(true);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * MANAGER-কে OWNER বানানো যায় না (canManageStaffRole), তাই তালিকাতেই
   * অপশনটা রাখা হয় না — API যেটা reject করবে, form-এর সেটা প্রস্তাব
   * করাই উচিত নয়।
   */
  const roleOptions = STAFF_ROLES.filter((r) => viewerRole === "OWNER" || r !== "OWNER");

  // Escape দিয়ে বন্ধ + খোলা অবস্থায় পেছনের পাতা scroll বন্ধ। দ্বিতীয়টা
  // না করলে mobile-এ modal-এর ভেতরে scroll করতে গিয়ে পেছনের তালিকাটা
  // সরে যেত, আর বন্ধ করার পর ব্যবহারকারী অন্য জায়গায় গিয়ে পড়তেন।
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function uploadFile(file: File) {
    setError(null);

    // Client-side গার্ড — route-এও একই যাচাই আছে (এটাই আসল গার্ড), কিন্তু
    // ২০MB ফাইল আপলোড করে তারপর "খুব বড়" শোনার চেয়ে আগেই বলে দেওয়া ভালো।
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG or WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // MenuItemForm-এর সাথে একই route — staff avatar-এর জন্য আলাদা
      // bucket বানানোর দরকার নেই, একই Supabase bucket, একই RBAC।
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed. Please try again.");
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Staff name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    // ফোন ঐচ্ছিক, কিন্তু দিলে সেটা বৈধ হতে হবে — অর্ধেক নম্বর রাখার
    // চেয়ে ফাঁকা রাখা ভালো, কারণ পরে কেউ ওটায় ফোন করার চেষ্টা করবেন।
    let e164: string | null = null;
    if (phone.trim()) {
      e164 = toE164(country.dial, phone);
      if (!isValidPhone(e164)) {
        setError(`That doesn't look like a valid ${country.name} phone number.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          phone: e164 ?? "",
          address: address.trim(),
          // ⚠️ hireDate-এ সময় যোগ করা হয় না। <input type="date"> দেয়
          // "2026-07-24", আর `new Date("2026-07-24")` সেটাকে UTC মধ্যরাত
          // ধরে — ঢাকায় (UTC+6) সেটা ২৪ তারিখ সকাল ৬টা, অর্থাৎ তারিখটা
          // ঠিকই থাকে। উল্টোদিকের timezone-এ (যেমন UTC−5) এটা আগের দিন
          // দেখাত, কিন্তু এই panel একটাই রেস্তোরাঁর, আর server-ও UTC —
          // তাই বাড়তি জটিলতা যোগ না করে এটা এভাবেই রাখা।
          hireDate: hireDate || undefined,
          shift: shift || undefined,
          isActive,
          ...(imageUrl ? { image: imageUrl } : {}),
          // NID শুধু OWNER পাঠায়। MANAGER পাঠালে route এমনিতেই চুপচাপ
          // অগ্রাহ্য করত, কিন্তু তখন ঘরটা দেখা যেত অথচ কাজ করত না —
          // সেটা "ভাঙা" মনে হয়। তাই ঘরটাই দেখানো হয় না।
          ...(canSeeSensitive && nid.trim() ? { nid: nid.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8 backdrop-blur-[2px] sm:p-6"
      // পটভূমিতে click করলে বন্ধ — কিন্তু কেবল পটভূমিতেই, তাই
      // `event.target === event.currentTarget`। নাহলে modal-এর ভেতরে
      // লেখা select করে mouse ছাড়লেও বন্ধ হয়ে যেত, আর তখন ভরাট করা
      // form-টা হারাত।
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-title"
    >
      {/* Figma: সাদা কার্ড, radius 24, padding 30, চওড়া ~900। */}
      <div className="my-auto w-full max-w-[900px] rounded-[24px] bg-white p-5 sm:p-[30px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2
            id="add-staff-title"
            className="font-frank-ruhl text-[24px] font-semibold leading-none text-black sm:text-[28px]"
          >
            Add New Staff
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-[12px] bg-red-50 px-4 py-3 font-sora text-[13px] leading-[1.6] text-red-600"
          >
            {error}
          </p>
        )}

        {/* ── ছবির drop-zone ────────────────────────────────────────────
            Figma: cream বাক্স, radius 16, ভেতরে সাদা বৃত্তে camera icon,
            নিচে দু'লাইন লেখা।

            ⚠️ এটা <button> নয়, একটা <label htmlFor> — ভেতরে যদি কখনো
            আরেকটা বোতাম বসে (যেমন "Remove"), nested button হলে সেটা
            অবৈধ HTML হতো এবং click দুটোতেই যেত। label-এ সেই সমস্যা নেই,
            অথচ keyboard/screen reader দুটোতেই ফাইল ঘরটা ঠিকমতো পৌঁছয়। */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            // একই ফাইল আবার বাছলেও onChange চালু হয় — না করলে ভুল করে
            // মুছে ফেলার পর ওই একই ফাইল আর বাছাই করা যেত না।
            event.target.value = "";
          }}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
          className={`mb-6 rounded-[16px] transition-colors ${
            dragging ? "bg-[#FF9540]/10" : "bg-[#F9F6F3]"
          }`}
        >
          {imageUrl ? (
            <div className="flex flex-col items-center gap-3 px-6 py-6">
              {/* next/image নয় — UserAvatar-এর একই কারণ: Supabase host-টা
                  env-নির্ভর, আর একটা ৮০px preview-তে optimization-এর লাভ
                  সামান্য। */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Staff photo preview"
                className="h-20 w-20 rounded-[16px] object-cover"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-sora text-[13px] font-medium text-black underline underline-offset-2"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="font-sora text-[13px] font-medium text-red-500 underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-3 px-6 py-8 text-center focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] sm:py-10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-black/60" aria-hidden="true" />
                ) : (
                  <Camera className="h-5 w-5 text-black/80" strokeWidth={1.6} aria-hidden="true" />
                )}
              </span>
              <span className="font-frank-ruhl text-[16px] font-semibold leading-none text-black sm:text-[18px]">
                {uploading ? "Uploading…" : "Drop images here or click to upload"}
              </span>
              <span className="font-sora text-[13px] leading-none text-black/50">
                PNG, JPG, WEBP up to 2MB each. Recommended 1200×800px
              </span>
            </button>
          )}
        </div>

        {/* ── ঘরগুলো ─────────────────────────────────────────────────────
            Figma: দুই কলাম, gap 24। ৬৪০-এর নিচে এক কলাম — দুটো ঘর
            পাশাপাশি বসালে প্রতিটার ভেতরে ~১২০px থাকত, আর country code
            pill-সহ ফোনের ঘরটা ওতে আঁটে না। */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <div>
            <label htmlFor="staff-name" className={LABEL}>
              Staff Name
            </label>
            <input
              id="staff-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ridoy Ahmed"
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="staff-phone" className={LABEL}>
              Phone Number
            </label>
            {/* register পাতার হুবহু একই গড়ন: country pill + input এক
                বাক্সে। overflow-hidden ইচ্ছাকৃতভাবে নেই — থাকলে country
                dropdown-টা clip হয়ে যেত। */}
            <div className="flex h-[50px] items-stretch rounded-[12px] bg-[#F9F6F3] focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
              <div className="flex shrink-0 items-stretch">
                <CountryCodeSelect value={country} onChange={setCountry} />
              </div>
              <input
                id="staff-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={examplePhone(country.code) || "Phone number"}
                className="min-w-0 flex-1 rounded-r-[12px] bg-transparent px-4 font-sora text-[15px] leading-none text-black placeholder:text-black/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="staff-email" className={LABEL}>
              Email Address
            </label>
            <input
              id="staff-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Invite by name or email"
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="staff-address" className={LABEL}>
              Permanent Address
            </label>
            <input
              id="staff-address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. Charmatha, Bogura"
              className={FIELD}
            />
          </div>

          {/* NID — OWNER-only, উপরের handleSubmit-এর মন্তব্য দ্রষ্টব্য।
              MANAGER-এর কাছে এই ঘরটা নেই, তাই ঠিকানার ঘরটা একা এক
              কলামে বসে; grid-এ সেটা স্বাভাবিকভাবেই সামলে যায়। */}
          {canSeeSensitive && (
            <div>
              <label htmlFor="staff-nid" className={LABEL}>
                NID Number <span className="font-sora text-[12px] text-black/40">(owner only)</span>
              </label>
              <input
                id="staff-nid"
                type="text"
                inputMode="numeric"
                value={nid}
                onChange={(event) => setNid(event.target.value)}
                placeholder="5674 8765 9875"
                className={FIELD}
              />
            </div>
          )}

          <SelectField
            id="staff-role"
            label="Role"
            value={role}
            onChange={(value) => setRole(value as StaffRole)}
            options={roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />

          <div>
            <label htmlFor="staff-hire-date" className={LABEL}>
              Join Date
            </label>
            {/* react-datepicker নয়, native <input type="date">।
                নকশার ডান পাশের calendar আইকনটা browser-এর নিজের
                picker আইকন — একই জিনিস, একটাও বাড়তি KB নয়, আর
                mobile-এ OS-এর নিজস্ব date picker আসে। */}
            <input
              id="staff-hire-date"
              type="date"
              value={hireDate}
              onChange={(event) => setHireDate(event.target.value)}
              className={FIELD}
            />
          </div>

          <SelectField
            id="staff-shift"
            label="Shift"
            value={shift}
            onChange={setShift}
            options={[
              { value: "", label: "— Not set —" },
              ...SHIFTS.map((s) => ({ value: s, label: SHIFT_LABELS[s] })),
            ]}
          />

          <SelectField
            id="staff-status"
            label="Status"
            value={isActive ? "active" : "inactive"}
            onChange={(value) => setIsActive(value === "active")}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>

        {/* Figma: Cancel বাঁয়ে (সাদা, কালো পাড়), Save Change ডানে
            (gradient), দুটোই উচ্চতা 56, radius 100, সমান প্রস্থ। */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-[52px] flex-1 rounded-full border border-black font-sora text-[16px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 sm:h-[56px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF9540] to-[#FF70C6] font-sora text-[16px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:h-[56px]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Figma-র dropdown ঘরগুলো (Role / Shift / Status)।
 *
 * FilterMenu ব্যবহার করা হয়নি, ইচ্ছাকৃতভাবে: ওটা একটা **ছাঁকনি** —
 * cream pill, hug প্রস্থ, ডান দিকে খোলা popup। এগুলো **form field** —
 * পুরো প্রস্থ, label সহ, আর form-এর ভেতরে থাকায় keyboard/validation-এ
 * native <select>-এর আচরণই দরকার (mobile-এ OS-এর নিজস্ব picker,
 * screen reader-এ সঠিক role)। একটা popup দিয়ে সেটা নকল করতে গেলে
 * অনেক কোড লাগত, আর সবটুকু ঠিকঠাক হতো না।
 *
 * `appearance-none` + নিজের ChevronDown, কারণ browser-এর ডিফল্ট তীরটা
 * প্রতিটা OS-এ আলাদা দেখায় আর নকশার ১৬px chevron-এর সাথে মেলে না।
 */
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} cursor-pointer appearance-none pr-11`}
        >
          {options.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60"
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
