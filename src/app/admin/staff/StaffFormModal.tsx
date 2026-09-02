"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import CountryCodeSelect, {
  COUNTRIES,
  DEFAULT_COUNTRY,
  type Country,
} from "@/components/CountryCodeSelect";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { SHIFTS, SHIFT_LABELS } from "@/lib/staff-shift";
import { ROLE_LABELS } from "@/lib/staff-roles";
import { STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import {
  DateField,
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  ModalShell,
  toISODate,
} from "@/components/admin/modal-ui";

/**
 * src/app/admin/staff/StaffFormModal.tsx
 *
 * Figma-র "Add New Staff" modal — এবং তার হুবহু যমজ "Edit Staff"।
 *
 * ── কেন একটাই component, দুটো নয় ────────────────────────────────────
 *
 * আগে সম্পাদনা হতো /admin/staff/[id] পাতায়, StaffForm দিয়ে — সাদা
 * বাক্স, চৌকো কোণ, native select, কমলা "Save changes" বোতাম। অর্থাৎ
 * একই কাজের দুটো সম্পূর্ণ আলাদা চেহারা: যোগ করা সুন্দর, সম্পাদনা
 * নয়। ঘরগুলোও প্রায় এক, শুধু একটায় POST আর অন্যটায় PATCH।
 *
 * দুটো আলাদা component রাখলে ঠিক আগের সমস্যাটাই ফিরে আসত — একটায়
 * নকশা বদলালে অন্যটা পিছিয়ে পড়ত। তাই একটাই component, `mode` prop
 * দিয়ে পার্থক্যটুকু:
 *
 *   create  ইমেইল সম্পাদনাযোগ্য, POST /api/admin/staff
 *   edit    ইমেইল পড়া-মাত্র, PATCH /api/admin/staff/[id]
 *
 * ── ঘরের তালিকা দুটোতেই হুবহু এক ───────────────────────────────────
 *
 * এক পর্যায়ে edit-এ কয়েকটা বাড়তি ঘর ছিল — department, employment
 * type, salary, password reset — এই যুক্তিতে যে পুরনো
 * /admin/staff/[id] পাতায় ওগুলো ছিল। কিন্তু নকশার সিদ্ধান্ত হলো দুটো
 * modal একই দেখাবে, তাই ওগুলো সরানো হয়েছে।
 *
 * ⚠️ যা এর ফলে হয়েছে, জেনে রাখা দরকার: `department`, `employmentType`
 * আর `salary` এখন UI-র কোথাও থেকে **সম্পাদনা করা যায় না**। মানগুলো
 * নিরাপদ — PATCH ক্ষেত্রগুলো না পেলে ছোঁয়ও না, তাই আগে বসানো মান
 * অক্ষত থাকে এবং View modal-এ দেখাও যায়। শুধু বদলানোর পথ নেই। পরে
 * দরকার হলে হয় এখানে ঘর ফিরিয়ে আনতে হবে, নয়তো /admin/staff/[id]
 * পাতাটা।
 *
 * ── password ─────────────────────────────────────────────────────────
 *
 * কোনো mode-এই password-এর ঘর নেই (নকশাতেও নেই)। নতুন কর্মীর ক্ষেত্রে
 * route একটা random password বসিয়ে তাঁকে "নিজের password ঠিক করুন"
 * link পাঠায় — বিস্তারিত POST /api/admin/staff-এ। পুরনো কর্মী password
 * ভুলে গেলে login পাতার "Forgot password" একই কাজ করে, আর সেটা
 * ভালোও: তখন নতুন password কেবল তিনিই জানেন, admin নন।
 */

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  /** edit mode-এ যাঁকে সম্পাদনা করা হচ্ছে। */
  staffId?: string;
  viewerRole?: string;
  /** সম্পাদিত ব্যক্তি নিজেই কি না — Status ঘরটা তখন নিষ্ক্রিয়। */
  isSelf?: boolean;
};

