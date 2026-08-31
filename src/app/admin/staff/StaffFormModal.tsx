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
  StaffModalShell,
  toISODate,
} from "./staff-modal-ui";

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
 *   create  ইমেইল সম্পাদনাযোগ্য, password নেই (নিচের ব্যাখ্যা দ্রষ্টব্য)
 *   edit    ইমেইল পড়া-মাত্র, বাড়তি ঘর: department, employment type,
 *           salary (owner), আর ঐচ্ছিক password reset
 *
 * ── password ─────────────────────────────────────────────────────────
 *
 * create-এ password-এর ঘর নেই (নকশাতেও নেই)। route তখন একটা random
 * password বসিয়ে কর্মীকে "নিজের password ঠিক করুন" link পাঠায় —
 * বিস্তারিত ব্যাখ্যা POST /api/admin/staff-এ। edit-এ ঘরটা আছে, কারণ
 * কর্মী password ভুলে গেলে admin-কে একটা পথ দিতেই হয়।
 */

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  /** edit mode-এ যাঁকে সম্পাদনা করা হচ্ছে। */
  staffId?: string;
  viewerRole?: string;
  /** OWNER কি না — NID/Salary ঘর দুটো কেবল তখনই। */
  canSeeSensitive: boolean;
  /** সম্পাদিত ব্যক্তি নিজেই কি না — Status ঘরটা তখন নিষ্ক্রিয়। */
  isSelf?: boolean;
};

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
] as const;

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

