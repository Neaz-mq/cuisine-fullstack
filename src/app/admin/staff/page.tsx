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
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[52px]"
                >
                  <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-4 xl:col-auto xl:row-auto xl:w-[203px] xl:shrink-0">
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
                        <p className="truncate font-sora text-[11px] font-normal leading-none tracking-[0.04em] text-black/40">
                          {member.staffProfile.employeeId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 row-start-2 grid grid-cols-2 gap-4 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:col-auto xl:row-auto xl:min-w-0 xl:flex-1 xl:items-center xl:gap-5 xl:grid-cols-[minmax(0,100fr)_minmax(0,125fr)_minmax(0,62fr)_minmax(0,190fr)_minmax(0,82fr)]">
                    <InfoField
                      className=""
                      label="Join Date"
                      value={
                        member.staffProfile ? formatJoinDate(member.staffProfile.hireDate) : "—"
                      }
                    />
                    <InfoField
                      className=""
                      label="Phone Number"
                      value={member.staffProfile?.phone ?? "—"}
                    />
                    {/**
                     * ⚠️ তৃতীয় কলামটা (Role) সব breakpoint-এ left-aligned।
                     *
                     * আগে min-[560px]-এ `text-right` ছিল — ধারণা ছিল
                     * label + value দুটোই কার্ডের ডান কিনারায় (উপরের
                     * "View" বোতামের কিনারার সাথে) মিলিয়ে দেখানো ঠিক।
                     * কিন্তু Figma-র InfoField spec (Status/#RYT65162
                     * ব্লক) স্পষ্ট করে দেখায় প্রতিটা label/value জোড়া
                     * `align-items: flex-start` — মানে নিজের (auto-sized)
                     * কলামের **বাঁ কিনারায়** বসে, ডানে নয়।
                     *
                     * কলামটা নিজেই `auto` (content-width) আর গ্রিডের
                     * শেষ ট্র্যাক, তাই বাকি দুই `1fr` কলাম সব ফাঁকা
                     * জায়গা শুষে নেয় আর এই auto কলামটা এমনিতেই কার্ডের
                     * ডান দিকে গিয়ে বসে। তার ভেতরে টেক্সট বাঁ-ঘেঁষা
                     * করলেই "Role" label আর তার value ("Waiter",
                     * "Manager" ইত্যাদি) একই x-position থেকে শুরু হয় —
                     * ঠিক যেটা দরকার ছিল, আলাদা করে ডান কিনারায় ঠেলে
                     * দেওয়ার প্রয়োজন নেই।
                     */}
                    <InfoField
                      className=""
                      label="Role"
                      value={ROLE_LABELS[member.role as StaffRole]}
                    />
                    <InfoField className="" label="Shift" value={shiftLabel} />
                    <InfoField
                      className=""
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