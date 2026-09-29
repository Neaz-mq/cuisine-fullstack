import Link from "next/link";
import {
  CircleCheck,
  CircleDollarSign,
  Clock3,
  History,
  Package,
  ReceiptText,
  Star,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import {
  AVAILABLE_ORDER_WHERE,
  RIDER_DELIVERY_SELECT,
  daysAgo,
  deliveredBetween,
  findActiveDeliveries,
  finishedWhere,
  startOfToday,
  toRiderDelivery,
} from "@/lib/rider-panel";
import {
  areaLabel,
  averageMinutes,
  etaMinutes,
  formatMinutes,
  itemsLabel,
  paceHint,
  percentChange,
  sumEarnings,
} from "@/lib/rider-stats";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import RangeFilter from "./RangeFilter";
import {
  EmptyNote,
  GRADIENT_BG,
  RiderListRow,
  RiderPageHeader,
  RiderQuickCard,
  RiderSection,
  RiderStatCard,
  StatusChip,
} from "./rider-ui";

export const metadata = { title: "Rider Dashboard" };

const ICON = "h-[18px] w-[18px]";
const RECENT_LIMIT = 5;
/** The rider's position counts as live for "8 min away" only if it was
 *  updated this recently — otherwise it's where they were, not are. */
const LIVE_POSITION_MS = 3 * 60_000;

/**
 * Rider panel → Dashboard (Figma "Rider Dashboard"):
 *
 *   Welcome Back, <name>!                        [date] [Export Report]
 *   Today's Earnings · Deliveries Today · Avg. Delivery Time · Rating
 *   ▬ gradient banner: the active delivery (or orders waiting) ▬
 *   Available Orders · Delivery History · Earnings · Vehicle & Profile
 *   Recent Deliveries                                      [Today ⌄]
 *
 * Earnings = delivery fee + tip of each delivered order (lib/rider-stats).
 * Every number is the signed-in rider's own.
 */
export default async function RiderDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const params = await searchParams;
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "today";

  // Sets the server clock to the restaurant's time zone — "today" below is
  // the restaurant's today.
  const settings = await getRestaurantSettings();
  const money = (value: number) => formatAmount(value, settings.currency);

  const now = new Date();
  const today = startOfToday(now);
  const weekStart = daysAgo(today, 6);

  const [todayRows, sameDayLastWeek, weekRows, active, rating, availableCount, recentRows] = await Promise.all([
    deliveredBetween(riderId, today),
    deliveredBetween(riderId, daysAgo(today, 7), daysAgo(today, 6)),
    deliveredBetween(riderId, weekStart),
    findActiveDeliveries(riderId),
    prisma.deliveryTracking.aggregate({
      where: { riderId, riderRating: { not: null } },
      _avg: { riderRating: true },
      _count: { riderRating: true },
    }),
    prisma.order.count({ where: AVAILABLE_ORDER_WHERE }),
    prisma.deliveryTracking.findMany({
      where: finishedWhere(riderId, periodStart(range, now)),
      orderBy: { assignedAt: "desc" },
      take: RECENT_LIMIT,
      select: RIDER_DELIVERY_SELECT,
    }),
  ]);

  const todayEarnings = sumEarnings(todayRows.map((row) => row.order));
  const earningsDelta = percentChange(todayEarnings, sumEarnings(sameDayLastWeek.map((row) => row.order)));
  const weekEarnings = sumEarnings(weekRows.map((row) => row.order));

  // Average time: today's trips; before the first delivery of the day, the
  // last 7 days so the card isn't empty every morning.
  const timeRows = (todayRows.length > 0 ? todayRows : weekRows).flatMap((row) =>
    row.deliveredAt
      ? [{ assignedAt: row.assignedAt, pickedUpAt: row.order.dispatchedAt, deliveredAt: row.deliveredAt }]
      : []
  );
  const avgMinutes = averageMinutes(timeRows);
  const avgHint =
    avgMinutes === null
      ? "No deliveries yet"
      : `${paceHint(avgMinutes)} ${todayRows.length > 0 ? "today" : "· last 7 days"}`;

  const ratingValue = rating._avg.riderRating;
  const ratingCount = rating._count.riderRating;

  const recent = recentRows.map(toRiderDelivery);

  // The banner: the order on the road first, else one waiting at the kitchen.
  const onTheWay = active.find((row) => row.order.status === "OUT_FOR_DELIVERY");
  const current = onTheWay ?? active[0];
  let bannerTitle: string;
  let bannerText: string;
  let bannerHref: string;
  let bannerButton: string;
  if (current) {
    const id = formatOrderId(current.orderId);
    const area = areaLabel(current.order);
    bannerTitle =
      active.length > 1 ? `You have ${active.length} active deliveries` : "You have an active delivery";
    bannerHref = "/admin/my-deliveries/active";
    bannerButton = "Open Delivery";
    if (current.order.status === "OUT_FOR_DELIVERY") {
      const live =
        current.destLat !== null &&
        current.destLng !== null &&
        now.getTime() - current.riderLocationUpdatedAt.getTime() < LIVE_POSITION_MS;
      const away = live
        ? ` · ${etaMinutes(
            { lat: current.riderLat, lng: current.riderLng },
            { lat: current.destLat!, lng: current.destLng! }
          )} min away`
        : "";
      bannerText = `Order ${id} · Heading to ${area}${away}`;
    } else {
      bannerText = `Order ${id} · Pick it up at the restaurant · Going to ${area}`;
    }
  } else if (availableCount > 0) {
    bannerTitle = "No active delivery";
    bannerText = `${availableCount} ${availableCount === 1 ? "order is" : "orders are"} waiting for a rider right now.`;
    bannerHref = "/admin/my-deliveries/available";
    bannerButton = "View Orders";
  } else {
    bannerTitle = "No active delivery";
    bannerText = "New orders show up in Available Orders — we'll also notify you when one is assigned to you.";
    bannerHref = "/admin/my-deliveries/available";
    bannerButton = "Available Orders";
  }

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={now}
        actions={
          <ExportReportButton
            endpoint="/api/rider/export"
            forwardParams={["range"]}
            fallbackFilename="my-deliveries.csv"
          />
        }
      />

      {/* --- 4 stat cards --- */}
      <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <RiderStatCard
          label="Today's Earnings"
          value={money(todayEarnings)}
          delta={earningsDelta}
          hint={`${todayRows.length} ${todayRows.length === 1 ? "delivery" : "deliveries"}`}
          icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Deliveries Today"
          value={String(todayRows.length)}
          hint={`${active.length} in progress`}
          icon={<CircleCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Avg. Delivery Time"
          value={avgMinutes === null ? "—" : formatMinutes(avgMinutes)}
          hint={avgHint}
          icon={<Clock3 className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderStatCard
          label="Rating"
          value={ratingValue === null ? "—" : ratingValue.toFixed(1)}
          hint={
            ratingCount === 0
              ? "No ratings yet"
              : `From ${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`
          }
          icon={<Star className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      {/* --- active delivery banner (Figma gradient) --- */}
      <section
        className={`flex flex-col gap-4 rounded-[20px] ${GRADIENT_BG} p-5 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between md:p-[30px]`}
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] bg-white md:h-[60px] md:w-[60px]">
            <Package className="h-6 w-6 text-black" fill="currentColor" stroke="white" strokeWidth={1.2} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-frank-ruhl text-[18px] font-medium leading-[1.2] text-white md:text-[20px]">{bannerTitle}</p>
            <p className="font-sora text-[13px] leading-[1.6] text-white/80 md:text-[14px]">{bannerText}</p>
          </div>
        </div>
        <Link
          href={bannerHref}
          className="flex h-[46px] shrink-0 items-center justify-center rounded-full bg-white px-5 font-sora text-[15px] leading-none text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_black] md:h-[50px] md:text-[16px]"
        >
          {bannerButton}
        </Link>
      </section>

      {/* --- quick links --- */}
      <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <RiderQuickCard
          href="/admin/my-deliveries/available"
          label="Available Orders"
          hint={`${availableCount} ${availableCount === 1 ? "order" : "orders"} ready for pickup`}
          icon={<ReceiptText className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderQuickCard
          href="/admin/my-deliveries/history"
          label="Delivery History"
          hint="View your past deliveries"
          icon={<History className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderQuickCard
          href="/admin/my-deliveries/earnings"
          label="Earnings"
          hint={`${money(weekEarnings)} in the last 7 days`}
          icon={<CircleDollarSign className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
        <RiderQuickCard
          href="/admin/profile"
          label="Vehicle & Profile"
          hint="Manage your rider details"
          icon={<UserRound className={ICON} strokeWidth={1.5} aria-hidden="true" />}
        />
      </div>

      {/* --- recent deliveries --- */}
      <RiderSection title="Recent Deliveries" action={<RangeFilter value={range} defaultValue="today" />}>
        {recent.length === 0 ? (
          <EmptyNote>
            {range === "today" ? "No finished deliveries today yet." : "No finished deliveries in this period."}
          </EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {recent.map((delivery) => (
              <RiderListRow
                key={delivery.orderId}
                href="/admin/my-deliveries/history"
                title={formatOrderId(delivery.orderId)}
                subtitle={`${delivery.area} · ${itemsLabel(delivery.itemCount)}`}
                amount={delivery.status === "DELIVERED" ? `+${formatAmount(delivery.earning, delivery.currency)}` : undefined}
                chip={<StatusChip status={delivery.status} />}
              />
            ))}
            <Link
              href="/admin/my-deliveries/history"
              className="self-center font-sora text-[14px] font-semibold text-[#FF7100] hover:underline"
            >
              See all deliveries
            </Link>
          </div>
        )}
      </RiderSection>
    </div>
  );
}