export default function StaffFormModal({
  open,
  onClose,
  mode,
  staffId,
  viewerRole,
  canSeeSensitive,
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
  const [salary, setSalary] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState<string>("FULL_TIME");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("MANAGER");
  const [hireDate, setHireDate] = useState(() => toISODate(new Date()));
  const [shift, setShift] = useState<string>("EVENING");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * edit mode-এ খোলার সময় পুরো record টেনে আনা।
   *
   * ⚠️ তালিকার সারিতে যা আছে (নাম, ইমেইল, ফোন, role, shift, status)
   * তা দিয়ে prefill করা হয় না — সেখানে address, nid, salary,
   * department, employment type নেই। অর্ধেক prefill করা form বিপজ্জনক:
   * ফাঁকা ঘরগুলো "মান নেই" বলে মনে হতো, আর save করলে সত্যিই মুছে
   * যেত। তাই ডেটা আসা পর্যন্ত ঘরগুলো দেখানোই হয় না।
   */
  useEffect(() => {
    if (!open) return;

    // প্রতিবার খোলার সময় পরিষ্কার শুরু — নাহলে আগেরবারের ভুল-বার্তা
    // বা অন্য কারও ডেটা রয়ে যেত।
    setError(null);
    setSubmitting(false);

    if (!isEdit || !staffId) {
      setName("");
      setEmail("");
      setCountry(DEFAULT_COUNTRY);
      setPhone("");
      setAddress("");
      setNid("");
      setSalary("");
      setDepartment("");
      setEmploymentType("FULL_TIME");
      setPassword("");
      setRole("MANAGER");
      setHireDate(toISODate(new Date()));
      setShift("EVENING");
      setIsActive(true);
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
        setSalary(profile.salary != null ? String(profile.salary) : "");
        setDepartment(profile.department ?? "");
        setEmploymentType(profile.employmentType ?? "FULL_TIME");
        setPassword("");
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

    // ⚠️ modal দ্রুত খুলে-বন্ধ করলে (বা অন্য একজনের Edit চাপলে) আগের
    // fetch পরে ফিরে এসে নতুন form-টা পুরনো ডেটায় ভরে দিত। এই পতাকাটা
    // সেটাই আটকায়।
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, staffId]);

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
    if (isEdit && password && password.length < 8) {
      setError("Password must be at least 8 characters.");
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
    // DateField ইচ্ছাকৃতভাবে সেটাই দেয় (staff-modal-ui.tsx-এর তারিখ
    // অংশের মন্তব্য দ্রষ্টব্য)।
    const shared = {
      name: name.trim(),
      role,
      phone: e164,
      address: address.trim(),
      hireDate: hireDate || undefined,
      shift: shift || null,
      ...(imageUrl ? { image: imageUrl } : { image: null }),
      // NID/Salary শুধু OWNER পাঠায়। MANAGER পাঠালে route এমনিতেই
      // চুপচাপ অগ্রাহ্য করত, কিন্তু তখন ঘরটা দেখা যেত অথচ কাজ করত
      // না — সেটা "ভাঙা" মনে হয়। তাই ঘরগুলোই দেখানো হয় না।
      ...(canSeeSensitive ? { nid: nid.trim() || null } : {}),
    };

    const body = isEdit
      ? {
          ...shared,
          department: department.trim() || null,
          employmentType,
          // নিজেকে নিষ্ক্রিয় করা API-তেও আটকানো (নিজেকে তালাবন্ধ করে
          // ফেলা), তাই নিজের ক্ষেত্রে ক্ষেত্রটা পাঠানোই হয় না।
          ...(isSelf ? {} : { isActive }),
          ...(canSeeSensitive ? { salary: salary.trim() ? Number(salary) : null } : {}),
          ...(password ? { password } : {}),
        }
      : {
          ...shared,
          email: email.trim().toLowerCase(),
          isActive,
          // create-এ `nid: null` পাঠানোর মানে নেই — schema-য় ওটা
          // ঐচ্ছিক string, nullable নয়।
          ...(canSeeSensitive && nid.trim() ? { nid: nid.trim() } : { nid: undefined }),
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
    <StaffModalShell
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

          {/* Frame 2147236092: column gap 20, প্রতিটা সারি row gap 16।
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

            <div className="md:col-span-2">
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
              <div>
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

            {/* ── কেবল edit-এ ──────────────────────────────────────────
                এই ঘরগুলো Figma-র modal-এ নেই, কিন্তু StaffProfile-এ
                আছে আর আগে /admin/staff/[id] পাতা থেকে সম্পাদনা করা
                যেত। সেই পাতাটা এখন তালিকা থেকে আর খোলে না, তাই
                ঘরগুলো এখানে না রাখলে মানগুলো কার্যত অসম্পাদনযোগ্য
                হয়ে যেত। যোগ করার সময় এগুলো দরকার হয় না (department
                আর employment type-এর যুক্তিসঙ্গত default আছে), তাই
                create-এ দেখানো হয় না — নকশাটাও তখন হুবহু Figma। */}
            {isEdit && (
              <>
                <div>
                  <label htmlFor="staff-department" className={LABEL}>
                    Department
                  </label>
                  <input
                    id="staff-department"
                    type="text"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="e.g. Kitchen"
                    className={FIELD}
                  />
                </div>

                <SelectField
                  id="staff-employment-type"
                  label="Employment Type"
                  value={employmentType}
                  onChange={setEmploymentType}
                  options={EMPLOYMENT_TYPES}
                />

                {canSeeSensitive && (
                  <div>
                    <label htmlFor="staff-salary" className={LABEL}>
                      Salary{" "}
                      <span className="font-sora text-[11px] font-normal text-black/40">
                        (owner only)
                      </span>
                    </label>
                    <input
                      id="staff-salary"
                      type="number"
                      min={0}
                      step="0.01"
                      value={salary}
                      onChange={(event) => setSalary(event.target.value)}
                      placeholder="e.g. 25000"
                      className={FIELD}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="staff-password" className={LABEL}>
                    Reset Password{" "}
                    <span className="font-sora text-[11px] font-normal text-black/40">
                      (optional)
                    </span>
                  </label>
                  {/* ফাঁকা রাখলে কিছুই বদলায় না — PATCH route ফাঁকা
                      string-কে "password বদলাও" হিসেবে ধরে না। */}
                  <input
                    id="staff-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Leave blank to keep current password"
                    className={FIELD}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </StaffModalShell>
  );
}
