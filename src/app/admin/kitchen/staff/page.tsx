import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import type { StaffRole } from "@/lib/permissions";
import { SHIFT_TABLE_LABELS, isStaffShift } from "@/lib/staff-shift";
import {
  ALL_ROLES,
  KITCHEN_STAFF_ROLES,
  ROLE_LABELS,
  isKitchenStaffRole,
} from "@/lib/staff-roles";
import { DEFAULT_SUPPLIER_STATUS, isSupplierStatusFilter } from "@/lib/supplier-status";
import { DEFAULT_OVERVIEW_PERIOD, isOverviewPeriod } from "@/lib/overview-period";
import { formatJoinDate } from "@/lib/format-date";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import StaffOverviewCards from "@/components/admin/StaffOverviewCards";
import UserAvatar from "@/components/admin/UserAvatar";
import InfoField from "@/components/admin/InfoField";
import { KitchenRoleFilter, KitchenStaffToolbar } from "./KitchenStaffFilters";

export const metadata = { title: "Staff" };

/**
 * Figma draws five rows (5 × 94 + 4 × 16 = 534) and the footer reads
 * "Showing 1-5 of 20", so five per page.
 */
const STAFF_PER_PAGE = 5;
const BASE_PATH = "/admin/kitchen/staff";

/**
 * src/app/admin/kitchen/staff/page.tsx
 *
 * "Staff" in the Figma kitchen sidebar — the layout of /admin/staff, but:
 *
 *  • ONLY chefs (KITCHEN) and cleaners. The query, the Overview cards, the
 *    role filter and the CSV export are all limited to KITCHEN_STAFF_ROLES;
 *    managers, owners, riders, waiters and cashiers never reach this page.
 *  • READ-ONLY: no "Add New", no Edit / View on a row.
 *  • Only what Figma shows per row: name, email, join date, phone, role,
 *    shift, status. No employee ID, address, NID or salary is even selected.
 *
 * Behind the "kitchen" scope (layout.tsx one level up + requireStaff here),
 * not "staff" — /admin/staff stays closed to a cook.
 */
export default async function KitchenStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string; period?: string }>;
}) {
  const session = await requireStaff("kitchen");

  const params = await searchParams;
  const q = params.q?.trim();
  const roleFilter: StaffRole | null = isKitchenStaffRole(params.role) ? params.role : null;
  const status = isSupplierStatusFilter(params.status) ? params.status : DEFAULT_SUPPLIER_STATUS;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;

  const now = new Date();

  /**
   * ⚠️ Mirror of /api/admin/staff/export (kitchen branch) — change one,
   * change the other.
   */
  const where: Prisma.UserWhereInput = {
    role: roleFilter ?? { in: [...KITCHEN_STAFF_ROLES] },
    AND: [
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      // No StaffProfile counts as Active (`isActive ?? true` below).
      ...(status === "active"
        ? [{ OR: [{ staffProfile: { is: null } }, { staffProfile: { isActive: true } }] }]
        : status === "inactive"
          ? [{ staffProfile: { isActive: false } }]
          : []),
    ],
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
          select: { phone: true, hireDate: true, shift: true, isActive: true },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / STAFF_PER_PAGE));
  const rangeStart = total === 0 ? 0 : (page - 1) * STAFF_PER_PAGE + 1;
  const rangeEnd = Math.min(page * STAFF_PER_PAGE, total);

  return (
    <div className="space-y-4">
      {/* Header row — "Welcome Back, <name>!" + date pill + Export Report. */}
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

          {/* No `page`: the export is the whole filtered list. */}
          <ExportReportButton
            endpoint="/api/admin/staff/export"
            forwardParams={["q", "role", "status"]}
            fallbackFilename="cuisine-staff.csv"
          />
        </div>
      </div>

      <KitchenStaffToolbar status={status} />

      {/* Overview — Chefs · Cleaners only. */}
      <StaffOverviewCards period={period} only={KITCHEN_STAFF_ROLES} />

      {/* --- Staff Information --- */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Staff Information
          </h2>

          <KitchenRoleFilter value={roleFilter ?? ALL_ROLES} />
        </div>

        {staff.length === 0 ? (
          <p className="py-10 text-center font-sora text-[14px] text-black/70">
            {q || roleFilter || status !== "all"
              ? "No staff match this filter."
              : "No chefs or cleaners yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {staff.map((member) => {
              const shiftLabel =
                member.staffProfile?.shift && isStaffShift(member.staffProfile.shift)
                  ? SHIFT_TABLE_LABELS[member.staffProfile.shift]
                  : "—";
              const isActive = member.staffProfile?.isActive ?? true;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[52px]"
                >
                  {/* Avatar + name + email. */}
                  <div className="flex min-w-0 items-center gap-4 min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[203px] xl:shrink-0">
                    <UserAvatar src={member.image} name={member.name ?? member.email} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                        {member.name ?? "Unnamed"}
                      </p>
                      <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {/* Five fields — same responsive layouts as /admin/staff.
                      DOM order is the phone order (Join Date, Shift, Phone,
                      Role, Status); tablet/desktop show Join Date, Phone,
                      Role, Shift, Status via explicit col/row starts.
                      xl columns: 100=Join Date, 125=Phone, 62=Role,
                      190=Shift, 82=Status. */}
                  <div className="flex flex-col gap-5 min-[560px]:col-span-2 min-[560px]:row-start-2 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] min-[560px]:gap-4 xl:col-auto xl:row-auto xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,100fr)_minmax(0,125fr)_minmax(0,62fr)_minmax(0,190fr)_minmax(0,82fr)] xl:items-center xl:gap-5">
                    <div className="flex gap-5 min-[560px]:contents">
                      <InfoField
                        className="min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-start-1 xl:row-start-1"
                        label="Join Date"
                        value={
                          member.staffProfile ? formatJoinDate(member.staffProfile.hireDate) : "—"
                        }
                      />
                      <InfoField
                        className="flex-1 min-[560px]:col-start-1 min-[560px]:row-start-2 xl:col-start-4 xl:row-start-1"
                        label="Shift"
                        value={shiftLabel}
                      />
                    </div>

                    <div className="flex gap-5 min-[560px]:contents">
                      <InfoField
                        className="flex-1 min-[560px]:col-start-2 min-[560px]:row-start-1 xl:col-start-2 xl:row-start-1"
                        label="Phone Number"
                        value={member.staffProfile?.phone ?? "—"}
                      />
                      <InfoField
                        className="min-[560px]:col-start-3 min-[560px]:row-start-1 xl:col-start-3 xl:row-start-1"
                        label="Role"
                        value={ROLE_LABELS[member.role as StaffRole]}
                      />
                    </div>

                    <InfoField
                      className="min-[560px]:col-start-2 min-[560px]:row-start-2 xl:col-start-5 xl:row-start-1"
                      label="Status"
                      value={isActive ? "Active" : "Inactive"}
                      tone={isActive ? "positive" : "negative"}
                    />
                  </div>

                  {/* No row actions: the kitchen view is read-only. */}
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
            of <span className="font-semibold text-black">{total}</span> Staff
          </p>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath={BASE_PATH}
          />
        </div>
      </div>
    </div>
  );
}
