import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import { canManageStaffRole, type StaffRole } from "@/lib/permissions";
import { SHIFT_TABLE_LABELS, isStaffShift } from "@/lib/staff-shift";
import { ALL_ROLES, ROLE_LABELS, isStaffRoleFilter } from "@/lib/staff-roles";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import StaffOverviewCards from "@/components/admin/StaffOverviewCards";
import { DEFAULT_OVERVIEW_PERIOD, isOverviewPeriod } from "@/lib/overview-period";
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
  searchParams: Promise<{ q?: string; role?: string; page?: string; period?: string }>;
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
  // অচেনা মান চুপচাপ ডিফল্টে নামে — URL হাতে বদলে দিলে error নয়,
  // শুধু ছাঁকনিটা "All"-এ ফেরে।
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;

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

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          <ExportReportButton
            endpoint="/api/admin/staff/export"
            forwardParams={["q", "role"]}
            fallbackFilename="cuisine-staff.csv"
          />
        </div>
      </div>

      <StaffToolbar viewerRole={viewerRole} />

      <StaffOverviewCards period={period} />

      {/* --- Staff Information --- */}
      {/**
       * ⚠️ ৩২০px-এ padding ২০ নয়, ১৬ — আর এই ৪px-টা নিছক রুচির প্রশ্ন
       * নয়, ভেতরের সারিটা আঁটার শর্ত। Figma-র ৩২০px frame-এ staff
       * কার্ডটার প্রস্থ লেখা `width: 256px`, অর্থাৎ 288 (shell-এর
       * p-4 বাদে) − ২×১৬। ২০ রাখলে সেটা ২৪৮ হয়, কার্ডের নিজের p-4
       * বাদে ভেতরে থাকে ২১৬ — অথচ Figma-র মাঠ-সারিটার জন্য দরকার
       * ২২৪ (79 + gap 20 + 125)। ফলে "Evening (02-10 PM)" কেটে
       * "Evening (02…" হয়ে যেত।
       */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Staff Information
          </h2>

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
              const canManage = canManageStaffRole(viewerRole, member.role);
              const shiftLabel =
                member.staffProfile?.shift && isStaffShift(member.staffProfile.shift)
                  ? SHIFT_TABLE_LABELS[member.staffProfile.shift]
                  : "—";
              const isActive = member.staffProfile?.isActive ?? true;

              return (
                <div
                  key={member.id}
                  /**
                   * Figma Frame 2147236343 (৩২০px): column,
                   * align-items flex-start, padding 16, gap 16,
                   * width 256, radius 16, BG #F9F6F3।
                   *
                   * ⚠️ ৫৬০-এর নিচে এটা একটামাত্র কলাম — grid নয়।
                   * আগে grid-টা সব পর্দায় চালু ছিল, আর ৩২০px-এ
                   * তার ডান ঘরে Edit/View বসায় বাঁ ঘরে পড়ে থাকত
                   * ~৯০px; নামটা ওখানে চেপে গিয়ে পড়াই যেত না।
                   * এখন ৩২০-এ ক্রমটা Figma-র মতো উপর থেকে নিচে:
                   * পরিচয় → পাঁচটা মাঠ → Edit/View (ডান কোণে)।
                   *
                   * ⚠️ base-এ `items-start` নেই, ইচ্ছাকৃতভাবে। flex-col-এ
                   * ওটা মানে align-items: flex-start, অর্থাৎ প্রতিটা
                   * সন্তান নিজের লেখার মাপে সংকুচিত — তাহলে মাঠের
                   * সারিটা পুরো প্রস্থ পেত না আর বোতামজোড়া ডানে
                   * যেত না। তাই ওটাও `min-[560px]:` দিয়ে ঘেরা।
                   */
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[52px]"
                >
                  {/* Figma Frame 2147236287: row, gap 16, width 203।
                      ৫৬০-এর নিচে placement ছাড়া — flex-col-এর প্রথম
                      সন্তান হিসেবে পুরো প্রস্থটাই পায়। */}
                  <div className="flex min-w-0 items-center gap-4 min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[203px] xl:shrink-0">
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
                      {member.staffProfile?.employeeId && (
                        /* Figma "EMP-0008": Sora 400 11px, LH 150%,
                           Black/70 — letter-spacing নেই। আগে এটা
                           /40 আর leading-none ছিল, তাতে লাইনটা এত
                           ফিকে হত যে cream পটভূমিতে প্রায় মিলিয়ে
                           যেত; export-এ পরিষ্কার লেখা rgba(0,0,0,0.7)। */
                        <p className="truncate font-sora text-[11px] font-normal leading-[1.5] text-black/70">
                          {member.staffProfile.employeeId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/**
                   * Frame 2147236686/2147236677 — পাঁচটা মাঠ।
                   *
                   * ⚠️ ৩২০px-এ এটা **দুটো আলাদা flex সারি**, একটা
                   * grid নয় — আর কারণটা জ্যামিতিক, পছন্দের নয়।
                   * Figma-র ৩২০px frame-এ কলামের মাপ প্রতি সারিতে
                   * আলাদা:
                   *
                   *   সারি ১:  Join Date  79 | Shift  125 (grow)
                   *   সারি ২:  Phone     140 (grow) | Role  64
                   *
                   * একটামাত্র grid দিয়ে এটা অসম্ভব: এক কলামকে একই
                   * সাথে ৭৯ আর ১৪০ হতে হবে। দুটোরই সর্বোচ্চ নিলে
                   * দাঁড়ায় 140 + 20 + 125 = ২৮৫, অথচ জায়গা ২২৪।
                   * তাই designer যা করেছেন সেটাই — প্রতিটা সারি
                   * নিজের মতো ভাগ করে নেয়: ছোট মাঠটা নিজের লেখার
                   * মাপে (flex-grow 0), বড়টা বাকিটুকু নেয় (flex-1)।
                   *
                   * ⚠️ মোড়ক দুটোয় `min-[560px]:contents` — ৫৬০ থেকে
                   * ওরা নিজেরা আর কোনো বাক্স থাকে না, ভেতরের পাঁচটা
                   * InfoField সরাসরি এই grid-এর ঘর হয়ে যায়। এটা
                   * জরুরি, কারণ ৫৬০+ আর xl-এ মাঠগুলো এক সারিতে
                   * বসে — মোড়ক থাকলে ওরা দুটো ব্লকেই আটকে থাকত।
                   *
                   * ⚠️ DOM-ক্রম এখন মোবাইলের ক্রম (Join Date, Shift,
                   * Phone, Role, Status), অথচ ৫৬০+ আর desktop-এ
                   * দেখাতে হয় Join Date, Phone, Role, Shift, Status।
                   * তাই প্রতিটা মাঠে স্পষ্ট `col-start`/`row-start` —
                   * auto-placement-এর ভরসায় না থেকে। এতে ক্রম বদলাতে
                   * DOM ছুঁতে হয় না, ফলে screen reader-এর ক্রমও
                   * (উপর থেকে নিচে, মোবাইলের মতো) স্থির থাকে।
                   *
                   * ⚠️ xl-এর কলাম-প্রস্থগুলো অবস্থান-ভিত্তিক, তাই
                   * template-টা desktop-এর **দেখানোর** ক্রমে লেখা:
                   * 100=Join Date, 125=Phone, 62=Role, 190=Shift,
                   * 82=Status। `minmax(0, Nfr)` — flex নয় — কারণ
                   * প্রতিটা সারি আলাদা container, আর content-নির্ভর
                   * প্রস্থে এক সারির "Shift" আরেক সারির সাথে মিলত না।
                   */}
                  <div className="flex flex-col gap-5 min-[560px]:col-span-2 min-[560px]:row-start-2 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] min-[560px]:gap-4 xl:col-auto xl:row-auto xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,100fr)_minmax(0,125fr)_minmax(0,62fr)_minmax(0,190fr)_minmax(0,82fr)] xl:items-center xl:gap-5">
                    {/* Frame 2147236675 — মোবাইলের প্রথম সারি। */}
                    <div className="flex gap-5 min-[560px]:contents">
                      <InfoField
                        className="min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-start-1 xl:row-start-1"
                        label="Join Date"
                        value={
                          member.staffProfile ? formatJoinDate(member.staffProfile.hireDate) : "—"
                        }
                      />
                      {/* flex-1 — Figma-তে এই মাঠটা flex-grow 1, কারণ
                          "Evening (02-10 PM)" সারির সবচেয়ে চওড়া মান
                          (১৪px-এ ঠিক ১২৫px, Figma-র লেখা মাপের সমান)। */}
                      <InfoField
                        className="flex-1 min-[560px]:col-start-1 min-[560px]:row-start-2 xl:col-start-4 xl:row-start-1"
                        label="Shift"
                        value={shiftLabel}
                      />
                    </div>

                    {/* Frame 2147236676 — মোবাইলের দ্বিতীয় সারি। এখানে
                        উল্টো: Phone বাড়ে, Role নিজের মাপে থাকে। */}
                    <div className="flex gap-5 min-[560px]:contents">
                      <InfoField
                        className="flex-1 min-[560px]:col-start-2 min-[560px]:row-start-1 xl:col-start-2 xl:row-start-1"
                        label="Phone Number"
                        value={member.staffProfile?.phone ?? "—"}
                      />
                      {/**
                       * ⚠️ "Role" সব পর্দায় বাঁ-ঘেঁষা। একবার
                       * min-[560px]-এ `text-right` ছিল, এই ধারণায় যে
                       * label + value কার্ডের ডান কিনারায় মেলানো উচিত।
                       * Figma-র InfoField spec (Frame 2147236294)
                       * বলে `align-items: flex-start` — প্রতিটা জোড়া
                       * নিজের কলামের **বাঁ** কিনারায় বসে। কলামটা
                       * এমনিতেই ডান দিকে গিয়ে বসে, ভেতরে ঠেলার
                       * দরকার নেই।
                       */}
                      <InfoField
                        className="min-[560px]:col-start-3 min-[560px]:row-start-1 xl:col-start-3 xl:row-start-1"
                        label="Role"
                        value={ROLE_LABELS[member.role as StaffRole]}
                      />
                    </div>

                    {/* Frame 2147236296 — Status একা, নিজের সারিতে। */}
                    <InfoField
                      className="min-[560px]:col-start-2 min-[560px]:row-start-2 xl:col-start-5 xl:row-start-1"
                      label="Status"
                      value={isActive ? "Active" : "Inactive"}
                      tone={isActive ? "positive" : "negative"}
                    />
                  </div>

                  <StaffRowActions
                    userId={member.id}
                    name={member.name ?? member.email}
                    canEdit={canManage}
                    isSelf={isSelf}
                    viewerRole={viewerRole}
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