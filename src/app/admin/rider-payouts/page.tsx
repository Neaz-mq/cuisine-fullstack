import { CheckCircle2, Clock3, HandCoins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { periodStart } from "@/lib/dashboard-period";
import {
  PAYOUT_STATUS_OPTIONS,
  isPayoutStatusFilter,
  methodLabel,
  type PayoutStatusFilter,
} from "@/lib/payout-methods";
import Pagination from "@/app/admin/orders/Pagination";
// The rider panel's building blocks — same design system, one source.
import UrlSelect from "@/app/admin/my-deliveries/UrlSelect";
import {
  EmptyNote,
  PayoutChip,
  RiderOverviewCard,
  RiderPageHeader,
} from "@/app/admin/my-deliveries/rider-ui";
import PayoutActions from "./PayoutActions";

export const metadata = { title: "Rider Payouts" };

const PER_PAGE = 10;
const ICON = "h-[18px] w-[18px]";
const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Admin → Rider Payouts (owner): riders' cash-out requests.
 *
 * The app doesn't move money itself — the owner sends it by bank transfer
 * or mobile wallet to the account shown here, then presses "Mark as Paid".
 * "Reject" returns the amount to the rider's balance, with a reason.
 * Waiting requests come first.
 */
export default async function RiderPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireStaff("finance");
  const params = await searchParams;
  const status: PayoutStatusFilter = isPayoutStatusFilter(params.status)
    ? params.status
    : "ALL";

  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();
  const monthStart = periodStart("month", now);

  const where = status === "ALL" ? {} : { status };
  const [waiting, paidMonth, total] = await Promise.all([
    prisma.riderPayout.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.riderPayout.aggregate({
      where: {
        status: "PAID",
        ...(monthStart ? { processedAt: { gte: monthStart } } : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.riderPayout.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(
    totalPages,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const rows = await prisma.riderPayout.findMany({
    where,
    // PENDING is declared first in the enum, so waiting requests lead.
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      destination: true,
      payTo: true,
      status: true,
      requestedAt: true,
      processedAt: true,
      note: true,
      rider: { select: { name: true, email: true, phone: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        title="Rider Payouts"
        subtitle="Riders' cash-out requests. Send the money to the account shown, then mark it paid."
        now={now}
      />

      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <div className="grid gap-4 min-[640px]:grid-cols-3">
          <RiderOverviewCard
            label="Waiting to Pay"
            value={money(waiting._sum.amount?.toNumber() ?? 0)}
            hint={`${waiting._count._all} ${waiting._count._all === 1 ? "request" : "requests"}`}
            icon={
              <Clock3 className={ICON} strokeWidth={1.5} aria-hidden="true" />
            }
          />
          <RiderOverviewCard
            label="Paid This Month"
            value={money(paidMonth._sum.amount?.toNumber() ?? 0)}
            hint={`${paidMonth._count._all} ${paidMonth._count._all === 1 ? "payout" : "payouts"}`}
            icon={
              <CheckCircle2
                className={ICON}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            }
          />
          <RiderOverviewCard
            label="All Requests"
            value={String(total)}
            hint={
              status === "ALL"
                ? "Every status"
                : `Filtered: ${status.toLowerCase()}`
            }
            icon={
              <HandCoins
                className={ICON}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Requests
          </h2>
          <UrlSelect
            param="status"
            value={status}
            defaultValue="ALL"
            options={PAYOUT_STATUS_OPTIONS}
            ariaLabel="Status"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyNote>
            {status === "ALL"
              ? "No cash-out requests yet. Riders request them from their Cash Out page."
              : "Nothing here."}
          </EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((p) => {
              const amount = formatAmount(p.amount.toNumber(), p.currency);
              const riderName = p.rider.name || p.rider.email || "Rider";
              return (
                <li
                  key={p.id}
                  className="grid gap-x-6 gap-y-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_190px_220px] xl:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate font-frank-ruhl text-[18px] font-medium leading-none text-black">
                      {riderName}
                    </span>
                    <span className="truncate font-sora text-[12px] text-black/70">
                      {p.rider.phone ?? p.rider.email ?? ""}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-sora text-[12px] text-black/70">
                      {methodLabel(p.method)} · requested{" "}
                      {p.requestedAt.toLocaleString("en-US", DATE_TIME)}
                    </span>
                    <span className="break-words font-sora text-[13px] font-semibold text-black select-all">
                      {p.payTo ?? p.destination}
                    </span>
                    {p.processedAt && (
                      <span className="font-sora text-[11px] text-black/60">
                        {p.status === "PAID" ? "Paid" : "Rejected"}{" "}
                        {p.processedAt.toLocaleString("en-US", DATE_TIME)}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 xl:justify-end">
                    <span className="whitespace-nowrap font-frank-ruhl text-[20px] font-semibold leading-none text-black">
                      {amount}
                    </span>
                    <PayoutChip status={p.status} />
                  </div>
                  <div className="min-[560px]:justify-self-end">
                    {p.status === "PENDING" && (
                      <PayoutActions
                        id={p.id}
                        amount={amount}
                        rider={riderName}
                      />
                    )}
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
            basePath="/admin/rider-payouts"
          />
        )}
      </section>
    </div>
  );
}
