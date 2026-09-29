import { CircleCheck, CircleDollarSign, CircleX, Clock3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { RIDER_DELIVERY_SELECT, finishedWhere, toRiderDelivery } from "@/lib/rider-panel";
import { averageMinutes, deliveryMinutes, formatMinutes, itemsLabel, sumEarnings } from "@/lib/rider-stats";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import RangeFilter from "../RangeFilter";
import SearchBox from "../SearchBox";
import { EmptyNote, RiderListRow, RiderPageHeader, RiderSection, RiderStatCard, Stars, StatusChip } from "../rider-ui";

export const metadata = { title: "Delivery History" };

const PER_PAGE = 10;
const ICON = "h-[18px] w-[18px]";

function when(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Rider panel → Delivery History: every delivery the rider finished (or
 * that was cancelled while they had it), newest first. Period filter,
 * search by order ID or customer, 10 per page, CSV export of the same.
 */
export default async function DeliveryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; q?: string; page?: string }>;
}) {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const params = await searchParams;
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "all";
  const q = params.q?.trim() || undefined;

  const settings = await getRestaurantSettings();
  const now = new Date();
  const search = orderSearchFilter(q);
  const where = {
    ...finishedWhere(riderId, periodStart(range, now)),
    ...(search ? { AND: [{ order: search }] } : {}),
  };

  // Summary over the whole filtered period (all pages); the list is one page.
  const summaryRows = await prisma.deliveryTracking.findMany({
    where,
    select: {
      assignedAt: true,
      deliveredAt: true,
      order: { select: { status: true, dispatchedAt: true, deliveryFee: true, tipAmount: true } },
    },
  });
  const delivered = summaryRows.filter((row) => row.order.status === "DELIVERED" && row.deliveredAt);
  const cancelled = summaryRows.length - delivered.length;
  const earned = sumEarnings(delivered.map((row) => row.order));
  const avg = averageMinutes(
    delivered.map((row) => ({ assignedAt: row.assignedAt, pickedUpAt: row.order.dispatchedAt, deliveredAt: row.deliveredAt! }))
  );

  const totalPages = Math.max(1, Math.ceil(summaryRows.length / PER_PAGE));
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

  const money = (value: number) => formatAmount(value, settings.currency);

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader
        title="Delivery History"
        subtitle="Every delivery you finished — what you earned and how long it took."
        now={now}
        actions={
          <ExportReportButton endpoint="/api/rider/export" forwardParams={["range", "q"]} fallbackFilename="my-deliveries.csv" />
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchBox placeholder="Search by order ID or customer name..." />
        <RangeFilter value={range} defaultValue="all" surface="white" />
      </div>

      <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <RiderStatCard
          label="Delivered"
          value={String(delivered.length)}
          hint={range === "all" ? "All time" : "In this period"}
          icon={<CircleCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Earned"
          value={money(earned)}
          hint="Delivery fees + tips"
          icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Avg. Delivery Time"
          value={avg === null ? "—" : formatMinutes(avg)}
          hint="Pick-up to door"
          icon={<Clock3 className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Cancelled"
          value={String(cancelled)}
          hint="While you had them"
          icon={<CircleX className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      <RiderSection title="Deliveries">
        {rows.length === 0 ? (
          <EmptyNote>{q ? `Nothing matches “${q}”.` : "No deliveries in this period yet."}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((d) => {
              const minutes = d.deliveredAt
                ? Math.round(deliveryMinutes({ assignedAt: d.assignedAt, pickedUpAt: d.pickedUpAt, deliveredAt: d.deliveredAt }))
                : null;
              const finishedAt = d.deliveredAt ?? d.cancelledAt;
              return (
                <RiderListRow
                  key={d.orderId}
                  title={formatOrderId(d.orderId)}
                  subtitle={`${d.customerName} · ${d.area} · ${itemsLabel(d.itemCount)}`}
                  extra={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sora text-[12px] text-black/60">
                      {finishedAt && <span>{when(finishedAt)}</span>}
                      {minutes !== null && <span>{formatMinutes(minutes)} on the road</span>}
                      <span>{d.paymentMethod === "COD" ? `Cash ${formatAmount(d.totalAmount, d.currency)}` : "Paid online"}</span>
                      {d.rating !== null && <Stars value={d.rating} />}
                    </span>
                  }
                  amount={d.status === "DELIVERED" ? `+${formatAmount(d.earning, d.currency)}` : undefined}
                  chip={<StatusChip status={d.status} />}
                />
              );
            })}
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={{ range: params.range, q }}
          basePath="/admin/my-deliveries/history"
        />
      </RiderSection>
    </div>
  );
}
