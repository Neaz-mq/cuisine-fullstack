import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import {
  canManageStaffRole,
  canViewSensitiveStaffFields,
  type StaffRole,
} from "@/lib/permissions";
import { SHIFT_TABLE_LABELS, isStaffShift } from "@/lib/staff-shift";
import { ALL_ROLES, ROLE_LABELS, isStaffRoleFilter } from "@/lib/staff-roles";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import StaffOverviewCards from "@/components/admin/StaffOverviewCards";
import UserAvatar from "@/components/admin/UserAvatar";
import InfoField from "@/components/admin/InfoField";
import { formatJoinDate } from "@/lib/format-date";
import StaffToolbar from "./StaffToolbar";
import RoleFilter from "./RoleFilter";
import StaffRowActions from "./StaffRowActions";

export const metadata = { title: "Staff" };

const STAFF_PER_PAGE = 10;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  // requireAdmin() নয় — এটা যেকোনো staff role-কেই পাশ করিয়ে দিত, অথচ
  // "staff" scope-টা মূলত OWNER/MANAGER-এর জন্য (permissions.ts-এর
  // ALL_SCOPES মন্তব্য দ্রষ্টব্য)। requireStaff("staff") সঠিক scope
  // যাচাই করে — Users page-এও একই scope, একই কারণে।
  const session = await requireStaff("staff");
  const viewerId = session.user.id;
  const viewerRole = (session.user as { role?: string }).role;

  const params = await searchParams;
  const q = params.q?.trim();
  const roleFilter: StaffRole | null = isStaffRoleFilter(params.role) ? params.role : null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();

  const where: Prisma.UserWhereInput = {
    role: roleFilter ?? { not: "CUSTOMER" },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            // employeeId একটা সম্পর্কিত ফিল্ড (StaffProfile), তাই
            // relation-filter — name/email-এর মতো সরাসরি column নয়।
            { staffProfile: { employeeId: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, staff] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * STAFF_PER_PAGE,
      take: STAFF_PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        staffProfile: {
          select: {
            employeeId: true,
            phone: true,
            hireDate: true,
            shift: true,
            isActive: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / STAFF_PER_PAGE));
  const rangeStart = total === 0 ? 0 : (page - 1) * STAFF_PER_PAGE + 1;
  const rangeEnd = Math.min(page * STAFF_PER_PAGE, total);

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Users page-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        {/**
         * তারিখ + Export — Users page/dashboard-এর হুবহু একই গড়ন, একই
         * breakpoint আচরণ (ব্যাখ্যা admin/users/page.tsx-এ)।
         *
         * ⚠️ আগে এখানে শুধু তারিখটা ছিল, কারণ staff তালিকার নিজের কোনো
         * export route ছিল না — আর ডিফল্ট insights export-এ পাঠালে নাম
         * এক হতো, ফল ভুল: কর্মীর তালিকা চেয়ে order-এর CSV নামত। route-টা
         * এখন আছে (/api/admin/staff/export), তাই বোতামটাও ফিরল।
         *
         * forwardParams-এ `page` নেই, ইচ্ছাকৃতভাবে — export মানে পুরো
         * ছাঁকা তালিকা, পর্দায় দেখা দশটা সারি নয়।
         */}
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 font-sora text-[14px] leading-none text-black">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-[480px]:hidden">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="hidden min-[480px]:inline">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </span>

          <ExportReportButton
            endpoint="/api/admin/staff/export"
            forwardParams={["q", "role"]}
            fallbackFilename="cuisine-staff.csv"
          />
        </div>
      </div>

      <StaffToolbar
        viewerRole={viewerRole}
        canSeeSensitive={canViewSensitiveStaffFields(viewerRole)}
      />

      <StaffOverviewCards />

      {/* --- Staff Information --- */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Staff Information
          </h2>

          {/**
           * এই "All ⌄"-টাই role-ছাঁকনির সত্যিকারের জায়গা — StaffToolbar.tsx-এর
           * শীর্ষ মন্তব্য দ্রষ্টব্য। FilterMenu সরাসরি ব্যবহার করা হচ্ছে,
           * নতুন কোনো inline popup না লিখে। এটা client-side নেভিগেশন
           * (URL বদলায়), তাই একটা ছোট client wrapper (RoleFilter.tsx)
           * লাগে — এই ফাইলটা server component, onSelect-এ সরাসরি router
           * কল করা যায় না।
           */}
          <RoleFilter value={roleFilter ?? ALL_ROLES} />
        </div>

        {staff.length === 0 ? (
          <p className="py-10 text-center font-sora text-[14px] text-black/70">
            {q || roleFilter ? "No staff match this filter." : "No staff members yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {staff.map((member) => {
              const isSelf = member.id === viewerId;
              // MANAGER একটা OWNER-কে দেখতে পারেন (তালিকায় থাকেন),
              // কিন্তু তাঁর record বদলাতে পারেন না — staff/[id]/page.tsx
              // আর API route দুটোরই canManageStaffRole guard-এর সাথে
              // মেলানো, নাহলে "Edit" বোতামটা দেখা যেত অথচ চাপলে 404।
              // "View" এই শর্তের বাইরে: দেখা আর বদলানো এক নয়।
              const canManage = canManageStaffRole(viewerRole, member.role);
              // ⚠️ SHIFT_TABLE_LABELS, SHIFT_LABELS নয় — সারির কলামটা
              // Figma-তে ১৪২px, আর পুরো লেবেলটা ওতে আঁটে না। কারণটা
              // বিস্তারিত lib/staff-shift.ts-এ।
              const shiftLabel =
                member.staffProfile?.shift && isStaffShift(member.staffProfile.shift)
                  ? SHIFT_TABLE_LABELS[member.staffProfile.shift]
                  : "—";
              const isActive = member.staffProfile?.isActive ?? true;

              return (
                <div
                  key={member.id}
                  /* Figma Frame 2147236316: row, space-between, padding 16,
                     gap 52, উচ্চতা 94, radius 16, BG #F9F6F3।
                     ৯৪ = 16 + 62 + 16 — Status কলামটাই (label + ৩৬px pill)
                     উচ্চতা ঠিক করে, ছবিটা নয় (৬০)। */
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-8 2xl:gap-[52px]"
                >
                  <div className="flex min-w-0 items-center gap-4 xl:w-[203px] xl:shrink-0">
                    <UserAvatar src={member.image} name={member.name ?? member.email} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                        {member.name ?? "Unnamed"}
                        {isSelf && (
                          <span className="ml-1.5 font-sora text-[12px] font-normal text-black/40">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {/**
                   * Figma Frame 2147236445: row, gap 20, উচ্চতা 62,
                   * align-items center।
                   *
                   * ⚠️ মাঠগুলো সমান চওড়া নয়, আর এটাই আগের সবচেয়ে বড়
                   * অমিল ছিল। ডিফল্ট `xl:flex-1` পাঁচটাকে সমান ভাগ করে
                   * দিচ্ছিল, ফলে "Role" (Manager — ছোট) পেত ততটাই জায়গা
                   * যতটা "Shift" (Evening (02-10 PM) — বড়): Role-এর
                   * চারপাশে বিশাল ফাঁক, আর কলামগুলো পুরো সারিতে ছড়িয়ে
                   * নকশার ঠাসা গড়নটা হারিয়ে যাচ্ছিল।
                   *
                   * এখন প্রতিটা মাঠ Figma-র নিজের প্রস্থটাই flex-grow
                   * হিসেবে পায় (79 / 134 / 64 / 142 / 64) — অর্থাৎ
                   * বাড়তি জায়গাটা নকশার অনুপাতেই ভাগ হয়, স্থির px
                   * বসানো ছাড়া।
                   *
                   * ⚠️ basis `auto`, `0` নয় (`flex-[79_1_auto]`)। এটাই
                   * এখানকার আসল কৌশল। basis 0 হলে কলামের প্রস্থ কেবল
                   * অনুপাত থেকে আসত, ভেতরে কী আছে তা থেকে নয় — আর
                   * designer-এর মাপগুলো তাঁর নমুনা লেখার ("Jul 3, 2026")
                   * জন্য, আমাদের বাস্তব ডেটার ("Aug 30, 2026") জন্য নয়।
                   * ফলে ৭৯px-এ তারিখটা চুপচাপ কেটে যেত। basis auto-তে
                   * প্রতিটা কলাম আগে নিজের লেখাটুকুর জায়গা নেয়, তারপর
                   * যা বাকি থাকে সেটা অনুপাতে ভাগ হয়।
                   *
                   * xl-এর নিচে আগের মতোই grid — সেখানে সারি ভেঙে
                   * দুই/তিন কলাম হয়, তাই প্রস্থের অনুপাত অর্থহীন।
                   */}
                  <div className="grid grid-cols-2 gap-4 min-[560px]:grid-cols-3 xl:flex xl:min-w-0 xl:flex-1 xl:items-center xl:gap-5">
                    <InfoField
                      className="xl:flex-[79_1_auto]"
                      label="Join Date"
                      value={
                        member.staffProfile ? formatJoinDate(member.staffProfile.hireDate) : "—"
                      }
                    />
                    <InfoField
                      className="xl:flex-[134_1_auto]"
                      label="Phone Number"
                      value={member.staffProfile?.phone ?? "—"}
                    />
                    <InfoField
                      className="xl:flex-[64_1_auto]"
                      label="Role"
                      value={ROLE_LABELS[member.role as StaffRole]}
                    />
                    <InfoField className="xl:flex-[142_1_auto]" label="Shift" value={shiftLabel} />
                    <InfoField
                      className="xl:flex-[64_1_auto]"
                      label="Status"
                      value={isActive ? "Active" : "Inactive"}
                      tone={isActive ? "positive" : "negative"}
                    />
                  </div>

                  {/* Figma-র Edit (সাদা outline pill) + View (gradient
                      pill)। Deactivate/Reactivate আর এখানে নেই — সেটা
                      সরে গেছে View পাতায়; কারণ StaffRowActions.tsx-এ। */}
                  <StaffRowActions
                    userId={member.id}
                    name={member.name ?? member.email}
                    canEdit={canManage}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing{" "}
            <span className="font-semibold text-black">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-black">{total}</span>{" "}
            Staff
          </p>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath="/admin/staff"
          />
        </div>
      </div>
    </div>
  );
}
