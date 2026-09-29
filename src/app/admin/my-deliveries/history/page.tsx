import { CircleCheck, CircleDollarSign, Star } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { RIDER_DELIVERY_SELECT, finishedWhere, toRiderDelivery } from "@/lib/rider-panel";
import { averageRating, deliveryMinutes, formatMinutes, sumEarnings } from "@/lib/rider-stats";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import RangeFilter from "../RangeFilter";
import SearchBox from "../SearchBox";
import { EmptyNote, RiderPageHeader } from "../rider-ui";
import StatusFilter, { type HistoryStatus } from "./StatusFilter";

export const metadata = { title: "Delivery History" };

const PER_PAGE = 10;
const ICON = "h-[18px] w-[18px]";

const PERIOD_HINT: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};
const EARNINGS_LABEL: Record<DashboardPeriod, string> = {
  today: "Today's Earnings",
  week: "This Week's Earnings",
  month: "This Month's Earnings",
  all: "Total Earnings",
};

function isHistoryStatus(value: string | undefined): value is HistoryStatus {
  return value === "ALL" || value === "DELIVERED" || value === "CANCELLED";
}

/**
 * Rider panel → Delivery History (Figma):
 *
 *   Welcome Back                                   [date] [Export Report]
 *   search (customer, order ID) · All Statuses ⌄
 *   Overview [Today ⌄]     Total Deliveries · Avg. Rating · Today's Earnings
 *   Completed Deliveries [All Time ⌄]
 *     Order ID · Delivery Time · Rating · Date & Time · Address     $7.20
 *   Showing 1–10 of N Orders                          ‹ 1 2 3 … 6 ›
 *
 * Overview and the list have their own period (`?range=` and `?list=`).
 * The list starts on "All Time" so a rider's past deliveries are always
 * there when they open the page; the Overview starts on Today (Figma).
 * Earnings = delivery fee + tip (lib/rider-stats.ts).
 */
