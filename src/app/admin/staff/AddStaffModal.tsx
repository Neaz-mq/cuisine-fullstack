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
          // ⚠️ hireDate-এ সময় যোগ করা হয় না। <input type="date"> দেয়
          // "2026-07-24", আর `new Date("2026-07-24")` সেটাকে UTC মধ্যরাত
          // ধরে — ঢাকায় (UTC+6) সেটা ২৪ তারিখ সকাল ৬টা, অর্থাৎ তারিখটা
          // ঠিকই থাকে। উল্টোদিকের timezone-এ এটা আগের দিন দেখাত, কিন্তু
          // এই panel একটাই রেস্তোরাঁর আর server-ও UTC — তাই বাড়তি
          // জটিলতা যোগ না করে এটা এভাবেই রাখা।
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
          gap 40 (content ↔ বোতাম)। */}
      <div className="my-auto flex w-full max-w-[735px] flex-col gap-10 rounded-[30px] bg-white p-5 sm:p-[30px]">
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

/**
 * Figma-র dropdown ঘরগুলো (Role / Shift / Status) — "Fill" বাক্সটাই,
 * ভেতরে justify space-between আর ডানে ১৪px chevron (Black/70)।
 *
 * FilterMenu ব্যবহার করা হয়নি, ইচ্ছাকৃতভাবে: ওটা একটা **ছাঁকনি** —
 * cream pill, hug প্রস্থ, ডান দিকে খোলা popup। এগুলো **form field** —
 * পুরো প্রস্থ, label সহ, আর form-এর ভেতরে থাকায় native <select>-এর
 * আচরণই দরকার (mobile-এ OS-এর নিজস্ব picker, screen reader-এ সঠিক
 * role)। একটা popup দিয়ে সেটা নকল করতে গেলে অনেক কোড লাগত, আর সবটুকু
 * ঠিকঠাক হতো না।
 *
 * `appearance-none` + নিজের ChevronDown, কারণ browser-এর ডিফল্ট তীরটা
 * প্রতিটা OS-এ আলাদা দেখায় আর নকশার ১৪px chevron-এর সাথে মেলে না।
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
          className={`${FIELD} cursor-pointer appearance-none pr-9`}
        >
          {options.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/70"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