/**
 * সংরক্ষিত E.164 নম্বর ("+8801303660451") থেকে country + জাতীয় অংশ।
 *
 * ⚠️ সবচেয়ে **লম্বা** মিলটাই নেওয়া হয়, প্রথমটা নয়। dial code-গুলো
 * একে অন্যের উপসর্গ হতে পারে — "+1" (US) আর "+1876" (Jamaica)। প্রথম
 * মিল নিলে প্রতিটা জ্যামাইকান নম্বর US হিসেবে খুলত, আর জাতীয় অংশে
 * "876" রয়ে যেত।
 */
function splitPhone(e164: string | null): { country: Country; national: string } {
  if (!e164?.startsWith("+")) return { country: DEFAULT_COUNTRY, national: e164 ?? "" };

  let best: Country | null = null;
  for (const country of COUNTRIES) {
    if (e164.startsWith(country.dial) && (!best || country.dial.length > best.dial.length)) {
      best = country;
    }
  }
  if (!best) return { country: DEFAULT_COUNTRY, national: e164 };
  return { country: best, national: e164.slice(best.dial.length) };
}

/**
 * ⚠️ বন্ধ থাকলে কিছুই mount হয় না — আর এটা নিছক optimisation নয়।
 *
 * আগে component-টা সবসময় mount থাকত আর একটা `useEffect` খোলার সময়
 * সব ঘর reset করত (`setName("")`, `setError(null)`, …)। দুটো সমস্যা।
 *
 * এক, lint ঠিকই ধরেছে (`react-hooks/set-state-in-effect`): effect-এর
 * শরীরে সরাসরি setState মানে React একবার পুরনো state নিয়ে render করে,
 * তারপর আবার — একটা অপ্রয়োজনীয় cascading render।
 *
 * দুই, আর এটাই আসল: ওই reset তালিকাটা হাতে লেখা। নতুন একটা ঘর যোগ
 * করে reset-এ যোগ করতে ভুলে গেলে আগের কর্মীর মান পরের modal-এ রয়ে
 * যেত — একটা নীরব, খুঁজে বের করা কঠিন bug। mount/unmount-এ সেই
 * তালিকাটার দরকারই নেই: `useState`-এর প্রাথমিক মানই একমাত্র সত্য।
 */
export default function StaffFormModal(props: Props) {
  if (!props.open) return null;
  return <StaffFormModalContent {...props} />;
}

