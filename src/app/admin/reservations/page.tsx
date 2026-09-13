import { type ReactNode } from "react";
import { Calendar, CalendarCheck, CalendarDays, CalendarX, Users } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import {
  DEFAULT_OVERVIEW_RANGE,
  isSummaryRange,
  summaryRangeStart,
  type SummaryRange,
} from "@/lib/payment-filters";
import {
  DEFAULT_RESERVATION_STATUS,
  isReservationStatus,
  type ReservationStatusFilter,
} from "@/lib/reservation-filters";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import ReservationsToolbar from "./ReservationsToolbar";
import ReservationRangeMenu from "./ReservationRangeMenu";
import ReservationStatusSelect from "./ReservationStatusSelect";

export const metadata = { title: "Reservations" };

/**
 * প্রতি পাতায় কতগুলো বুকিং।
 *
 * ⚠️ ১০ থেকে ৫-এ নামানো হয়েছে, Payment পাতার Recent Transactions-এর
 * সাথে মিলিয়ে। সারিগুলো এখন লম্বা (অবতার, তিনটে pill, ব্যাজ), তাই
 * দশটা সারিতে তালিকাটা পর্দার অনেক নিচে চলে যেত আর pagination
 * বোতামগুলো খুঁজে বের করতে scroll করতে হতো।
 */
const PAGE_SIZE = 5;

