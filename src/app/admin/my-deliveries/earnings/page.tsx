import Link from "next/link";
import { ArrowRight, CircleDollarSign, WalletCards, CalendarCheck2, Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { daysAgo, startOfToday } from "@/lib/rider-panel";
import { roundMoney, sevenDayTotals } from "@/lib/rider-stats";
import { getRiderBalance, payoutWhere } from "@/lib/rider-payouts";
import { PAYOUT_STATUS_OPTIONS, isPayoutStatusFilter, methodLabel, type PayoutStatusFilter } from "@/lib/payout-methods";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import RangeFilter from "../RangeFilter";
import SearchBox from "../SearchBox";
import UrlSelect from "../UrlSelect";
import { EmptyNote, PayoutChip, RiderOverviewCard, RiderPageHeader } from "../rider-ui";
import EarningsChart, { type ChartDay } from "./EarningsChart";

export const metadata = { title: "Earnings" };

const ICON = "h-[18px] w-[18px]";
const PER_PAGE = 5;

const CHART_OPTIONS = [
  { value: "week", label: "This Week" },
  { value: "last", label: "Last Week" },
] as const;
type ChartWeek = (typeof CHART_OPTIONS)[number]["value"];

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/**
 * Rider panel → Payout → Earnings (Figma):
 *
 *   Welcome Back                             [date] [Export Report]
 *   search payouts · All Statuses ⌄
 *   Overview   Available Balance · This Week · Last Payout · Total Earnings
 *   Total Earning chart [This Week ⌄]   |   Payout History [All Time ⌄]
 *
 * Earning per delivery = delivery fee + tip. The balance is what's earned
 * minus what was paid out or is waiting for the owner (lib/rider-payouts).
 * "This Week" = the last 7 days including today — the same days the
 * chart's "This Week" draws.
 */
export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string; list?: string; q?: string; status?: string; page?: string }>;
}) {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const params = await searchParams;
  const chartWeek: ChartWeek = params.chart === "last" ? "last" : "week";
  const listRange: DashboardPeriod = isDashboardPeriod(params.list) ? params.list : "all";
  const status: PayoutStatusFilter = isPayoutStatusFilter(params.status) ? params.status : "ALL";
  const q = params.q?.trim() || undefined;

  const settings = await getRestaurantSettings(); // restaurant time zone for "today"
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();

  // Weeks: this = today and the 6 days before; last = the 7 before that;
  // the chart's grey pills are one more week back.
  const thisWeekStart = daysAgo(startOfToday(now), 6);
  const lastWeekStart = daysAgo(thisWeekStart, 7);
  const shownStart = chartWeek === "week" ? thisWeekStart : lastWeekStart;
  const compareStart = daysAgo(shownStart, 7);

  const listWhere = payoutWhere(riderId, { q, status, from: periodStart(listRange, now) });
  const [balance, recent, lastPaid, payoutCount] = await Promise.all([
    getRiderBalance(riderId),
    prisma.deliveryTracking.findMany({
      where: { riderId, deliveredAt: { gte: daysAgo(thisWeekStart, 14) }, order: { status: "DELIVERED" } },
      select: { deliveredAt: true, order: { select: { deliveryFee: true, tipAmount: true } } },
    }),
    prisma.riderPayout.findFirst({
      where: { riderId, status: "PAID" },
      orderBy: { processedAt: "desc" },
      select: { amount: true, processedAt: true, requestedAt: true },
    }),
    prisma.riderPayout.count({ where: listWhere }),
  ]);

  const rows = recent.flatMap((row) => (row.deliveredAt ? [{ deliveredAt: row.deliveredAt, ...row.order }] : []));
  const thisWeek = sevenDayTotals(rows, thisWeekStart);
  const shown = sevenDayTotals(rows, shownStart);
  const compare = sevenDayTotals(rows, compareStart);
  const weekTotal = roundMoney(thisWeek.reduce((sum, d) => sum + d.total, 0));
  const weekDeliveries = thisWeek.reduce((sum, d) => sum + d.deliveries, 0);
  const shownTotal = roundMoney(shown.reduce((sum, d) => sum + d.total, 0));

  const chartDays: ChartDay[] = shown.map((d, index) => ({
    day: d.date.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.date.toLocaleDateString("en-US", SHORT_DATE),
    value: d.total,
    valueText: money(d.total),
    deliveries: d.deliveries,
    previous: compare[index].total,
    previousText: money(compare[index].total),
  }));

  const totalPages = Math.max(1, Math.ceil(payoutCount / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const payouts = await prisma.riderPayout.findMany({
    where: listWhere,
    orderBy: { requestedAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: { id: true, amount: true, currency: true, method: true, destination: true, status: true, requestedAt: true, note: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={now}
        actions={
          <ExportReportButton
            endpoint="/api/rider/payouts/export"
            forwardParams={["list", "q", "status"]}
            fallbackFilename="my-earnings.csv"
          />
        }
      />

      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-6">
        <SearchBox placeholder="Search payouts by amount, bank or wallet..." />
        <UrlSelect
          param="status"
          value={status}
          defaultValue="ALL"
          options={PAYOUT_STATUS_OPTIONS}
          ariaLabel="Payout status"
          surface="white"
        />
      </div>

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">Overview</h2>
        <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          <RiderOverviewCard
            label="Available Balance"
            value={money(balance.available)}
            hint={
              balance.available > 0 ? (
                <Link
                  href="/admin/my-deliveries/cash-out"
                  className="inline-flex items-center gap-1 font-semibold text-[#FF7100] underline-offset-2 hover:underline"
                >
                  Ready to cash out <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : balance.pending > 0 ? (
                `${money(balance.pending)} waiting for approval`
              ) : (
                "Nothing to cash out yet"
              )
            }
            icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderOverviewCard
            label="This Week"
            value={money(weekTotal)}
            hint={`${weekDeliveries} ${weekDeliveries === 1 ? "delivery" : "deliveries"}`}
            icon={<CalendarCheck2 className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderOverviewCard
            label="Last Payout"
            value={lastPaid ? money(lastPaid.amount.toNumber()) : "—"}
            hint={
              lastPaid
                ? (lastPaid.processedAt ?? lastPaid.requestedAt).toLocaleDateString("en-US", SHORT_DATE)
                : "No payouts yet"
            }
            icon={<WalletCards className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderOverviewCard
            label="Total Earnings"
            value={money(balance.earned)}
            hint={`Since joining · ${balance.deliveries} ${balance.deliveries === 1 ? "delivery" : "deliveries"}`}
            icon={<Coins className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* --- Total Earning chart --- */}
        <section className="flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-3">
              <span className="font-sora text-[14px] leading-none text-black/70 md:text-[16px]">Total Earning</span>
              <span className="font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[28px]">
                {money(shownTotal)}
              </span>
            </div>
            <UrlSelect param="chart" value={chartWeek} defaultValue="week" options={CHART_OPTIONS} ariaLabel="Chart week" />
          </div>
          <EarningsChart
            days={chartDays}
            initialIndex={6}
            currentLabel={chartWeek === "week" ? "This week" : "Last week"}
            previousLabel={chartWeek === "week" ? "Last week" : "Week before"}
          />
        </section>

        {/* --- Payout History --- */}
        <section className="flex min-w-0 flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">Payout History</h2>
            <RangeFilter value={listRange} defaultValue="all" param="list" />
          </div>

          {payouts.length === 0 ? (
            <EmptyNote>
              {q || status !== "ALL"
                ? "No payouts match your search."
                : listRange === "all"
                  ? "No payouts yet — when you cash out, the request shows up here until the restaurant pays it."
                  : "No payouts in this period."}
            </EmptyNote>
          ) : (
            <ul className="flex flex-col gap-3">
              {payouts.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between"
                >
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black md:text-[18px]">
                      {p.requestedAt.toLocaleDateString("en-US", SHORT_DATE)}
                    </span>
                    <span className="break-words font-sora text-[11px] leading-[1.5] text-black/70 md:text-[12px]">
                      {methodLabel(p.method)} · {p.destination}
                    </span>
                    {p.status === "REJECTED" && p.note && (
                      <span className="font-sora text-[11px] leading-[1.5] text-[#FF3F5C]">Reason: {p.note}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center justify-between gap-4 min-[480px]:justify-end">
                    <span className="min-w-[80px] whitespace-nowrap text-right font-frank-ruhl text-[16px] font-medium leading-none tabular-nums text-black">
                      {formatAmount(p.amount.toNumber(), p.currency)}
                    </span>
                    <PayoutChip status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={{ chart: params.chart, list: params.list, q, status: params.status }}
              basePath="/admin/my-deliveries/earnings"
            />
          )}

          <p className="font-sora text-[12px] leading-[1.6] text-black/55">
            Cash-outs are paid by the restaurant, usually within 1–2 business days. Cash you collected from customers is
            separate — see Cash Collected.
          </p>
        </section>
      </div>
    </div>
  );
}