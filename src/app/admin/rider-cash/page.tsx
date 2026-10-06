import { Banknote, CheckCircle2, Hourglass } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { periodStart } from "@/lib/dashboard-period";
import { getRiderCashSummaries } from "@/lib/rider-cash";
import Pagination from "@/app/admin/orders/Pagination";
import UrlSelect from "@/app/admin/my-deliveries/UrlSelect";
import {
  EmptyNote,
  PayoutChip,
  RiderOverviewCard,
  RiderPageHeader,
} from "@/app/admin/my-deliveries/rider-ui";
import CashRequestActions from "./CashRequestActions";
import RecordCashButton from "./RecordCashButton";

export const metadata = { title: "Rider Cash" };

const PER_PAGE = 10;
const ICON = "h-[18px] w-[18px]";
const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Waiting" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
const isStatusFilter = (value: unknown): value is StatusFilter => STATUS_OPTIONS.some((option) => option.value === value);

/** "today" / "1 day" / "4 days" — how long cash has been out. */
function ageLabel(since: Date, now: Date): string {
  const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
  if (days <= 0) return "since today";
  return `for ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Admin → Rider Cash (owner): the cash-on-delivery money riders hold for the
 * restaurant, and their hand-in reports.
 *
 * Mirror of Rider Payouts (money going OUT to riders): this is money coming
 * BACK. A rider reports a hand-in → "Confirm Received" once the cash is
 * really in hand, or "Dispute" with a reason. The owner can also "Record
 * cash" directly when the rider hands it over without reporting first.
 * Either way both sides end up with the same dated record.
 */
export default async function RiderCashPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status: StatusFilter = isStatusFilter(params.status) ? params.status : "ALL";

  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();
  const monthStart = periodStart("month", now);

  const where = status === "ALL" ? {} : { status };
  const [summaries, waiting, receivedMonth, total] = await Promise.all([
    getRiderCashSummaries(),
    prisma.cashRemittance.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.cashRemittance.aggregate({
      where: { status: "CONFIRMED", ...(monthStart ? { decidedAt: { gte: monthStart } } : {}) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.cashRemittance.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const rows = await prisma.cashRemittance.findMany({
    where,
    // PENDING is declared first in the enum, so waiting reports lead.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      amount: true,
      currency: true,
      source: true,
      status: true,
      riderNote: true,
      adminNote: true,
      createdAt: true,
      decidedAt: true,
      rider: { select: { name: true, email: true } },
    },
  });

  const holding = summaries.filter((s) => s.owed > 0.004);
  const withRiders = holding.reduce((sum, s) => sum + s.owed, 0);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        title="Rider Cash"
        subtitle="Cash riders collected from customers belongs to the restaurant. Confirm what they hand in, so both sides have the same record."
        now={now}
      />

      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">Overview</h2>
        <div className="grid gap-4 min-[640px]:grid-cols-3">
          <RiderOverviewCard
            label="Cash with Riders"
            value={money(withRiders)}
            hint={`${holding.length} ${holding.length === 1 ? "rider" : "riders"} holding cash`}
            icon={<Banknote className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderOverviewCard
            label="Waiting to Confirm"
            value={money(waiting._sum.amount?.toNumber() ?? 0)}
            hint={`${waiting._count._all} ${waiting._count._all === 1 ? "report" : "reports"}`}
            icon={<Hourglass className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderOverviewCard
            label="Received This Month"
            value={money(receivedMonth._sum.amount?.toNumber() ?? 0)}
            hint={`${receivedMonth._count._all} ${receivedMonth._count._all === 1 ? "hand-in" : "hand-ins"}`}
            icon={<CheckCircle2 className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Cash with Riders
        </h2>
        {holding.length === 0 ? (
          <EmptyNote>No rider is holding restaurant cash right now.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {holding.map((rider) => (
              <li
                key={rider.riderId}
                className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate font-frank-ruhl text-[18px] font-medium leading-none text-black">
                    {rider.name}
                  </span>
                  <span className="font-sora text-[12px] text-black/70">
                    {rider.cashOrders} cash {rider.cashOrders === 1 ? "order" : "orders"} · collected{" "}
                    {money(rider.collected)} · handed in {money(rider.confirmed)}
                    {rider.oldestOwedSince ? ` · oldest cash out ${ageLabel(rider.oldestOwedSince, now)}` : ""}
                  </span>
                  {rider.pending > 0 && (
                    <span className="font-sora text-[11px] text-[#C77C00]">
                      {money(rider.pending)} reported as handed in — confirm it below
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 min-[640px]:justify-end">
                  <span className="min-w-[96px] whitespace-nowrap text-right font-frank-ruhl text-[20px] font-semibold leading-none tabular-nums text-black">
                    {money(rider.owed)}
                  </span>
                  <RecordCashButton
                    riderId={rider.riderId}
                    riderName={rider.name}
                    max={rider.inHand}
                    currency={settings.currency}
                    minorUnits={settings.currencyMinorUnits}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Hand-In Reports
          </h2>
          <UrlSelect
            param="status"
            value={status}
            defaultValue="ALL"
            options={STATUS_OPTIONS}
            ariaLabel="Status"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyNote>
            {status === "ALL"
              ? "No hand-ins yet. Riders report them from their Cash Collected page, or you can record cash above."
              : "Nothing here."}
          </EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const amount = formatAmount(row.amount.toNumber(), row.currency);
              const riderName = row.rider.name || row.rider.email || "Rider";
              return (
                <li
                  key={row.id}
                  className="grid gap-x-6 gap-y-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_230px_260px] xl:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate font-frank-ruhl text-[18px] font-medium leading-none text-black">
                      {riderName}
                    </span>
                    <span className="truncate font-sora text-[12px] text-black/70">{row.rider.email ?? ""}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-sora text-[12px] text-black/70">
                      {row.source === "ADMIN" ? "Recorded by you" : "Reported by rider"} ·{" "}
                      {row.createdAt.toLocaleString("en-US", DATE_TIME)}
                    </span>
                    {row.riderNote && (
                      <span className="break-words font-sora text-[13px] text-black">&ldquo;{row.riderNote}&rdquo;</span>
                    )}
                    {row.decidedAt && row.status !== "CANCELLED" && (
                      <span className="font-sora text-[11px] text-black/60">
                        {row.status === "CONFIRMED" ? "Confirmed" : "Disputed"}{" "}
                        {row.decidedAt.toLocaleString("en-US", DATE_TIME)}
                        {row.adminNote ? ` · ${row.adminNote}` : ""}
                      </span>
                    )}
                    {row.status === "CANCELLED" && (
                      <span className="font-sora text-[11px] text-black/60">Cancelled by the rider</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 xl:justify-end">
                    <span className="min-w-[96px] whitespace-nowrap text-right font-frank-ruhl text-[20px] font-semibold leading-none tabular-nums text-black">
                      {amount}
                    </span>
                    <PayoutChip status={row.status} />
                  </div>
                  <div className="min-[560px]:justify-self-end">
                    {row.status === "PENDING" && <CashRequestActions id={row.id} amount={amount} rider={riderName} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={{ status: params.status }}
            basePath="/admin/rider-cash"
          />
        )}
      </section>
    </div>
  );
}
