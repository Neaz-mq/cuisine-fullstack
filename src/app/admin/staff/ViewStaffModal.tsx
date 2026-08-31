"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import UserAvatar from "@/components/admin/UserAvatar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ROLE_LABELS } from "@/lib/staff-roles";
import { SHIFT_LABELS, isStaffShift } from "@/lib/staff-shift";
import { formatJoinDate } from "@/lib/format-date";
import type { StaffRole } from "@/lib/permissions";
import {
  DANGER_BUTTON,
  ModalError,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  ReadOnlyField,
  StaffModalShell,
} from "./staff-modal-ui";

/**
 * src/app/admin/staff/ViewStaffModal.tsx
 *
 * সারির "View" বোতামের গন্তব্য — একজন কর্মীর পুরো record, কেবল পড়ার
 * জন্য।
 *
 * ── কেন modal, পাতা নয় ──────────────────────────────────────────────
 *
 * আগে এটা /admin/staff/[id]/view ছিল — একটা আলাদা পাতা। কাজ করত,
 * কিন্তু তালিকা থেকে বেরিয়ে যেতে হতো: দশজনের শিফট দেখতে দশবার
 * পাতা বদল, প্রতিবার ফিরে এসে ছাঁকনি আর page নম্বর আবার খুঁজে নেওয়া।
 * modal-এ পেছনের তালিকাটা যেখানে ছিল সেখানেই থাকে।
 *
 * ⚠️ পাতাটা এখন আর কোথাও থেকে খোলে না। `src/app/admin/staff/[id]/view/`
 * ফোল্ডারটা মুছে ফেলা যায়।
 *
 * ── কেন edit modal-ই যথেষ্ট নয় ──────────────────────────────────────
 *
 * দুটো কারণে।
 *
 * এক, অধিকার: একজন MANAGER একজন OWNER-কে **দেখতে** পারেন (তিনি
 * তালিকায় আছেন), কিন্তু তাঁকে সম্পাদনা করতে পারেন না — PATCH route
 * 403 দেয়। edit-ই একমাত্র পথ হলে কিছু কর্মীর তথ্য কেউ কেউ কখনো
 * দেখতেই পেতেন না।
 *
 * দুই, উদ্দেশ্য: "রিদয়ের শিফট কী" জানতে form খোলার মানে প্রতিটা ঘর
 * সম্পাদনাযোগ্য অবস্থায় থাকা, আর একটা ভুল keystroke-ই যথেষ্ট।
 */

type StaffDetails = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  staffProfile: {
    employeeId: string;
    department: string | null;
    employmentType: string;
    phone: string | null;
    hireDate: string;
    address: string | null;
    shift: string | null;
    isActive: boolean;
    nid?: string | null;
    salary?: number | null;
  } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  staffId: string;
  /** সম্পাদনা/নিষ্ক্রিয় করার অধিকার আছে কি না। */
  canManage: boolean;
  isSelf: boolean;
  /** "Edit" চাপলে — এই modal বন্ধ করে form modal খোলে। */
  onEdit: () => void;
};

/**
 * ⚠️ বন্ধ থাকলে কিছুই mount হয় না।
 *
 * আগে component-টা mount থাকত আর একটা effect খোলার সময় state পরিষ্কার
 * করত (`setStaff(null); setLoading(true); …`)। lint ঠিকই ধরেছে
 * (`react-hooks/set-state-in-effect`): effect-এর শরীরে সরাসরি setState
 * মানে React একবার পুরনো state নিয়ে render করে, তারপর আবার। এখানে
 * সেটা কেবল কর্মক্ষমতার প্রশ্ন ছিল না — এক ফ্রেমের জন্য **আগের**
 * কর্মীর তথ্য নতুন modal-এ দেখা যেতে পারত।
 *
 * mount/unmount-এ ওই পরিষ্কার করার ধাপটার দরকারই নেই: `useState`-এর
 * প্রাথমিক মানই একমাত্র সত্য।
 */
export default function ViewStaffModal(props: Props) {
  if (!props.open) return null;
  return <ViewStaffModalContent {...props} />;
}

