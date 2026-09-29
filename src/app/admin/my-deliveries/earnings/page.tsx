import { CircleCheck, CircleDollarSign, HandCoins, Truck } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { deliveredBetween } from "@/lib/rider-panel";
import { earningsByDay, roundMoney, sumEarnings } from "@/lib/rider-stats";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import RangeFilter from "../RangeFilter";
import { EmptyNote, RiderPageHeader, RiderSection, RiderStatCard } from "../rider-ui";

export const metadata = { title: "Earnings" };

const ICON = "h-[18px] w-[18px]";

/**
 * Rider panel → Payout → Earnings: what the rider earned, and from what.
 *
 * Earning per delivery = delivery fee + tip (lib/rider-stats.ts). Only
 * delivered orders count; cancelled ones earn nothing. One row per day.
 */
export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireStaff("myDeliveries");
  const params = await searchParams;
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "week";

  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();

  const rows = await deliveredBetween(session.user.id!, periodStart(range, now));
  const orders = rows.map((row) => row.order);
  const total = sumEarnings(orders);
  const fees = roundMoney(orders.reduce((sum, order) => sum + order.deliveryFee.toNumber(), 0));
  const tips = roundMoney(orders.reduce((sum, order) => sum + order.tipAmount.toNumber(), 0));
  const days = earningsByDay(
    rows.flatMap((row) => (row.deliveredAt ? [{ deliveredAt: row.deliveredAt, ...row.order }] : []))
  );
  const periodHint = range === "all" ? "All time" : range === "today" ? "Today" : range === "week" ? "Last 7 days" : "Last 30 days";

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader
        title="Earnings"
        subtitle="Your earning on each delivery is its delivery fee plus the customer's tip."
        now={now}
        actions={<ExportReportButton endpoint="/api/rider/export" forwardParams={["range"]} fallbackFilename="my-earnings.csv" />}
      />

      <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <RiderStatCard
          label="Total Earnings"
          value={money(total)}
          hint={periodHint}
          icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Delivery Fees"
          value={money(fees)}
          hint="Paid by customers for delivery"
          icon={<Truck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Tips"
          value={money(tips)}
          hint="Yours in full"
          icon={<HandCoins className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Deliveries"
          value={String(rows.length)}
          hint={rows.length === 0 ? "None yet" : `${money(rows.length ? total / rows.length : 0)} per delivery`}
          icon={<CircleCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      <RiderSection title="By Day" action={<RangeFilter value={range} defaultValue="week" />}>
        {days.length === 0 ? (
          <EmptyNote>No delivered orders in this period.</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-y-2 text-left font-sora text-[13px] md:text-[14px]">
              <thead>
                <tr className="text-black/60">
                  <th className="px-4 py-2 font-normal">Date</th>
                  <th className="px-4 py-2 text-right font-normal">Deliveries</th>
                  <th className="px-4 py-2 text-right font-normal">Delivery fees</th>
                  <th className="px-4 py-2 text-right font-normal">Tips</th>
                  <th className="px-4 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.day} className="bg-[#F9F6F3]">
                    <td className="rounded-l-[12px] px-4 py-3 text-black">
                      {new Date(`${day.day}T12:00:00`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-black/80">{day.deliveries}</td>
                    <td className="px-4 py-3 text-right text-black/80">{money(day.fees)}</td>
                    <td className="px-4 py-3 text-right text-black/80">{money(day.tips)}</td>
                    <td className="rounded-r-[12px] px-4 py-3 text-right font-frank-ruhl text-[16px] font-medium text-black">
                      {money(day.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="font-sora text-[12px] leading-[1.6] text-black/55">
          How and when you&apos;re paid is agreed with the restaurant. Cash you collected from customers is on the Cash
          Collected page.
        </p>
      </RiderSection>
    </div>
  );
}
