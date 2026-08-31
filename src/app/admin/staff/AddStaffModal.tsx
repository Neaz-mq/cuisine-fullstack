"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
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
 * Figma "Add New Staff" (Frame 2147236222) — ছবি upload, নাম, ফোন
 * (country code সহ), ইমেইল, স্থায়ী ঠিকানা, NID, role, join date, shift,
 * status।
 *
 * ── নকশার কাঠামোটা ঠিক যেভাবে বসানো ──────────────────────────────────
 *
 *   কার্ড            padding 30, gap 40, radius 30, চওড়া 735
 *     └ content      column, gap 24
 *         ├ header   row space-between, উচ্চতা 32
 *         └ body     column, gap 20
 *             ├ dropzone   উচ্চতা 189, radius 20
 *             └ fields     column, gap 20 — পাঁচটা সারি, প্রতিটা gap 16
 *     └ buttons      row, gap 8, উচ্চতা 46
 *
 * ⚠️ বোতামজোড়া content-এর **ভেতরে নয়**, কার্ডের সরাসরি সন্তান — তাই
 * উপরের ফাঁকটা ৪০, ২০ বা ২৪ নয়। হিসাবটা মিলিয়ে দেখা যায়:
 * 30 + 700 + 40 + 46 + 30 = 846, অর্থাৎ Figma-র কার্ডের উচ্চতা।
 *
 * ── password ─────────────────────────────────────────────────────────
 *
 * নকশায় password-এর কোনো ঘর নেই, তাই modal থেকে কোনো password পাঠানোও
 * হয় না। route তখন একটা random password বসিয়ে কর্মীকে "নিজের password
 * ঠিক করুন" link পাঠায় — বিস্তারিত ব্যাখ্যা POST /api/admin/staff-এ।
 *
 * /admin/staff/new পাতাটা (StaffForm সহ) রয়ে গেছে: সেখানে department,
 * employment type, salary, password-এর ঘরগুলো আছে যেগুলো এই modal-এ
 * নেই। দুটোই একই API ব্যবহার করে, তাই নিয়ম এক জায়গাতেই থাকে।
 */

/**
 * Figma "Fill" — উচ্চতা 43, padding 12, radius 12, BG #F9F6F3, পাড় নেই,
 * লেখা Sora 400 12px LH 160%, placeholder Black/70।
 *
 * ⚠️ ৪৩px, ৫০ নয়, আর ১২px লেখা, ১৫ নয়। আগের মাপগুলো (h-50/text-15)
 * প্রজেক্টের **অন্য** ফর্মগুলোর, যেগুলো পুরো পাতা জুড়ে বসে। এটা একটা
 * ৭৩৫px modal-এ দশটা ঘর ধরে রাখে; ৫০px উচ্চতায় সেগুলো মিলে ~৭০px
 * বেড়ে যেত আর কার্ডটা ছোট পর্দায় scroll করা ছাড়া দেখাই যেত না।
 *
 * focus চিহ্নটা `ring-*` নয়, `outline` — Tailwind-এর ring একটা
 * দুই-স্তরের box-shadow যার প্রথম স্তর ডিফল্টে সাদা, আর cream ইনপুটের
 * কিনারায় সেই সাদা রেখাটা ফাঁক হয়ে ফুটে ওঠে। বিস্তারিত FilterMenu.tsx-এ।
 */
const FIELD =
  "h-[43px] w-full rounded-[12px] border-0 bg-[#F9F6F3] px-3 font-sora text-[12px] font-normal leading-[1.6] text-black placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