/**
 * /admin/reservations — Figma "Reservations" পাতা।
 *
 *   Welcome header + তারিখ + Export Report
 *   খোঁজার ঘর + "All Statuses"
 *   Overview: Total Reservation · Confirmed · Cancelled
 *   Reservations: সারির তালিকা + পাতা বদল
 *
 * ⚠️ গড়নটা /admin/payment-এর হুবহু — একই header, একই toolbar, একই
 * cream কার্ড, একই `Field` লেবেল। দুটো পাতা আলাদা দেখালে staff-কে
 * দুটো আলাদা অভ্যাস শিখতে হতো, আর কোডও দুবার লিখতে হতো।
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    overview?: string;
    list?: string;
  }>;
}) {
  // layout.tsx-ও guard করে; এখানে session-টা কেবল নাম দেখানোর জন্য।
  const session = await requireStaff("reservations");
  const params = await searchParams;

  const q = params.q?.trim();
  const status: ReservationStatusFilter = isReservationStatus(params.status)
    ? params.status
    : DEFAULT_RESERVATION_STATUS;
  const overviewRange: SummaryRange = isSummaryRange(params.overview)
    ? params.overview
    : DEFAULT_OVERVIEW_RANGE;
  const listRange: SummaryRange = isSummaryRange(params.list)
    ? params.list
    : DEFAULT_OVERVIEW_RANGE;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const now = new Date();

  /**
   * ⚠️ সময় মাপা হয় `reservedAt` দিয়ে, `createdAt` দিয়ে নয়।
   *
   * "আজকের বুকিং" মানে আজ যাদের আসার কথা, আজ যারা বুক করেছে তারা নয় —
   * রেস্তোরাঁর কাছে প্রথমটাই কাজের প্রশ্ন। পরের সপ্তাহের একটা বুকিং আজ
   * করা হলে সেটা আজকের তালিকায় থাকা মানে staff-কে বিভ্রান্ত করা।
   */
  const listStart = summaryRangeStart(listRange);
  const overviewStart = summaryRangeStart(overviewRange);

  const where: Prisma.ReservationWhereInput = {
    ...(status !== "ALL"
      ? { status: status as Prisma.ReservationWhereInput["status"] }
      : {}),
    ...(listStart ? { reservedAt: { gte: listStart } } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            // ⚠️ email-ও খোঁজা হয়: ফোন নম্বর অনেক সময় দুই ফরম্যাটে
            // সংরক্ষিত থাকে (+880… আর 01…), তাই email প্রায়ই বেশি
            // নির্ভরযোগ্য শনাক্তকারী।
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const overviewWhere: Prisma.ReservationWhereInput = overviewStart
    ? { reservedAt: { gte: overviewStart } }
    : {};

  const [reservations, totalCount, totalReservations, confirmedCount, cancelledCount] =
    await Promise.all([
      prisma.reservation.findMany({
        where,
        // ⚠️ সবচেয়ে কাছের বুকিং আগে — অতীতের নয়, ভবিষ্যতের কাজটাই
        // staff-এর সামনে থাকা দরকার।
        orderBy: { reservedAt: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerName: true,
          phone: true,
          email: true,
          guestCount: true,
          reservedAt: true,
          status: true,
          table: { select: { label: true } },
          user: { select: { image: true } },
        },
      }),
      prisma.reservation.count({ where }),
      prisma.reservation.count({ where: overviewWhere }),
      prisma.reservation.count({
        // "Confirmed" মানে নিশ্চিত হওয়া সব বুকিং — বসে যাওয়া আর শেষ
        // হওয়াগুলোও। ওগুলোও একসময় CONFIRMED ছিল, শুধু এগিয়ে গেছে।
        where: { ...overviewWhere, status: { in: ["CONFIRMED", "SEATED", "COMPLETED"] } },
      }),
      prisma.reservation.count({
        // NO_SHOW-ও এখানে: রেস্তোরাঁর দিক থেকে টেবিলটা খালিই গেছে।
        where: { ...overviewWhere, status: { in: ["CANCELLED", "NO_SHOW"] } },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + reservations.length;

  return (
    <div className="space-y-4">
      {/* --- Welcome header --- */}
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
            {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>

          {/* ⚠️ `page` forward হয় না: export মানে পুরো ছাঁকা তালিকা,
              পর্দার দশটা সারি নয়। */}
          <ExportReportButton
            endpoint="/api/admin/reservations/export"
            forwardParams={["q", "status", "list"]}
            fallbackFilename="cuisine-reservations.csv"
          />
        </div>
      </div>

      <ReservationsToolbar status={status} />

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Overview
          </h2>
          <ReservationRangeMenu value={overviewRange} param="overview" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total Reservation"
            value={String(totalReservations)}
            hint={overviewStart ? "Reservations in this period" : "All reservations"}
            icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="Confirmed"
            value={String(confirmedCount)}
            hint="Successfully confirmed"
            icon={
              <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            }
          />
          <StatCard
            label="Cancelled"
            value={String(cancelledCount)}
            hint="Cancelled or no-show"
            icon={<CalendarX className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      {/* --- Reservations list --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Reservations
          </h2>
          <ReservationRangeMenu value={listRange} param="list" />
        </div>

        {reservations.length === 0 ? (
          <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
            No reservations match that search or filter.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[640px]:grid-cols-3 xl:min-h-[94px] xl:grid-cols-[minmax(0,1.6fr)_132px_112px_minmax(0,160px)_150px] xl:gap-x-6"
              >
                {/* Figma: বাঁয়ে অবতার, পাশে নাম আর ফোন। */}
                <div className="col-span-2 flex min-w-0 items-center gap-3 min-[640px]:col-span-1">
                  <Avatar name={reservation.customerName} image={reservation.user?.image} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="truncate font-frank-ruhl text-[15px] font-medium leading-none text-black md:text-[16px]">
                      {reservation.customerName}
                    </span>
                    <span className="truncate font-sora text-[12px] leading-none text-black/70">
                      {reservation.phone}
                    </span>
                  </div>
                </div>

                {/* Figma "Fill": সাদা pill, radius 100, ভেতরে আইকন + লেখা। */}
                <Pill
                  icon={
                    <TableIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  }
                  label={`Table ${reservation.table.label}`}
                />
                <Pill
                  icon={<Users className="h-4 w-4 shrink-0" strokeWidth={1.2} aria-hidden="true" />}
                  label={`${reservation.guestCount} ${
                    reservation.guestCount === 1 ? "guest" : "guests"
                  }`}
                />
                <Pill
                  icon={
                    <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.2} aria-hidden="true" />
                  }
                  label={reservation.reservedAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                />

                <div className="col-span-2 min-[640px]:col-span-1 xl:justify-self-end">
                  <ReservationStatusSelect
                    reservationId={reservation.id}
                    currentStatus={reservation.status}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {totalCount > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <span className="font-sora text-[12px] leading-none text-black/70 min-[480px]:text-[14px]">
              Showing {firstRow}–{lastRow} of {totalCount}{" "}
              {totalCount === 1 ? "reservation" : "reservations"}
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={params}
              basePath="/admin/reservations"
            />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Figma "Card": cream, radius 16, padding 16, gap 20।
 *
 * ⚠️ Payment পাতার StatCard-এর মতোই, কিন্তু growth ব্যাজ ছাড়া। বুকিংয়ের
 * সংখ্যায় সপ্তাহ-ভিত্তিক শতাংশ দেখানো যেত, তবে Figma-তে নেই — আর
 * বুকিং ঋতু আর ছুটির উপর এত নির্ভরশীল যে গত সপ্তাহের সাথে তুলনা
 * প্রায়ই অর্থহীন সংখ্যা দিত।
 */
function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-h-[142px] flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">
          {value}
        </span>
        <span className="font-sora text-[12px] leading-none text-black/70">{hint}</span>
      </div>
    </div>
  );
}

/** Figma-র সাদা pill: radius 100, padding 13/12, আইকন + 12px লেখা। */
function Pill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex h-[42px] min-w-0 items-center justify-center gap-1 rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * গ্রাহকের ছবি, নাহলে নামের প্রথম অক্ষর।
 *
 * ⚠️ `<img>` নয়, শুধু background — অতিথি বুকিংয়ে কোনো অ্যাকাউন্ট নেই,
 * তাই ছবিও নেই, আর ভাঙা ছবির আইকনের চেয়ে অক্ষরটা ভালো। ছবি থাকলে
 * next/image ব্যবহার না করার কারণ: এগুলো Google-এর অবতার URL, যা
 * remotePatterns-এ নেই।
 */
function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return (
      <span
        aria-hidden="true"
        style={{ backgroundImage: `url(${image})` }}
        className="h-11 w-11 shrink-0 rounded-full bg-[#FF9540] bg-cover bg-center"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF9540] font-sora text-[16px] font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** vuesax/linear/table — lucide-তে নেই, তাই হাতে আঁকা। */
function TableIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="19" height="17" rx="3" />
      <path d="M2.5 9.5h19M9 9.5v11M2.5 15h19" />
    </svg>
  );
}
