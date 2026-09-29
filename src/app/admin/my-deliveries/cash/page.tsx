import { Banknote, CreditCard, ReceiptText } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import { deliveredBetween, toRiderDelivery } from "@/lib/rider-panel";
import { itemsLabel, roundMoney } from "@/lib/rider-stats";
import RangeFilter from "../RangeFilter";
import { EmptyNote, RiderListRow, RiderPageHeader, RiderSection, RiderStatCard, StatusChip } from "../rider-ui";

export const metadata = { title: "Cash Collected" };

const ICON = "h-[18px] w-[18px]";

/**
 * Rider panel → Payout → Cash Collected: the cash-on-delivery money the
 * rider took from customers — the full order amount, which belongs to the
 * restaurant and is handed in at the end of the shift. Online-paid orders
 * are counted only, there's no cash to hand in for them.
 */
export default async function CashCollectedPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireStaff("myDeliveries");
  const params = await searchParams;
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "today";

  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);
  const now = new Date();

  const deliveries = (await deliveredBetween(session.user.id!, periodStart(range, now))).map(toRiderDelivery);
  const cash = deliveries.filter((d) => d.paymentMethod === "COD");
  const cashTotal = roundMoney(cash.reduce((sum, d) => sum + d.totalAmount, 0));
  const online = deliveries.length - cash.length;

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader
        title="Cash Collected"
        subtitle="Cash you took from customers on cash-on-delivery orders — hand it in to the restaurant at the end of your shift."
        now={now}
      />

      <div className="grid gap-4 min-[560px]:grid-cols-3 xl:gap-5">
        <RiderStatCard
          label="Cash in Hand"
          value={money(cashTotal)}
          hint={range === "today" ? "Collected today" : "Collected in this period"}
          icon={<Banknote className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Cash Orders"
          value={String(cash.length)}
          hint="Cash on delivery"
          icon={<ReceiptText className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Paid Online"
          value={String(online)}
          hint="Nothing to collect"
          icon={<CreditCard className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      <RiderSection title="Cash Orders" action={<RangeFilter value={range} defaultValue="today" />}>
        {cash.length === 0 ? (
          <EmptyNote>No cash orders delivered in this period.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {cash.map((d) => (
              <RiderListRow
                key={d.orderId}
                title={formatOrderId(d.orderId)}
                subtitle={`${d.customerName} · ${d.area} · ${itemsLabel(d.itemCount)}${
                  d.deliveredAt
                    ? ` · ${d.deliveredAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : ""
                }`}
                amount={formatAmount(d.totalAmount, d.currency)}
                chip={<StatusChip status="COD" label="Cash" />}
              />
            ))}
          </div>
        )}
      </RiderSection>
    </div>
  );
}