function ViewStaffModalContent({ open, onClose, staffId, canManage, isSelf, onEdit }: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDetails | null>(null);
  // শুরুতেই `true` — ডেটা আসার আগে কিছু দেখানোর নেই, তাই effect-এ
  // `setLoading(true)` ডাকতে হয় না।
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // ⚠️ effect-এর শরীরে সরাসরি কোনো setState নেই — সবগুলো এই async
    // function-এর ভেতরে, প্রথম `await`-এর পরে।
    (async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load this staff member.");
        if (!cancelled) setStaff(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load this staff member.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // অন্য একজনের View চাপলে আগের fetch পরে ফিরে এসে ভুল কর্মীর তথ্য
    // বসিয়ে দিত — এই পতাকাটা সেটাই আটকায়।
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const profile = staff?.staffProfile ?? null;
  const isActive = profile?.isActive ?? true;

  /**
   * ⚠️ browser-এর `confirm()` নয় — ConfirmDialog।
   *
   * তিনটে কারণ, বিস্তারিত components/admin/ConfirmDialog.tsx-এ। সবচেয়ে
   * বড়টা: `confirm()`-এ প্রাথমিক focus থাকে **OK**-তে, অর্থাৎ
   * Deactivate চেপে অভ্যাসবশত Enter চাপলেই কাজটা হয়ে যেত। একটা
   * ধ্বংসাত্মক কাজের জন্য সেটা ঠিক উল্টো আচরণ।
   *
   * সেই সাথে `confirm()` blocking বলে "চলছে" অবস্থাটা দেখানোই যেত না;
   * এখন dialog-টা নিজেই spinner ধরে রাখে যতক্ষণ PATCH চলে।
   */
  async function toggleActive() {
    if (!staff) return;
    const next = !isActive;

    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ?? `Couldn't ${next ? "reactivate" : "deactivate"} this staff member.`
        );
        // dialog বন্ধ করে ভুলটা modal-এর ভেতরে দেখানো হয় — dialog-এর
        // ভেতরে দেখালে ব্যবহারকারী "আবার চেষ্টা করব না বাতিল করব"
        // সিদ্ধান্তে আটকে থাকতেন, আর পেছনের তথ্যটাও ঢাকা পড়ত।
        setConfirmOpen(false);
        setPending(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setConfirmOpen(false);
      setPending(false);
    }
  }

  const shiftLabel =
    profile?.shift && isStaffShift(profile.shift) ? SHIFT_LABELS[profile.shift] : "—";

  return (
    <>
      <StaffModalShell
      open={open}
      onClose={onClose}
      titleId="staff-view-title"
      title="Staff Details"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* নিজেকে নিষ্ক্রিয় করা API-তেও আটকানো (নিজেকে তালাবন্ধ করে
              ফেলা), তাই বোতামটাও দেখানো হয় না।

              ⚠️ এটা একটা ধ্বংসাত্মক কাজ, তাই এটা এখানে — View-এর
              ভেতরে — সারির মধ্যে নয়। তালিকার প্রতিটা সারিতে
              "Deactivate" থাকলে ভুল সারিতে click হওয়া কেবল সময়ের
              ব্যাপার; এখানে পৌঁছতে হলে আগে ওই নির্দিষ্ট কর্মীর
              তথ্যটা চোখের সামনে আসে। */}
          {canManage && !isSelf && profile && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending || loading}
              className={`${isActive ? DANGER_BUTTON : OUTLINE_BUTTON} sm:mr-auto`}
            >
              {isActive ? "Deactivate" : "Reactivate"}
            </button>
          )}

          <button type="button" onClick={onClose} className={`${OUTLINE_BUTTON} flex-1 sm:flex-none`}>
            Close
          </button>

          {canManage && (
            <button
              type="button"
              onClick={onEdit}
              disabled={loading}
              className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`}
            >
              Edit
            </button>
          )}
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {loading || !staff ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-black/40" aria-hidden="true" />
        </div>
      ) : (
        <>
          {/* তালিকার সারির হুবহু একই পরিচয়-ব্লক (avatar + নাম + ইমেইল
              + employee ID), যাতে View খুললে "এটাই তো ওই সারিটা" বোঝা
              যায়। */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex min-w-0 items-center gap-4">
              <UserAvatar src={staff.image} name={staff.name ?? staff.email} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                  {staff.name ?? "Unnamed"}
                  {isSelf && (
                    <span className="ml-1.5 font-sora text-[12px] font-normal text-black/40">
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                  {staff.email}
                </p>
              </div>
            </div>

            <span className="flex h-9 shrink-0 items-center rounded-full bg-white px-4 font-sora text-[13px] leading-none text-black">
              {profile?.employeeId ?? "No employee ID"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-5 min-[560px]:grid-cols-3">
            <ReadOnlyField label="Role" value={ROLE_LABELS[staff.role as StaffRole] ?? staff.role} />
            <ReadOnlyField
              label="Join Date"
              value={profile ? formatJoinDate(new Date(profile.hireDate)) : "—"}
            />
            <ReadOnlyField label="Phone Number" value={profile?.phone ?? "—"} />
            <ReadOnlyField
              label="Status"
              value={isActive ? "Active" : "Inactive"}
              tone={isActive ? "positive" : "negative"}
            />
            <ReadOnlyField label="Shift" value={shiftLabel} />
            <ReadOnlyField label="Department" value={profile?.department ?? "—"} />
            <ReadOnlyField
              label="Employment Type"
              value={profile ? profile.employmentType.replace("_", " ") : "—"}
            />
            <ReadOnlyField label="Permanent Address" value={profile?.address ?? "—"} />
            {/* ⚠️ NID এখন এখানে, নিচের "Owner-only" অংশে নয় — MANAGER-রাও
                নিয়োগের কাগজপত্র তোলেন, তাই ক্ষেত্রটা তাঁদেরও দেখা দরকার।
                নিয়মটা API-তেও বদলানো (lib/permissions.ts দ্রষ্টব্য)। */}
            <ReadOnlyField label="NID Number" value={profile?.nid ?? "—"} />
          </div>

          {/**
           * ⚠️ salary — কেবল OWNER-এর জন্য, আর সেই সিদ্ধান্তটা এখানে
           * নয়, **API-তে**: GET /api/admin/staff/[id] ক্ষেত্রটা
           * response-এ ঢোকায়ই না যদি না ডাকা ব্যক্তি OWNER হন
           * (canViewSensitiveStaffFields)। তাই এখানে `in` দিয়ে
           * উপস্থিতি দেখা যথেষ্ট — MANAGER-এর browser-এ মানটা কখনো
           * পৌঁছয়ই না, লুকোনো অবস্থাতেও নয়।
           *
           * NID এই শর্তের বাইরে চলে গেছে — উপরের grid-এ।
           */}
          {profile && "salary" in profile && (
            <>
              <div className="h-px bg-black/[0.06]" aria-hidden="true" />
              <div className="flex flex-col gap-4">
                <p className="font-sora text-[13px] font-medium leading-none text-black/50">
                  Owner-only details
                </p>
                <div className="grid grid-cols-2 gap-5 min-[560px]:grid-cols-3">
                  <ReadOnlyField
                    label="Salary"
                    value={profile.salary != null ? `৳ ${profile.salary.toLocaleString()}` : "—"}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
      </StaffModalShell>

      {/* ⚠️ StaffModalShell-এর **বাইরে**, ভেতরে নয়। ভেতরে বসালে এটা
          modal কার্ডের DOM-এর অংশ হতো, আর কার্ডের `overflow`/stacking
          এটাকে ভেতরে আটকে রাখত — dialog-টা পর্দার মাঝখানে না বসে
          কার্ডের ভেতরে কোথাও ভেসে উঠত। */}
      <ConfirmDialog
        open={confirmOpen}
        tone={isActive ? "danger" : "primary"}
        title={isActive ? "Deactivate this staff member?" : "Reactivate this staff member?"}
        message={
          isActive
            ? `${staff?.name ?? "They"} will no longer be able to sign in. Their record and history stay intact, and you can reactivate them any time.`
            : `${staff?.name ?? "They"} will be able to sign in again straight away.`
        }
        confirmLabel={isActive ? "Yes, deactivate" : "Yes, reactivate"}
        pending={pending}
        onConfirm={toggleActive}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
