import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { canManageStaffRole, canViewSensitiveStaffFields, type StaffRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/staff-roles";
import { SHIFT_LABELS, isStaffShift } from "@/lib/staff-shift";
import { formatJoinDate } from "@/lib/format-date";
import UserAvatar from "@/components/admin/UserAvatar";
import InfoField from "@/components/admin/InfoField";
import DeactivateStaffButton from "../../DeactivateStaffButton";

export const metadata = { title: "Staff details" };

/**
 * src/app/admin/staff/[id]/view/page.tsx
 *
 * Figma-র সারির "View" বোতামের গন্তব্য — একজন কর্মীর পুরো record,
 * কেবল পড়ার জন্য।
 *
 * ── কেন edit পাতাটাই যথেষ্ট নয় ───────────────────────────────────────
 *
 * আগে সারিতে শুধু "Edit" ছিল, এই যুক্তিতে যে edit পাতাই তো সব তথ্য
 * দেখায়। কিন্তু দুটো জিনিস আলাদা।
 *
 * এক, অধিকার: একজন MANAGER একজন OWNER-কে **দেখতে** পারেন (তিনি তালিকায়
 * আছেন), কিন্তু তাঁর edit পাতা খুললে notFound() পান। অর্থাৎ edit-ই
 * একমাত্র পথ হলে কিছু কর্মীর তথ্য কেউ কেউ কখনো দেখতেই পেতেন না।
 *
 * দুই, উদ্দেশ্য: "রিদয়ের শিফট কী" জানতে ফর্ম খোলার মানে হলো প্রতিটা
 * ঘর edit অবস্থায় থাকা, আর একটা ভুল keystroke-ই যথেষ্ট। পড়ার কাজে
 * পড়ার পাতা।
 *
 * Deactivate/Reactivate বোতামটাও এখন এখানে, তালিকার সারিতে নয় —
 * StaffRowActions.tsx-এর মন্তব্যে কারণটা বিস্তারিত আছে।
 */
export default async function StaffViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireStaff("staff");
  const viewerId = session.user.id;
  const viewerRole = (session.user as { role?: string }).role;

  const member = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      staffProfile: {
        select: {
          employeeId: true,
          department: true,
          employmentType: true,
          phone: true,
          address: true,
          hireDate: true,
          shift: true,
          isActive: true,
          nid: true,
          salary: true,
        },
      },
    },
  });

  if (!member || member.role === "CUSTOMER") notFound();

  const profile = member.staffProfile;
  const isSelf = member.id === viewerId;
  const canManage = canManageStaffRole(viewerRole, member.role);
  const canSeeSensitive = canViewSensitiveStaffFields(viewerRole);
  const isActive = profile?.isActive ?? true;
  const shiftLabel =
    profile?.shift && isStaffShift(profile.shift) ? SHIFT_LABELS[profile.shift] : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <Link
          href="/admin/staff"
          className="flex w-fit items-center gap-2 font-sora text-[14px] font-medium leading-none text-black/70 transition-colors hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          Back to Staff
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {/* Edit শুধু তখনই, যখন সেই পাতাটা সত্যিই খুলবে — তালিকার
              সারির StaffRowActions-এর একই canManage নিয়ম। */}
          {canManage && (
            <Link
              href={`/admin/staff/${member.id}`}
              className="flex h-11 items-center justify-center rounded-full border border-black px-5 font-sora text-[14px] font-medium leading-none text-black transition-colors hover:bg-black hover:text-white"
            >
              Edit
            </Link>
          )}
          {/* নিজেকে নিষ্ক্রিয় করা API-তেও আটকানো (নিজেকে তালাবন্ধ করে
              ফেলা), তাই বোতামটাও দেখানো হয় না। */}
          {!isSelf && canManage && profile && (
            <DeactivateStaffButton
              userId={member.id}
              isActive={isActive}
              name={member.name ?? member.email}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        {/* তালিকার সারির হুবহু একই পরিচয়-ব্লক (UserAvatar + নাম + ইমেইল),
            যাতে View খুললে "এটাই তো ওই সারিটা" বোঝা যায়। */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar src={member.image} name={member.name ?? member.email} />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate font-frank-ruhl text-[22px] font-medium leading-[1.2] text-black">
                {member.name ?? "Unnamed"}
                {isSelf && (
                  <span className="ml-1.5 font-sora text-[12px] font-normal text-black/40">
                    (you)
                  </span>
                )}
              </p>
              <p className="truncate font-sora text-[13px] leading-[1.7] text-black/70">
                {member.email}
              </p>
            </div>
          </div>

          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] leading-none text-black">
            {profile?.employeeId ?? "No employee ID"}
          </span>
        </div>

        <div className="h-px bg-black/[0.06]" aria-hidden="true" />

        {/* তালিকার সারির একই InfoField, একই grid যুক্তি — ছোট পর্দায়
            দুই কলাম, ৫৬০ থেকে তিন, xl থেকে চার। */}
        <div className="grid grid-cols-2 gap-5 min-[560px]:grid-cols-3 xl:grid-cols-4">
          <InfoField label="Role" value={ROLE_LABELS[member.role as StaffRole]} />
          <InfoField
            label="Join Date"
            value={profile ? formatJoinDate(profile.hireDate) : "—"}
          />
          <InfoField label="Phone Number" value={profile?.phone ?? "—"} />
          <InfoField
            label="Status"
            value={isActive ? "Active" : "Inactive"}
            tone={isActive ? "positive" : "negative"}
          />
          <InfoField label="Shift" value={shiftLabel} />
          <InfoField label="Department" value={profile?.department ?? "—"} />
          <InfoField
            label="Employment Type"
            value={profile ? profile.employmentType.replace("_", " ") : "—"}
          />
          <InfoField label="Permanent Address" value={profile?.address ?? "—"} />
        </div>

        {/**
         * ⚠️ NID আর salary — কেবল OWNER-এর জন্য, আর সেটা `select`-এ
         * নয়, render-এ আটকানো হয়েছে বলে মনে করা ভুল হবে: উপরের query
         * সবার জন্যই দুটো তুলে আনে। এটা নিরাপদ কারণ এটা একটা server
         * component — মানগুলো কখনো client bundle বা HTML-এ যায় না,
         * যদি না নিচের শর্তটা সত্যি হয়।
         *
         * তবু এটা schema.prisma-র "field-level access control নেই"
         * সীমাবদ্ধতার ঠিক সেই জায়গা যেখানে একটা ভুল সহজেই ফাঁস
         * ঘটাত — তাই শর্তটা যতটা সম্ভব দৃশ্যমান রাখা হলো।
         */}
        {canSeeSensitive && profile && (
          <>
            <div className="h-px bg-black/[0.06]" aria-hidden="true" />
            <div className="flex flex-col gap-4">
              <p className="font-sora text-[13px] font-medium leading-none text-black/50">
                Owner-only details
              </p>
              <div className="grid grid-cols-2 gap-5 min-[560px]:grid-cols-3 xl:grid-cols-4">
                <InfoField label="NID Number" value={profile.nid ?? "—"} />
                <InfoField
                  label="Salary"
                  value={profile.salary != null ? `৳ ${profile.salary.toString()}` : "—"}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