/** Figma label: Frank Ruhl Libre 500, 14px, LH 160%, #000000, নিচে gap 6। */
const LABEL = "mb-1.5 block font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black";

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

    // Client-side গার্ড — route-এও একই যাচাই আছে (সেটাই আসল গার্ড), কিন্তু
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
          // ⚠️ hireDate একটা তারিখ-মাত্র string ("2026-07-24"), সময় নয় —
          // DateField ইচ্ছাকৃতভাবে সেটাই দেয় (parseISODate/toISODate-এর
          // মন্তব্য দ্রষ্টব্য)। server-এ `new Date(...)` এটাকে UTC
          // মধ্যরাত ধরে; ঢাকায় (UTC+6) সেটা ওই দিনেরই সকাল ৬টা, তাই
          // তারিখটা ঠিক থাকে। এই panel একটাই রেস্তোরাঁর আর server-ও
          // UTC, তাই বাড়তি জটিলতা যোগ না করে এটা এভাবেই রাখা।
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
      {/* Figma Frame 2147236222: চওড়া 735, radius 30, padding 30,
          gap 40 (content ↔ বোতাম)।

          `data-add-staff-card` — SelectField-এর popup এই কার্ডের সীমা
          মেপে নিজের উচ্চতা আর দিক ঠিক করে, যাতে কখনো কার্ড ছাড়িয়ে
          না যায়। বিস্তারিত SelectField-এ। */}
      <div
        data-add-staff-card
        className="my-auto flex w-full max-w-[735px] flex-col gap-10 rounded-[30px] bg-white p-5 sm:p-[30px]"
      >
        {/* Frame 2147236301: column, gap 24। */}
        <div className="flex flex-col gap-6">
          {/* Frame 2147236476: row, space-between, align center, উচ্চতা 32। */}
          <div className="flex items-center justify-between gap-4">
            {/* Figma: Frank Ruhl Libre 600, 28px, LH 114%, letter-spacing −0.01em。 */}
            <h2
              id="add-staff-title"
              className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black sm:text-[28px]"
            >
              Add New Staff
            </h2>
            {/* Frame 2147236477: 40×40, BG #F9F6F3, radius 100,
                icon 24×24 stroke 1.5 (Figma-তে এটা "add" আইকন ৪৫° ঘোরানো —
                অর্থাৎ হুবহু একটা ✕, তাই lucide-এর X-ই ব্যবহার করা হলো)। */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
            >
              <X className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          {/* Frame 2147236300: column, gap 20। */}
          <div className="flex flex-col gap-5">
            {error && (
              <p
                role="alert"
                className="rounded-[12px] bg-red-50 px-3 py-2.5 font-sora text-[12px] leading-[1.6] text-red-600"
              >
                {error}
              </p>
            )}

            {/* ── ছবির drop-zone ────────────────────────────────────────
                Figma Frame 2147232424: উচ্চতা 189, radius 20, BG #F9F6F3,
                ভেতরটা উল্লম্ব ও অনুভূমিক দুই দিকেই কেন্দ্রে।

                ⚠️ ১৮৯ = padding 18 + content 115 + padding 18 = 151 নয় —
                বাকি ৩৮px ইচ্ছাকৃত ফাঁকা জায়গা, তাই `min-h` + center,
                সরাসরি padding নয়। এভাবে preview অবস্থায় (ছবি বসার পর)
                বাক্সটার উচ্চতা একই থাকে আর modal লাফায় না। */}
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
              className={`flex min-h-[189px] items-center justify-center rounded-[20px] px-[18px] py-[18px] transition-colors ${
                dragging ? "bg-[#FF9540]/10" : "bg-[#F9F6F3]"
              }`}
            >
              {imageUrl ? (
                /* Frame 2147232453-এর একই গড়ন (column, gap 20, center) —
                   শুধু camera বৃত্তের জায়গায় সত্যিকারের ছবিটা। */
                <div className="flex flex-col items-center gap-5">
                  {/* next/image নয় — UserAvatar-এর একই কারণ: Supabase
                      host-টা env-নির্ভর, আর একটা ৮০px preview-তে
                      optimization-এর লাভ সামান্য। */}
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
                      className="font-sora text-[12px] font-normal text-black underline underline-offset-2"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="font-sora text-[12px] font-normal text-[#D72A37] underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                /* Frame 2147232453: column, gap 20, চওড়া 373। */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full max-w-[373px] cursor-pointer flex-col items-center gap-5 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:4px]"
                >
                  {/* Frame 2147232454: 50×50, BG #FFFFFF, radius 100,
                      camera icon 24×24 stroke 1.5। */}
                  <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-black/60" aria-hidden="true" />
                    ) : (
                      <Camera className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </span>

                  {/* Frame 2147232452: column, gap 12, center। */}
                  <span className="flex w-full flex-col items-center gap-3 text-center">
                    {/* Figma: Frank Ruhl Libre 500, 16px, LH 120%, #000000。 */}
                    <span className="font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
                      {uploading ? "Uploading…" : "Drop images here or click to upload"}
                    </span>
                    {/* Figma: Sora 400, 12px, LH 120%, Black/70。 */}
                    <span className="font-sora text-[12px] font-normal leading-[1.2] text-black/70">
                      PNG, JPG, WEBP up to 2MB each Recommended 1200×800px
                    </span>
                  </span>
                </button>
              )}
            </div>

            {/* ── ঘরগুলো ───────────────────────────────────────────────
                Frame 2147236092: column gap 20, প্রতিটা সারি row gap 16।
                ৬৪০-এর নিচে এক কলাম — দুটো ঘর পাশাপাশি বসালে প্রতিটার
                ভেতরে ~১২০px থাকত, আর country code pill-সহ ফোনের ঘরটা
                ওতে আঁটে না। */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
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
                {/**
                 * Figma Frame 2147236090: country block + একটা 1px × 28px
                 * #D9D9D9 বিভাজক + নম্বরের ঘর, সব এক "Fill" বাক্সে।
                 *
                 * ⚠️ CountryCodeSelect-এর নিজের পাড়টা (`border-r
                 * border-black/10`) পুরো উচ্চতা জুড়ে যায়, কিন্তু নকশার
                 * রেখাটা ২৮px, অর্থাৎ ভেতরের দিকে বসানো। component-টা
                 * register পাতাও ব্যবহার করে, তাই ওখানে হাত না দিয়ে
                 * এখানেই পাড়টা নিভিয়ে (`[&_button]:border-r-0`) নিজের
                 * রেখা বসানো হলো। লেখার মাপও ১২-তে নামানো, কারণ
                 * component-এর ডিফল্ট ১৪/১৫ এই ছোট ঘরে বেমানান।
                 *
                 * overflow-hidden ইচ্ছাকৃতভাবে নেই — থাকলে country
                 * dropdown-টা clip হয়ে যেত।
                 */}
                <div className="flex h-[43px] items-stretch rounded-[12px] bg-[#F9F6F3] pl-3 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                  <div className="flex shrink-0 items-stretch [&_button]:border-r-0 [&_button]:px-0 [&_button]:text-[12px]">
                    <CountryCodeSelect value={country} onChange={setCountry} />
                  </div>
                  <span
                    className="my-auto ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]"
                    aria-hidden="true"
                  />
                  <input
                    id="staff-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={examplePhone(country.code) || "Phone number"}
                    className="min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[12px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none"
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

              {/* NID — OWNER-only, handleSubmit-এর মন্তব্য দ্রষ্টব্য।
                  MANAGER-এর কাছে ঘরটা নেই, তাই ঠিকানার ঘরটা একা এক
                  কলামে বসে; grid সেটা স্বাভাবিকভাবেই সামলায়। */}
              {canSeeSensitive && (
                <div>
                  <label htmlFor="staff-nid" className={LABEL}>
                    NID Number{" "}
                    <span className="font-sora text-[11px] font-normal text-black/40">
                      (owner only)
                    </span>
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

              <DateField
                id="staff-hire-date"
                label="Join Date"
                value={hireDate}
                onChange={setHireDate}
              />

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
          </div>
        </div>

        {/**
         * Frame 2147236023: row, gap 8, উচ্চতা 46, দুটোই flex-grow 1।
         * Cancel — পাড় 1px #000000, radius 90, লেখা Sora 600 16px।
         * Save Change — gradient, radius 100, সাদা লেখা।
         *
         * ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না। ওই utility মানে
         * ঠিক 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
         * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে** —
         * তাই ভেতরে শুধু কমলা থেকে একটা নরম মাঝামাঝি রঙ দেখা যায়।
         * সারির "View" বোতামেও হুবহু এই একই gradient।
         */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-[46px] flex-1 rounded-[90px] border border-black px-5 font-sora text-[16px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── popup-এর সাধারণ অংশ ──────────────────────────────────────────────
 *
 * Role/Shift/Status-এর তালিকা আর Join Date-এর ক্যালেন্ডার — দুটোই একই
 * জিনিস: নকশার "Fill" ঘরটার নিচে ভেসে ওঠা একটা সাদা কার্ড। তাই খোলা/
 * বন্ধ, বাইরে click, Escape, আর "কার্ড ছাড়িয়ে যাবে না" — এই যুক্তিটুকু
 * একবারই লেখা (useMenuPlacement), দুই জায়গায় নয়।
 */

/** trigger আর popup-এর মাঝের ফাঁক (`mt-2` / `mb-2`)। */
const MENU_GAP = 8;
/**
 * তালিকা-popup-এর সর্বোচ্চ উচ্চতা: padding 16×2 + তিনটে item (34) +
 * দুটো gap (6) = ১৪৬। অর্থাৎ তিনটে পুরো দেখা যায়, চতুর্থটা থেকে scroll।
 *
 * ⚠️ তিনটে, পাঁচ-ছয়টা নয় — Role-এ ছ'টা অপশন, আর ছ'টা দেখাতে গেলে
 * popup-টা ২৭০px লম্বা হতো, যা modal-এর ভেতরে কোথাও আঁটে না। "কম
 * দেখাও, scroll করতে দাও" এখানে "বেশি দেখাও, কার্ড ছাড়িয়ে যাও"-এর
 * চেয়ে ভালো।
 */
const MENU_MAX_HEIGHT = 146;
/**
 * ক্যালেন্ডারের আনুমানিক উচ্চতা: padding 32 + header 32 + সপ্তাহের
 * নাম 16 + ছ'টা সারি × 32 + ফাঁকগুলো ≈ ২৯০।
 *
 * ⚠️ এটা কেবল **জায়গা আছে কি নেই** বিচারের জন্য — ক্যালেন্ডারে
 * `maxHeight` বসানো হয় না। একটা scroll করা ক্যালেন্ডার ব্যবহারের
 * অযোগ্য (মাসের অর্ধেক লুকিয়ে থাকে), তাই জায়গা কম হলে সেটা ছোট না
 * হয়ে উল্টো দিকে খোলে।
 */
const CALENDAR_HEIGHT = 290;
/** কার্ডের কিনারা থেকে ন্যূনতম শ্বাস-ফাঁক। */
const MENU_EDGE_PADDING = 8;

/**
 * popup উপরে না নিচে খুলবে, আর সর্বোচ্চ কত লম্বা হবে।
 *
 * ── কেন এটা দরকার ──────────────────────────────────────────────────
 *
 * Shift, Status আর Join Date ঘরগুলো form-এর শেষ দিকে। Shift/Status-এর
 * নিচে কার্ডের ভেতরে বাকি থাকে মাত্র ~১১৬px (gap 40 + বোতাম 46 +
 * padding 30)। ১৪৬px popup সেখানে আঁটে না — তাই সেটা কার্ড ছাড়িয়ে
 * বাইরে ঝুলে পড়ত। ক্যালেন্ডার আরও বড়, সমস্যাও আরও বড়।
 *
 * তাই খোলার ঠিক আগে কার্ডের সীমা মেপে নেওয়া হয়: নিচে জায়গা না থাকলে
 * popup **উপরে** খোলে, আর যেদিকেই খুলুক তার উচ্চতা ওই দিকের ফাঁকা
 * জায়গাটুকুতে সীমিত থাকে।
 *
 * ⚠️ মাপটা open হওয়ার **আগে** নেওয়া হয় (useLayoutEffect নয়) — নাহলে
 * popup আগে নিচে এঁকে তারপর উপরে লাফাত, আর সেই এক-ফ্রেমের ঝাঁকুনিটা
 * চোখে পড়ত।
 */
function useMenuPlacement(preferredHeight: number) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ up: false, maxHeight: preferredHeight });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const measure = () => {
    const wrapper = wrapperRef.current;
    const card = wrapper?.closest("[data-add-staff-card]");
    if (!wrapper || !card) return { up: false, maxHeight: preferredHeight };

    const trigger = wrapper.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();

    const below = bounds.bottom - trigger.bottom - MENU_GAP - MENU_EDGE_PADDING;
    const above = trigger.top - bounds.top - MENU_GAP - MENU_EDGE_PADDING;

    // নিচে পুরোটা আঁটলে নিচেই — উপরে খোলা ব্যবহারকারীর কাছে কম
    // প্রত্যাশিত, তাই সেটা কেবল দরকার হলেই।
    const up = below < preferredHeight && above > below;
    return {
      up,
      maxHeight: Math.max(0, Math.min(preferredHeight, up ? above : below)),
    };
  };

  const toggle = () => {
    // খোলার আগেই মাপা — উপরের মন্তব্য দ্রষ্টব্য।
    if (!open) setPlacement(measure());
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    /**
     * ⚠️ Escape-টা capture phase-এ ধরা হয়, আর তারপর propagation থামিয়ে
     * দেওয়া হয়। কারণ modal নিজেও document-এ Escape শোনে (বন্ধ হওয়ার
     * জন্য)। দুটোই bubble phase-এ থাকলে একবার Escape চাপলেই popup আর
     * modal দুটোই বন্ধ হয়ে যেত — অর্থাৎ ভুল করে dropdown খুলে ফেললে
     * পুরো ভরাট করা form-টা হারাতেন।
     *
     * document-এর capture-phase listener bubble-phase listener-এর আগে
     * চলে, আর সেখানে `stopPropagation()` ডাকলে event-টা আর bubble
     * phase-এ পৌঁছয়ই না। তাই popup খোলা থাকলে Escape কেবল popup-টাই
     * বন্ধ করে; বন্ধ থাকলে (এই effect চলেই না) Escape আগের মতোই modal
     * বন্ধ করে।
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };

    // modal-টা লম্বা হলে overlay scroll করে, আর তখন ঘরটা কার্ডের
    // ভেতরে সরে যায় — খোলা অবস্থায় হিসাবটা বাসি হয়ে যেত। scroll
    // capture phase-এ ধরা হয় কারণ ঘটনাটা overlay-তে ঘটে, document-এ
    // bubble করে না।
    const reposition = () => setPlacement(measure());

    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { open, setOpen, toggle, placement, wrapperRef };
}

/**
 * popup কার্ডের চেহারা — FilterMenu.tsx-এর হুবহু: column, padding 16,
 * radius 16, BG #FFFFFF, ছায়া 0 4px 30px rgba(0,0,0,0.06)।
 *
 * ⚠️ চওড়া এখানে ২২৪px স্থির নয়, `left-0 right-0` — ঘরটার সমান।
 * ছাঁকনির popup ভাসে একটা ছোট pill-এর নিচে, তাই তার নিজের মাপ দরকার;
 * এটা ভাসে একটা পুরো-প্রস্থের form ঘরের নিচে, আর তার চেয়ে সরু হলে
 * সারিবদ্ধতা ভেঙে যেত।
 */
const MENU_SHELL =
  "absolute left-0 right-0 z-30 rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]";

/**
 * Figma-র dropdown ঘরগুলো (Role / Shift / Status)।
 *
 * ── কেন native <select> বাদ দেওয়া হলো ────────────────────────────────
 *
 * আগে এটা একটা `appearance-none` করা native `<select>` ছিল, এই যুক্তিতে
 * যে form-এর ভেতরে native আচরণই ভালো (mobile-এ OS-এর picker, screen
 * reader-এ সঠিক role)। যুক্তিটা ভুল ছিল না, কিন্তু একটা জিনিস
 * `appearance-none` দিয়ে বদলানো **যায় না**: খোলা তালিকাটা। ওটা
 * browser আঁকে, CSS পৌঁছয় না — তাই Windows/Chrome-এ চকচকে নীল
 * highlight, চৌকো কোণ, সাদা পটভূমি। modal-টা যত যত্ন করেই বানানো হোক,
 * dropdown খুললেই সেটা অন্য দশকের একটা widget হয়ে যেত।
 *
 * ⚠️ FilterMenu-টা সরাসরি ব্যবহার করা যায়নি, আর সেটা ইচ্ছাকৃত: ওটার
 * trigger একটা **ছাঁকনি pill** — hug প্রস্থ, উচ্চতা 40, radius 100।
 * এখানে trigger হলো নকশার "Fill" ঘর — পুরো প্রস্থ, উচ্চতা 43,
 * radius 12, উপরে label। অর্থাৎ শুধু popup-টাই এক, trigger নয়।
 * FilterMenu-তে দুই রকম trigger-এর prop যোগ করলে ওই component-টা
 * ছাঁকনির জন্য পড়া কঠিন হয়ে যেত, তাই popup-এর class-গুলো এখানে
 * নকল করা হলো। দুটো জায়গায় থাকল — বদলালে দুটোতেই বদলাতে হবে।
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
  const { open, setOpen, toggle, placement, wrapperRef } = useMenuPlacement(MENU_MAX_HEIGHT);

  // অজানা মান এলে প্রথমটায় পড়ে থাকে, যাতে ঘরটা খালি না দেখায় —
  // FilterMenu-র একই আচরণ।
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div>
      {/* label-টা <label> নয়, <span> — কারণ trigger একটা <button>, আর
          <label htmlFor> দিয়ে button-এ click পাঠানো ব্রাউজারভেদে
          অসামঞ্জস্যপূর্ণ। সম্পর্কটা বরং aria-labelledby দিয়ে বাঁধা,
          যেটা screen reader-এ নির্ভরযোগ্য। */}
      <span id={`${id}-label`} className={LABEL}>
        {label}
      </span>

      <div className="relative" ref={wrapperRef}>
        {/* Figma "Fill" ঘরটাই — row, justify space-between, padding 12,
            ডানে ১৪px chevron (Black/70)। */}
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
          className={`${FIELD} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className="min-w-0 truncate">{selected.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-black/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>

        {open && (
          /* উচ্চতা আর দিক দুটোই run-time-এ মাপা — তাই `max-h-*` class
             নেই, inline style আছে। class দিয়ে করা যেত না, কারণ মানটা
             প্রতিবার আলাদা: একই component Role-এর জন্য নিচে ১৪৬px
             খোলে আর Status-এর জন্য উপরে ১২০px। */
          <ul
            role="listbox"
            aria-labelledby={`${id}-label`}
            style={{ maxHeight: placement.maxHeight }}
            className={`${MENU_SHELL} flex flex-col gap-1.5 overflow-y-auto overscroll-contain ${
              placement.up ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {options.map((option) => {
              const isSelected = option.value === selected.value;
              return (
                <li key={option.value || "none"} className="w-full">
                  {/* Figma item: উচ্চতা 34, padding 10, Sora 400 14px
                      #121212। বাছাই করাটা radius 100 + cream pill,
                      বাকিরা radius 12 (কেবল hover-এ চোখে পড়ে)। */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setOpen(false);
                      onChange(option.value);
                    }}
                    className={`flex h-[34px] w-full items-center p-2.5 text-left font-sora text-[14px] font-normal leading-none text-[#121212] transition-colors ${
                      isSelected
                        ? "rounded-full bg-[#F9F6F3]"
                        : "rounded-[12px] hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── তারিখের সহায়ক ────────────────────────────────────────────────────
 *
 * ⚠️ সব হিসাব **স্থানীয়** সময়ে, UTC-তে নয়।
 *
 * `new Date("2026-08-31")` কে JS তারিখ-মাত্র ISO string ধরে **UTC**
 * মধ্যরাত বানায়। ঢাকায় (UTC+6) সেটা ৩১ তারিখ ভোর ৬টা — ঠিক আছে।
 * কিন্তু UTC−5-এ সেটা ৩০ তারিখ সন্ধ্যা ৭টা, অর্থাৎ ক্যালেন্ডারে ৩০
 * highlight হতো যদিও ঘরে লেখা ৩১। তাই string-টা হাতে ভেঙে
 * `new Date(y, m, d)` — যেটা সবসময় স্থানীয় মধ্যরাত।
 *
 * একই কারণে ফেরত দেওয়ার সময় `toISOString()` ব্যবহার করা হয় না; সেটা
 * আবার UTC-তে ফিরিয়ে একই ভুল করত।
 */
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Figma-র placeholder "07/24/2026" — অর্থাৎ MM/DD/YYYY। */
function formatDisplayDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Join Date — নকশার "Fill" ঘর + প্রজেক্টের নিজের ক্যালেন্ডার popup।
 *
 * ── কেন native <input type="date"> বাদ ───────────────────────────────
 *
 * `<select>`-এর হুবহু একই সমস্যা, আর এখানে সেটা আরও চোখে লাগে:
 * ক্যালেন্ডারটা browser আঁকে, CSS পৌঁছয় না। ফলে চৌকো সাদা বাক্স,
 * চকচকে নীল "31", নীল "Clear / Today" লিঙ্ক — cream-আর-গোলাপি
 * modal-টার ঠিক মাঝখানে অন্য একটা অ্যাপের টুকরো।
 *
 * ── কেন react-datepicker নয় (যদিও ইতিমধ্যেই dependency-তে আছে) ───────
 *
 * ওটা Reserve.tsx-এ ব্যবহার হয় নিজের ডিফল্ট CSS সহ
 * (`react-datepicker/dist/react-datepicker.css`) — একটা **global**
 * stylesheet, যার নিজস্ব চেহারা এই নকশার সাথে মেলে না। এখানে আনলে
 * প্রথমে ওই global CSS টানতে হতো, তারপর প্রায় প্রতিটা অংশ override
 * করে নকশায় ফেরাতে হতো, আর ঝুঁকিটা একমুখী নয়: ওই CSS তখন admin
 * bundle-এও ঢুকত এবং Reserve পাতার সাথে জড়িয়ে যেত। নিচের
 * ক্যালেন্ডারটা ~৬০ লাইন, কোনো নতুন CSS নেই, আর popup-এর খোলস
 * (MENU_SHELL) তালিকা-dropdown-এর সাথে ভাগ করা — তাই দুটো হুবহু এক
 * দেখায়।
 *
 * ── যা এখানে ইচ্ছাকৃতভাবে নেই ────────────────────────────────────────
 *
 * বছর/মাসের dropdown, সময় বাছাই, তারিখ-পরিসর — কিছুই নেই। এটা "কর্মী
 * কবে যোগ দিলেন" ঘর; মানটা প্রায় সবসময় আজ বা কাছাকাছি কোনো দিন, তাই
 * মাস-নেভিগেশন আর "Today" যথেষ্ট। দূরের কোনো তারিখ লাগলে সেটা
 * /admin/staff/[id] পাতা থেকে সম্পাদনা করা যায়।
 */
function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, toggle, placement, wrapperRef } = useMenuPlacement(CALENDAR_HEIGHT);

  const selected = parseISODate(value);
  const today = new Date();

  // ক্যালেন্ডার কোন মাস দেখাচ্ছে। বাছাই করা তারিখ থেকে শুরু, নাহলে
  // চলতি মাস।
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // প্রতিবার খোলার সময় বাছাই করা মাসে ফিরে আসা — নাহলে কেউ একবার
  // ২০২৪-এ গিয়ে বন্ধ করলে পরেরবার খুলেও সেখানেই পড়ে থাকত।
  useEffect(() => {
    if (!open) return;
    const base = parseISODate(value) ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, value]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  // `new Date(y, m + 1, 0)` = পরের মাসের "শূন্যতম" দিন = এই মাসের শেষ দিন।
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // মাসের ১ তারিখ সপ্তাহের কোন ঘরে পড়ে — তার আগের ঘরগুলো ফাঁকা।
  const leadingBlanks = new Date(year, month, 1).getDay();

  const shiftMonth = (delta: number) => setViewMonth(new Date(year, month + delta, 1));

  const pick = (day: number) => {
    onChange(toISODate(new Date(year, month, day)));
    setOpen(false);
  };

  return (
    <div>
      <span id={`${id}-label`} className={LABEL}>
        {label}
      </span>

      <div className="relative" ref={wrapperRef}>
        {/* Figma "Fill" ঘর — ডানে ১৪px calendar আইকন। */}
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-labelledby={`${id}-label`}
          className={`${FIELD} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className={`min-w-0 truncate ${selected ? "" : "text-black/70"}`}>
            {selected ? formatDisplayDate(selected) : "MM/DD/YYYY"}
          </span>
          <CalendarIcon
            className="h-3.5 w-3.5 shrink-0 text-black/70"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>

        {open && (
          /* ⚠️ এখানে `maxHeight` বসানো হয় না — একটা scroll করা
             ক্যালেন্ডার ব্যবহারের অযোগ্য। জায়গা কম হলে placement
             নিজেই এটাকে উল্টো দিকে খোলে (CALENDAR_HEIGHT-এর মন্তব্য
             দ্রষ্টব্য)। */
          <div
            role="dialog"
            aria-label={`${label} calendar`}
            className={`${MENU_SHELL} ${placement.up ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            {/* মাসের শিরোনাম + নেভিগেশন */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-frank-ruhl text-[15px] font-medium leading-none text-black">
                {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
              <div className="flex items-center gap-1">
                {/* cream বৃত্ত — FilterMenu-র বাছাই করা item আর সারির
                    Status pill, দুটোরই একই #F9F6F3। */}
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08]"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* সপ্তাহের নাম */}
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAY_LABELS.map((weekday) => (
                <span
                  key={weekday}
                  className="flex h-6 items-center justify-center font-sora text-[11px] font-normal leading-none text-black/40"
                >
                  {weekday}
                </span>
              ))}
            </div>

            {/* দিনগুলো।

                ⚠️ আগের/পরের মাসের দিন দেখানো হয় না — native picker-টা
                ধূসর করে দেখাত, কিন্তু সেগুলো click করা যায় বলে ভুল
                মাসে তারিখ বসে যাওয়ার একটা সহজ পথ তৈরি হয়। ফাঁকা ঘরই
                নিরাপদ, আর দেখতেও পরিষ্কার। */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <span key={`blank-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const isSelected = selected ? isSameDay(date, selected) : false;
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    aria-label={formatDisplayDate(date)}
                    aria-current={isSelected ? "date" : undefined}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-sora text-[13px] font-normal leading-none transition-colors ${
                      isSelected
                        ? // পাতার pagination-এর active পাতাটার মতোই কালো
                          // + সাদা লেখা। FilterMenu-র cream pill এখানে
                          // যথেষ্ট নয়: ৩০টা ঘরের ভেতরে cream আর "আজ"-এর
                          // চিহ্ন আলাদা করা যেত না।
                          "bg-black text-white"
                        : isToday
                          ? "bg-[#F9F6F3] text-black"
                          : "text-[#121212] hover:bg-black/[0.04]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onChange(toISODate(new Date()));
                setOpen(false);
              }}
              className="mt-3 w-full rounded-[12px] py-2 text-center font-sora text-[13px] font-normal leading-none text-black/70 transition-colors hover:bg-black/[0.04]"
            >
              Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}