export default async function DeliveryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; list?: string; q?: string; status?: string; page?: string }>;
}) {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const params = await searchParams;
  const overviewRange: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "today";
  const listRange: DashboardPeriod = isDashboardPeriod(params.list) ? params.list : "all";
  const status: HistoryStatus = isHistoryStatus(params.status) ? params.status : "ALL";
  const q = params.q?.trim() || undefined;

  // Restaurant time zone for "today" (getRestaurantSettings sets it).
  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();

  // --- Overview: delivered orders in the overview period ---
  const overviewStart = periodStart(overviewRange, now);
  const overviewRows = await prisma.deliveryTracking.findMany({
    where: {
      riderId,
      deliveredAt: { not: null, ...(overviewStart ? { gte: overviewStart } : {}) },
      order: { status: "DELIVERED" },
    },
    select: { riderRating: true, order: { select: { deliveryFee: true, tipAmount: true } } },
  });
  const periodRatings = overviewRows.flatMap((row) => (row.riderRating ? [row.riderRating] : []));
  // No ratings in a short period (today) → the rider's overall rating, so
  // the card isn't blank every morning.
  const allRatings =
    periodRatings.length > 0
      ? null
      : await prisma.deliveryTracking.aggregate({
          where: { riderId, riderRating: { not: null } },
          _avg: { riderRating: true },
          _count: { riderRating: true },
        });
  const rating = periodRatings.length > 0 ? averageRating(periodRatings) : (allRatings?._avg.riderRating ?? null);
  const ratingHint =
    periodRatings.length > 0
      ? `From ${periodRatings.length} customer ${periodRatings.length === 1 ? "rating" : "ratings"}`
      : allRatings && allRatings._count.riderRating > 0
        ? `All time · ${allRatings._count.riderRating} ${allRatings._count.riderRating === 1 ? "rating" : "ratings"}`
        : "No ratings yet";

  // --- Completed Deliveries list ---
  const search = orderSearchFilter(q);
  const statusWhere: Prisma.DeliveryTrackingWhereInput[] =
    status === "DELIVERED"
      ? [{ order: { status: "DELIVERED" } }]
      : status === "CANCELLED"
        ? [{ order: { status: "CANCELLED" } }]
        : [];
  const where: Prisma.DeliveryTrackingWhereInput = {
    ...finishedWhere(riderId, periodStart(listRange, now)),
    AND: [...(search ? [{ order: search }] : []), ...statusWhere],
  };
  const total = await prisma.deliveryTracking.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const rows = (
    await prisma.deliveryTracking.findMany({
      where,
      orderBy: { assignedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: RIDER_DELIVERY_SELECT,
    })
  ).map(toRiderDelivery);
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const last = Math.min(page * PER_PAGE, total);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={now}
        actions={
          <ExportReportButton
            endpoint="/api/rider/export"
            forwardParams={["list", "q", "status"]}
            fallbackFilename="my-deliveries.csv"
          />
        }
      />

      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-6">
        <SearchBox placeholder="Search by customer name, order ID..." />
        <StatusFilter value={status} />
      </div>

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">Overview</h2>
          <RangeFilter value={overviewRange} defaultValue="today" param="range" keepPage />
        </div>
        <div className="grid gap-5 min-[640px]:grid-cols-3">
          <OverviewCard
            label="Total Deliveries"
            value={String(overviewRows.length)}
            hint={PERIOD_HINT[overviewRange]}
            icon={<CircleCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="Avg. Rating"
            value={rating === null ? "—" : rating.toFixed(1)}
            hint={ratingHint}
            icon={<Star className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label={EARNINGS_LABEL[overviewRange]}
            value={money(sumEarnings(overviewRows.map((row) => row.order)))}
            hint={`${PERIOD_HINT[overviewRange]} · fees + tips`}
            icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      {/* --- Completed Deliveries --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Completed Deliveries
          </h2>
          <RangeFilter value={listRange} defaultValue="all" param="list" />
        </div>

        {rows.length === 0 ? (
          <EmptyNote>
            {q
              ? `Nothing matches “${q}”.`
              : listRange === "all"
                ? "No finished deliveries yet — they show up here once you mark an order delivered."
                : "No finished deliveries in this period."}
          </EmptyNote>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((d) => {
              const minutes = d.deliveredAt
                ? Math.round(deliveryMinutes({ assignedAt: d.assignedAt, pickedUpAt: d.pickedUpAt, deliveredAt: d.deliveredAt }))
                : null;
              const finishedAt = d.deliveredAt ?? d.cancelledAt;
              const cancelled = d.status === "CANCELLED";
              return (
                <li
                  key={d.orderId}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 md:flex-row md:items-center md:justify-between md:gap-6"
                >
                  <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 min-[560px]:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,1.4fr)]">
                    <Cell label="Order ID" value={formatOrderId(d.orderId)} />
                    <Cell label="Delivery Time" value={cancelled ? "—" : minutes !== null ? formatMinutes(minutes) : "—"} />
                    <div className="flex min-w-0 flex-col gap-2.5 md:gap-[19px]">
                      <dt className="font-sora text-[12px] leading-none text-black/70 md:text-[14px]">Rating</dt>
                      <dd className="flex items-center gap-1 font-frank-ruhl text-[15px] font-medium leading-none text-black md:text-[16px]">
                        {d.rating !== null ? (
                          <>
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FFC107" aria-hidden="true">
                              <path d="M12 2.5l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.33l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.5Z" />
                            </svg>
                            {d.rating.toFixed(1)}
                          </>
                        ) : (
                          <span className="text-black/45">Not rated</span>
                        )}
                      </dd>
                    </div>
                    <Cell
                      label="Date & Time"
                      value={
                        finishedAt
                          ? finishedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                          : "—"
                      }
                    />
                    <Cell label="Address" value={d.area} className="col-span-2 min-[560px]:col-span-2 lg:col-span-1" />
                  </dl>
                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] pt-3 md:w-[96px] md:justify-end md:border-0 md:pt-0">
                    <span className="font-sora text-[12px] text-black/60 md:hidden">
                      {cancelled ? "Cancelled" : "You earned"}
                    </span>
                    {cancelled ? (
                      <span className="inline-flex h-8 items-center rounded-full bg-[#FFE9EC] px-3 font-sora text-[12px] text-[#FF3F5C]">
                        Cancelled
                      </span>
                    ) : (
                      <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black">
                        {formatAmount(d.earning, d.currency)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {total > 0 && (
          <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
            <p className="flex items-center gap-2 font-sora text-[12px] text-black/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#FF9540]" />
              Showing{" "}
              <strong className="font-semibold text-black">
                {first}–{last}
              </strong>{" "}
              of <strong className="font-semibold text-black">{total}</strong> {total === 1 ? "Order" : "Orders"}
            </p>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={{ range: params.range, list: params.list, q, status: params.status }}
              basePath="/admin/my-deliveries/history"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-h-[142px] min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">{icon}</span>
      </div>
      <div className="flex flex-col gap-3">
        <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">{value}</span>
        <span className="font-sora text-[12px] leading-[1.3] text-black/70">{hint}</span>
      </div>
    </div>
  );
}

function Cell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2.5 md:gap-[19px] ${className}`}>
      <dt className="font-sora text-[12px] leading-none text-black/70 md:text-[14px]">{label}</dt>
      <dd className="break-words font-frank-ruhl text-[15px] font-medium leading-[1.2] text-black md:truncate md:text-[16px] md:leading-none" title={value}>
        {value}
      </dd>
    </div>
  );
}
