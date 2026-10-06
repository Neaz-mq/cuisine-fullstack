import { Banknote, CheckCheck, Hourglass, ReceiptText } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { deliveredBetween, toRiderDelivery } from "@/lib/rider-panel";
import { itemsLabel } from "@/lib/rider-stats";
import { allocateCash } from "@/lib/cash-ledger";
import { getRiderCash } from "@/lib/rider-cash";
import RangeFilter from "../RangeFilter";
import {
  EmptyNote,
  PayoutChip,
  RiderListRow,
  RiderPageHeader,
  RiderSection,
  RiderStatCard,
  StatusChip,
} from "../rider-ui";
import HandInCashButton from "./HandInCashButton";
import CancelHandoverButton from "./CancelHandoverButton";

export const metadata = { title: "Cash Collected" };

const ICON = "h-[18px] w-[18px]";
const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Rider panel → Payout → Cash Collected: the cash-on-delivery money the
 * rider took from customers — the full order amount, which belongs to the
 * restaurant and is handed in to it. Online-paid orders have no cash.
 *
 * It is a running account, not a per-day figure:
 *
 *   Cash in Hand            collected − confirmed hand-ins − reported ones
 *   Awaiting Confirmation   hand-ins the rider reported, owner hasn't confirmed
 *   Handed In               hand-ins the owner confirmed
 *
 * The rider reports a hand-in ("Hand In Cash"); the owner confirms it on
 * Admin → Rider Cash (or records cash received directly). Both sides see
 * the same dated record. Each order shows whether its cash has been handed
 * in, oldest orders first (lib/cash-ledger.ts).
 */
export default async function CashCollectedPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const params = await searchParams;
  // "All time" by default: cash from earlier days is still owed, and a
  // "today"-only list would hide it.
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "all";

  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();

  const [cash, deliveries, handovers] = await Promise.all([
    getRiderCash(riderId),
    deliveredBetween(riderId, periodStart(range, now)),
    prisma.cashRemittance.findMany({
      where: { riderId },
      orderBy: { createdAt: "desc" },
      take: 20,
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
      },
    }),
  ]);

  const allocation = new Map(allocateCash(cash.orders, cash.confirmed, cash.pending).map((row) => [row.orderId, row]));
  const periodDeliveries = deliveries.map(toRiderDelivery);
  const cashOrders = periodDeliveries.filter((d) => d.paymentMethod === "COD");
  const onlineCount = periodDeliveries.length - cashOrders.length;

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        subtitle="Cash you took from customers on cash-on-delivery orders — hand it in to the restaurant, then report it here so both of you have the same record."
        now={now}
        actions={<HandInCashButton inHand={cash.inHand} currency={settings.currency} minorUnits={settings.currencyMinorUnits} />}
      />

      <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <RiderStatCard
          label="Cash in Hand"
          value={money(cash.inHand)}
          hint={cash.inHand > 0 ? "Still with you — hand it in" : "Nothing left to hand in"}
          icon={<Banknote className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Awaiting Confirmation"
          value={money(cash.pending)}
          hint="Reported, restaurant hasn't confirmed"
          icon={<Hourglass className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Handed In"
          value={money(cash.confirmed)}
          hint={`Confirmed · of ${money(cash.collected)} collected`}
          icon={<CheckCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Cash Orders"
          value={String(cashOrders.length)}
          hint={`${onlineCount} paid online · nothing to collect`}
          icon={<ReceiptText className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      <RiderSection title="Cash Orders" action={<RangeFilter value={range} defaultValue="all" />}>
        {cashOrders.length === 0 ? (
          <EmptyNote>No cash orders delivered in this period.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {cashOrders.map((d) => {
              const row = allocation.get(d.orderId);
              const owedHere = row && row.status !== "HANDED_IN" ? row.due + row.awaiting : 0;
              return (
                <RiderListRow
                  key={d.orderId}
                  title={formatOrderId(d.orderId)}
                  subtitle={`${d.customerName} · ${d.area} · ${itemsLabel(d.itemCount)}${
                    d.deliveredAt
                      ? ` · ${d.deliveredAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                      : ""
                  }${row?.status === "PARTIAL" ? ` · ${formatAmount(owedHere, d.currency)} still to hand in` : ""}`}
                  amount={formatAmount(d.totalAmount, d.currency)}
                  chip={<StatusChip status={row?.status ?? "DUE"} />}
                />
              );
            })}
          </div>
        )}
      </RiderSection>

      <RiderSection title="Hand-In History">
        {handovers.length === 0 ? (
          <EmptyNote>
            Nothing yet. After you give cash to the restaurant, press Hand In Cash to report it — the restaurant then
            confirms it here.
          </EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {handovers.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between"
              >
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black md:text-[18px]">
                    {h.createdAt.toLocaleString("en-US", DATE_TIME)}
                  </span>
                  <span className="font-sora text-[11px] leading-[1.5] text-black/70 md:text-[12px]">
                    {h.source === "ADMIN" ? "Recorded by the restaurant" : "Reported by you"}
                    {h.riderNote ? ` · ${h.riderNote}` : ""}
                  </span>
                  {h.status === "CONFIRMED" && h.decidedAt && (
                    <span className="font-sora text-[11px] leading-[1.5] text-black/60">
                      Confirmed {h.decidedAt.toLocaleString("en-US", DATE_TIME)}
                      {h.adminNote ? ` · ${h.adminNote}` : ""}
                    </span>
                  )}
                  {h.status === "DISPUTED" && (
                    <span className="font-sora text-[11px] leading-[1.5] text-[#FF3F5C]">
                      Reason: {h.adminNote ?? "Not confirmed"} — the cash is still counted as with you
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center justify-between gap-4 min-[480px]:justify-end">
                  {h.status === "PENDING" && h.source === "RIDER" && <CancelHandoverButton id={h.id} />}
                  <span className="min-w-[80px] whitespace-nowrap text-right font-frank-ruhl text-[16px] font-medium leading-none tabular-nums text-black">
                    {formatAmount(h.amount.toNumber(), h.currency)}
                  </span>
                  <PayoutChip status={h.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </RiderSection>
    </div>
  );
}