function StaffFormModalContent({
  open,
  onClose,
  mode,
  staffId,
  viewerRole,
  isSelf = false,
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nid, setNid] = useState("");
  const [role, setRole] = useState<StaffRole>("MANAGER");
  const [hireDate, setHireDate] = useState(() => toISODate(new Date()));
  const [shift, setShift] = useState<string>("EVENING");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  // edit mode-এ ডেটা আসা পর্যন্ত ঘরগুলো দেখানো হয় না, তাই শুরুতেই
  // `true` — নিচের effect-এ `setLoading(true)` ডাকতে হয় না।
  const [loading, setLoading] = useState(isEdit && Boolean(staffId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * edit mode-এ খোলার সময় পুরো record টেনে আনা।
   *
   * ⚠️ তালিকার সারিতে যা আছে (নাম, ইমেইল, ফোন, role, shift, status)
   * তা দিয়ে prefill করা হয় না — সেখানে ঠিকানা আর NID নেই। অর্ধেক
   * prefill করা form বিপজ্জনক: ফাঁকা ঘরদুটো "মান নেই" বলে মনে হতো,
   * আর save করলে সত্যিই মুছে যেত। তাই ডেটা আসা পর্যন্ত ঘরগুলো
   * দেখানোই হয় না।
   */
  useEffect(() => {
    if (!isEdit || !staffId) return;

    let cancelled = false;

    // ⚠️ effect-এর শরীরে সরাসরি কোনো setState নেই — সবগুলো এই async
    // function-এর ভেতরে, প্রথম `await`-এর পরে। তাই render চলাকালীন
    // কোনো cascading update হয় না, আর lint-ও সন্তুষ্ট।
    (async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load this staff member.");
        if (cancelled) return;

        const profile = data.staffProfile ?? {};
        const split = splitPhone(profile.phone ?? null);

        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setCountry(split.country);
        setPhone(split.national);
        setAddress(profile.address ?? "");
        setNid(profile.nid ?? "");
        setRole((data.role as StaffRole) ?? "MANAGER");
        setHireDate(profile.hireDate ? profile.hireDate.slice(0, 10) : toISODate(new Date()));
        setShift(profile.shift ?? "");
        setIsActive(profile.isActive ?? true);
        setImageUrl(data.image ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this staff member.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // ⚠️ অন্য একজনের Edit চাপলে আগের fetch পরে ফিরে এসে নতুন form-টা
    // পুরনো ডেটায় ভরে দিত। এই পতাকাটা সেটাই আটকায়।
    return () => {
      cancelled = true;
    };
  }, [isEdit, staffId]);

  /**
   * MANAGER-কে OWNER বানানো যায় না (canManageStaffRole), তাই তালিকাতেই
   * অপশনটা রাখা হয় না — API যেটা reject করবে, form-এর সেটা প্রস্তাব
   * করাই উচিত নয়।
   */
  const roleOptions = STAFF_ROLES.filter((r) => viewerRole === "OWNER" || r !== "OWNER");

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Staff name is required.");
      return;
    }
    if (!isEdit && !email.trim()) {
      setError("Email address is required.");
      return;
    }
    // ফোন ঐচ্ছিক, কিন্তু দিলে সেটা বৈধ হতে হবে — অর্ধেক নম্বর রাখার
    // চেয়ে ফাঁকা রাখা ভালো, কারণ পরে কেউ ওটায় ফোন করার চেষ্টা করবেন।
    let e164 = "";
    if (phone.trim()) {
      e164 = toE164(country.dial, phone);
      if (!isValidPhone(e164)) {
        setError(`That doesn't look like a valid ${country.name} phone number.`);
        return;
      }
    }

    // ⚠️ hireDate একটা তারিখ-মাত্র string ("2026-07-24"), সময় নয় —
    // DateField ইচ্ছাকৃতভাবে সেটাই দেয় (components/admin/modal-ui.tsx-এর তারিখ
    // অংশের মন্তব্য দ্রষ্টব্য)।
    const shared = {
      name: name.trim(),
      role,
      phone: e164,
      address: address.trim(),
      hireDate: hireDate || undefined,
      shift: shift || null,
      ...(imageUrl ? { image: imageUrl } : { image: null }),
      // ⚠️ NID এখন সব staff-এর জন্য, OWNER-only নয় — MANAGER-রাও
      // নিয়োগের কাগজপত্র তোলেন, তাই ঘরটা তাঁদেরও লাগে। নিয়মটা
      // API-তেও বদলানো (দেখুন lib/permissions.ts)। salary অবশ্য
      // এখনো OWNER-only, আর সেই ঘরটা এই modal-এ নেই।
      nid: nid.trim() || null,
    };

    const body = isEdit
      ? {
          ...shared,
          // ⚠️ department/employmentType/salary ইচ্ছাকৃতভাবে পাঠানো হয়
          // না — ঘরগুলো নেই, আর না পাঠালে PATCH ওগুলো ছোঁয় না।
          // `null` পাঠালে আগে বসানো মানগুলো নীরবে মুছে যেত।
          //
          // নিজেকে নিষ্ক্রিয় করা API-তেও আটকানো (নিজেকে তালাবন্ধ করে
          // ফেলা), তাই নিজের ক্ষেত্রে isActive পাঠানোই হয় না।
          ...(isSelf ? {} : { isActive }),
        }
      : {
          ...shared,
          email: email.trim().toLowerCase(),
          isActive,
          // create-এ `nid: null` পাঠানোর মানে নেই — createStaffSchema-য়
          // ওটা ঐচ্ছিক string, nullable নয়। তাই ফাঁকা হলে ক্ষেত্রটাই
          // বাদ (`shared`-এর `nid`-কে চাপা দিয়ে)।
          nid: nid.trim() || undefined,
        };

    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/staff/${staffId}` : "/api/admin/staff", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="staff-form-title"
      title={isEdit ? "Edit Staff" : "Add New Staff"}
      footer={
        /* Frame 2147236023: row, gap 8, উচ্চতা 46, দুটোই flex-grow 1। */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${OUTLINE_BUTTON} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading || loading}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {loading ? (
        // ডেটা আসার আগে ঘরগুলো দেখানো হয় না — উপরের effect-এর
        // মন্তব্য দ্রষ্টব্য।
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-black/40" aria-hidden="true" />
        </div>
      ) : (
        <>
          <ImageDropzone
            value={imageUrl}
            onChange={setImageUrl}
            onError={setError}
            uploading={uploading}
            setUploading={setUploading}
          />

          {/**
           * Frame 2147236092: column gap 20, প্রতিটা সারি row gap 16।
           *
           * ⚠️ grid এখন **সব পর্দাতেই** দুই কলামের, আগের মতো
           * `grid-cols-1 md:grid-cols-2` নয় — কারণ Figma-র ৩২০px
           * frame-এ ঘরগুলো এক কলামে নামে না, বরং নির্দিষ্ট দুটো
           * জোড়া পাশাপাশিই থাকে:
           *
           *   Staff Name        (পুরো প্রস্থ)
           *   Phone Number      (পুরো প্রস্থ)
           *   Email Address     (পুরো প্রস্থ)
           *   Permanent Address | NID Number     ← Frame 2147236482
           *   Role              | Join Date      ← Frame 2147236309
           *   Shift             (পুরো প্রস্থ)
           *   Status            (পুরো প্রস্থ)     ← Frame 2147236308
           *
           * তাই যে ঘরগুলো একা দাঁড়ায় তারা `col-span-2` নেয়, আর
           * md থেকে `md:col-span-1` দিয়ে আগের desktop বিন্যাসে
           * (Staff Name | Phone, Shift | Status) ফিরে যায় — অর্থাৎ
           * বড় পর্দায় কিছুই বদলায়নি।
           *
           * ⚠️ আগের মন্তব্যে লেখা ছিল "৬৪০-এর নিচে এক কলাম, কারণ
           * পাশাপাশি বসালে ~১২০px থাকে আর ফোনের ঘরটা আঁটে না" —
           * পর্যবেক্ষণটা ঠিক ছিল, সিদ্ধান্তটা বেশি চওড়া। ফোনের ঘরটা
           * সত্যিই ১২০px-এ আঁটে না, তাই ওটা (আর Staff Name, Email,
           * Shift, Status) পুরো প্রস্থই নেয়; কিন্তু Address/NID আর
           * Role/Join Date-এর ছোট মানগুলো ১২০px-এ দিব্যি ধরে।
           */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div className="col-span-2 md:col-span-1">
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

            {/* ⚠️ ৬৪০-এর নিচে পুরো প্রস্থ, ইচ্ছাকৃতভাবে: ভেতরে পতাকা +
                country code + বিভাজক + নম্বর — ১২০px-এর কলামে ওটা
                আঁটে না। Figma-তেও এই ঘরটা ৩২০px frame-এ পুরো
                প্রস্থ (Frame 2147236086, width 212 = ভরা)। */}
            <div className="col-span-2 md:col-span-1">
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
               * এখানেই পাড়টা নিভিয়ে নিজের রেখা বসানো হলো।
               *
               * overflow-hidden ইচ্ছাকৃতভাবে নেই — থাকলে country
               * dropdown-টা clip হয়ে যেত।
               */}
              <div className="flex h-[43px] items-stretch rounded-[12px] bg-[#F9F6F3] pl-3 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                <div className="flex shrink-0 items-stretch [&_button]:border-r-0 [&_button]:px-0 [&_button]:text-[12px]">
                  <CountryCodeSelect value={country} onChange={setCountry} />
                </div>
                <span className="my-auto ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
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

            {/* ⚠️ `col-span-2`, `md:col-span-2` নয় — grid এখন ৩২০px থেকেই
                দুই কলামের, তাই md-শর্ত রাখলে ছোট পর্দায় ইমেইলের ঘরটা
                অর্ধেক প্রস্থে সংকুচিত হয়ে NID-র পাশে গিয়ে বসত। */}
            <div className="col-span-2">
              <label htmlFor="staff-email" className={LABEL}>
                Email Address
                {isEdit && (
                  <span className="font-sora text-[11px] font-normal text-black/40">
                    {" "}
                    (can&apos;t be changed)
                  </span>
                )}
              </label>
              {/* ⚠️ edit-এ পড়া-মাত্র, আর সেটা ইচ্ছাকৃত: ইমেইলটাই login
                  পরিচয়, তাই বদলানোর মানে অ্যাকাউন্ট হস্তান্তর। PATCH
                  route-ও এটা গ্রহণ করে না — ঘরটা সম্পাদনাযোগ্য দেখালে
                  বদলে save করে "কিছুই হলো না" দেখতেন। */}
              <input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={isEdit}
                placeholder="Invite by name or email"
                className={`${FIELD} ${isEdit ? "cursor-not-allowed text-black/50" : ""}`}
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

            {/* ⚠️ এটা আগে `canSeeSensitive &&` দিয়ে ঢাকা ছিল — কেবল
                OWNER দেখতেন, আর label-এ "(owner only)" লেখা থাকত।
                দুটোই সরানো হয়েছে: Figma-র modal-এ ঘরটা শর্তহীন, আর
                বাস্তবেও নতুন কর্মীর NID তোলেন MANAGER-রাই। */}
            <div>
              <label htmlFor="staff-nid" className={LABEL}>
                NID Number
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

            <SelectField
              id="staff-role"
              label="Role"
              value={role}
              onChange={(next) => setRole(next as StaffRole)}
              options={roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />

            <DateField
              id="staff-hire-date"
              label="Join Date"
              value={hireDate}
              onChange={setHireDate}
            />

            <SelectField
              className="col-span-2 md:col-span-1"
              id="staff-shift"
              label="Shift"
              value={shift}
              onChange={setShift}
              options={[
                { value: "", label: "— Not set —" },
                ...SHIFTS.map((s) => ({ value: s, label: SHIFT_LABELS[s] })),
              ]}
            />

            {isSelf ? (
              /* নিজের status বদলানো API-তে আটকানো, তাই ঘরটা দেখানো
                 হয় কিন্তু নিষ্ক্রিয় — লুকিয়ে ফেললে grid-এর সারিটা
                 ভেঙে যেত আর "আমার status কোথায়" প্রশ্ন থাকত। */
              <div className="col-span-2 md:col-span-1">
                <span className={LABEL}>Status</span>
                <div
                  className={`${FIELD} flex cursor-not-allowed items-center text-black/50`}
                  aria-disabled="true"
                >
                  {isActive ? "Active" : "Inactive"} (that&apos;s you)
                </div>
              </div>
            ) : (
              <SelectField
                className="col-span-2 md:col-span-1"
                id="staff-status"
                label="Status"
                value={isActive ? "active" : "inactive"}
                onChange={(next) => setIsActive(next === "active")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            )}

          </div>
        </>
      )}
    </ModalShell>
  );
}
