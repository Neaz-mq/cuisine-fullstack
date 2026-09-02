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
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {/* ⚠️ ৩২০px-এও পুরো তারিখ, বছর সহ — কারণ Users পাতার একই
                pill-এর মন্তব্যে (Figma-র ৩২০px frame ধরে হিসাব)। */}
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
        {/* ⚠️ `items-center`, `items-start` নয়।

            শিরোনামটা `leading-none`, অর্থাৎ তার line box ঠিক অক্ষরের
            উচ্চতা (২৪px)। পাশের pill ৪০px উঁচু। `items-start`-এ দুটোর
            **উপরের কিনারা** মেলে, তাই ৪০px pill-এর ভেতরে লেখাটা
            মাঝখানে বসে আর শিরোনামটা তার চেয়ে ~৮px উপরে থেকে যায় —
            চোখে ধরা পড়ে, কিন্তু কারণটা ধরা পড়ে না।

            Suppliers আর Inventory-র একই সারিতে `items-center` ছিল,
            তাই ওখানে সমস্যাটা কখনো দেখা যায়নি। */}
        <div className="flex items-center justify-between gap-3">
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[52px]"
                >
                  {/* xl-এর নিচে: উপরের সারির বাঁ ঘর (বোতামগুলো ডান ঘরে)।
                      xl থেকে flex, তাই placement নিষ্ক্রিয়। */}
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
                      {/**
                       * Employee ID — Figma-র সারিতে নেই, তবু যোগ করা হলো।
                       *
                       * কারণটা নকশার নয়, একটা ভাঙা loop-এর: উপরের search
                       * বাক্সে স্পষ্ট লেখা "Search by Name, Email or
                       * Employee ID", আর API-ও employeeId ধরে খোঁজে —
                       * অথচ ID-টা তালিকার কোথাও দেখা যেত না। ফলে কেউ
                       * "EMP-0004" লিখে একটা সারি পেতেন, কিন্তু সেটা
                       * সত্যিই ওই ID কি না যাচাই করার কোনো উপায় ছিল না।
                       * যেটা দিয়ে খোঁজা যায় সেটা দেখাও যাওয়া উচিত।
                       *
                       * ⚠️ আলাদা কলাম নয়, পরিচয়-ব্লকের তৃতীয় লাইন — আর
                       * এটা ইচ্ছাকৃত। কলাম করলে "Employee ID" label-টাই
                       * (~95px) মানটার (~72px) চেয়ে চওড়া হতো, অর্থাৎ
                       * সবচেয়ে ছোট তথ্যটা সবচেয়ে বেশি অনুভূমিক জায়গা
                       * খেত। তাছাড়া এটা shift/status-এর মতো কোনো
                       * বৈশিষ্ট্য নয় — এটা মানুষটাকেই চিহ্নিত করে, ঠিক
                       * নাম আর ইমেইলের মতো, তাই ওদের সাথেই থাকা উচিত।
                       * label লাগে না: "EMP-0004" নিজেই নিজের পরিচয়।
                       *
                       * সারির উচ্চতা এতে ~৯৪ থেকে ~৯৫ হয় (leading-none
                       * ১১px), অর্থাৎ Status কলামই এখনো উচ্চতা ঠিক করে।
                       *
                       * staffProfile না থাকলে (পুরনো OWNER row) কিছুই
                       * দেখানো হয় না — "—" বসালে সেটা একটা মান বলে মনে
                       * হতো।
                       */}
                      {member.staffProfile?.employeeId && (
                        <p className="truncate font-sora text-[11px] font-normal leading-none tracking-[0.04em] text-black/40">
                          {member.staffProfile.employeeId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/**
                   * Figma Frame 2147236445: row, gap 20, উচ্চতা 62,
                   * align-items center।
                   *
                   * ── কেন flex থেকে grid-এ সরানো হলো ──────────────────
                   *
                   * flex দিয়ে দু'বার চেষ্টা হয়েছিল, দু'বারই একটা করে
                   * সমস্যা রয়ে গিয়েছিল।
                   *
                   * প্রথমে সবাই `flex-1` — পাঁচটা কলাম সমান, ফলে "Role"
                   * (Manager) পেত ততটাই জায়গা যতটা "Shift" (Afternoon
                   * (10 AM-06 PM))। Role-এর চারপাশে বিশাল ফাঁক।
                   *
                   * তারপর `flex-[N_1_auto]` — অনুপাত ঠিক হলো, কিন্তু
                   * `auto` মানে প্রতিটা কলাম **আগে নিজের লেখাটুকুর**
                   * জায়গা নেয়। আর প্রতিটা সারিতে লেখা আলাদা: এক সারিতে
                   * "Cleaner", আরেকটায় "Owner"; এক সারিতে "Evening
                   * (02-10 PM)", আরেকটায় "Afternoon (10 AM-06 PM)"।
                   * ফলে প্রতিটা সারির কলাম একটু একটু সরে গিয়ে বসত —
                   * টেবিল বলে আর মনেই হতো না। প্রতিটা সারি একটা আলাদা
                   * flex container, তাই ওরা একে অন্যের প্রস্থ জানত না।
                   *
                   * grid-এ `minmax(0, Nfr)` সেটাই ঠিক করে: `fr` ভাগ হয়
                   * কেবল **উপলব্ধ জায়গা** আর অনুপাত থেকে, ভেতরের লেখা
                   * থেকে নয়। সব সারির উপলব্ধ জায়গা সমান (ছবি-ব্লক ২০৩,
                   * বোতাম-ব্লক ১২০ — দুটোই স্থির), তাই কলামগুলোও সব
                   * সারিতে হুবহু এক জায়গায় পড়ে।
                   *
                   * ⚠️ `minmax(0, …)`, খালি `Nfr` নয়। `fr`-এর ডিফল্ট
                   * ন্যূনতম `auto`, অর্থাৎ content-এর প্রস্থ — সেটা
                   * রাখলে ঠিক আগের সমস্যাটাই grid-এ ফিরে আসত।
                   *
                   * অনুপাতগুলো Figma-র (79/134/64/142/64) নয়, বাস্তব
                   * ডেটার প্রয়োজন অনুযায়ী (100/125/62/190/82) —
                   * designer মেপেছেন তাঁর নমুনা লেখা দিয়ে ("Jul 3,
                   * 2026", "Evening (02-10 PM)"), আমাদের সবচেয়ে চওড়া
                   * মানগুলো তার চেয়ে বড় ("Aug 31, 2026",
                   * "+8801303660451", "Afternoon (10 AM-06 PM)")।
                   * অনুপাতের **ভাবটা** এক — Role সবচেয়ে সরু, Shift
                   * সবচেয়ে চওড়া — শুধু মাপগুলো সত্যিকারের লেখার।
                   *
                   * সরু xl পর্দায় জায়গা কম পড়লে সবচেয়ে লম্বা মানটা
                   * (Shift) ellipsis-এ কাটে — কিন্তু সব সারিতে একই
                   * জায়গায় কাটে, তাই সারিবদ্ধতা তখনও অটুট।
                   *
                   * xl-এর নিচে আগের মতোই দুই/তিন কলামের grid — সেখানে
                   * সারি ভেঙে যায়, তাই অনুপাত অর্থহীন।
                   */}
                  {/**
                   * xl-এর নিচে: দ্বিতীয় সারি, দুই কলাম জুড়েই।
                   *
                   * ⚠️ ৫৬০–১২৭৯px-এ কলাম তিনটে, কিন্তু **সমান নয়** —
                   * `1fr 1fr auto`। তৃতীয়টা তার লেখাটুকুর মাপ নেয় আর
                   * ডান কিনারায় গিয়ে বসে।
                   *
                   * সমান তিন ভাগ করলে তৃতীয় ঘরটা ~২৬০px চওড়া হতো,
                   * অথচ ভেতরে "Waiter" — মাত্র ~৫০px। ফলে "Role"
                   * শিরোনাম আর মানটার মাঝে বিশাল ফাঁক পড়ত। Figma-তে
                   * সারিটা (Frame 2147236671) `space-between`, অর্থাৎ
                   * ঘরগুলো নিজের লেখাটুকুই নেয় আর বাড়তি জায়গাটা
                   * ওদের **মাঝে** যায়, ভেতরে নয়। `auto` সেটাই করে।
                   */}
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
                     * ⚠️ তৃতীয় কলামটা ট্যাবলেটে **ডান-ঘেঁষা**।
                     *
                     * তিনটে সমান কলামে Role-এর ঘরটা কার্ডের ডান কিনারা
                     * পর্যন্ত যায়, কিন্তু ভেতরের লেখাটা ("Waiter") ছোট,
                     * তাই বাঁ দিকে বসে আর ডানে একটা বড় ফাঁক পড়ে থাকে।
                     * Figma-তে ওই লেখাটা উপরের "View" বোতামের ডান
                     * কিনারার সাথে মেলে — একটা খাড়া রেখা তৈরি হয়, আর
                     * সেটাই কার্ডটাকে গোছানো দেখায়।
                     *
                     * ⚠️ ভেতরে `text-right` — ঘরটা এখন `auto` চওড়া
                     * (উপরের grid-এর মন্তব্য), অর্থাৎ "Role" শিরোনামের
                     * মাপেই দাঁড়ায়। "Waiter" তার চেয়ে সরু, তাই ডানে
                     * ঠেলে দিলে সেটা শিরোনামের ডান কিনারার সাথে মেলে —
                     * আর সেই কিনারাটাই উপরের "View" বোতামের কিনারা।
                     *
                     * xl থেকে সারিটা একটা টেবিল হয়ে যায় আর সব কলাম
                     * বাঁ-ঘেঁষা, তাই সেখানে `text-left`-এ ফেরানো।
                     */}
                    <InfoField
                      className="min-[560px]:text-right xl:text-left"
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

                  {/* Figma-র Edit (সাদা outline pill) + View (gradient
                      pill)। Deactivate/Reactivate আর এখানে নেই — সেটা
                      সরে গেছে View পাতায়; কারণ StaffRowActions.tsx-এ। */}
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