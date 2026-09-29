import { BellRing, CheckCheck, MessageSquareDot } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import {
  isDashboardPeriod,
  periodStart,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  filterNotifications,
  isNotificationFilter,
  notificationCounts,
  type NotificationFilter,
} from "@/lib/notification-filters";
import {
  getRiderNotifications,
  isRiderNotificationType,
  RIDER_NOTIFICATION_TYPES,
  type RiderNotificationType,
} from "@/lib/rider-notifications";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import NotificationFeed from "@/app/admin/notifications/NotificationFeed";
import NotificationsToolbar from "@/app/admin/notifications/NotificationsToolbar";
import RangeFilter from "../RangeFilter";
import UrlSelect from "../UrlSelect";
import { EmptyNote, RiderPageHeader } from "../rider-ui";

export const metadata = { title: "Notification" };

const ICON = "h-[18px] w-[18px]";
const PER_PAGE = 10;
const PERIOD_HINT: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All notifications",
};

/**
 * Rider panel → Notification (Figma):
 *
 *   Welcome Back                                   [date] [Export Report]
 *   search · Mark All as Read · All Statuses ⌄
 *   Overview [Today ⌄]      Total Notification · Read · Unread
 *   Notification [All ⌄]    Today / Yesterday / … groups
 *   Showing 1–10 of N                                  ‹ 1 2 3 … ›
 *
 * The feed is built from what happened (lib/rider-notifications.ts): new
 * or accepted deliveries, customer messages, finished deliveries, ratings,
 * cancellations and orders waiting for a rider. The period (Today ⌄)
 * applies to the Overview and the list alike.
 */
export default async function RiderNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    range?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const session = await requireStaff("myDeliveries");
  const params = await searchParams;
  await getRestaurantSettings(); // restaurant time zone for "today"

  const q = params.q?.trim();
  const status: NotificationFilter = isNotificationFilter(params.status)
    ? params.status
    : "ALL";
  const range: DashboardPeriod = isDashboardPeriod(params.range)
    ? params.range
    : "today";
  const type: RiderNotificationType = isRiderNotificationType(params.type)
    ? params.type
    : "ALL";
  const since = periodStart(range);

  const profile = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id! },
    select: { notificationsReadAt: true },
  });
  const feed = await getRiderNotifications(
    session.user.id!,
    profile?.notificationsReadAt ?? null,
  );
  const counts = notificationCounts(
    filterNotifications(feed, { status: "ALL", since }),
  );
  const allUnread = feed.some((item) => !item.read);

  const listed = filterNotifications(feed, { q, status, since }).filter(
    (item) => type === "ALL" || item.kind === type,
  );
  const total = listed.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(
    totalPages,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const pageItems = listed.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const last = Math.min(page * PER_PAGE, total);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={new Date()}
        actions={
          <ExportReportButton
            endpoint="/api/rider/notifications/export"
            forwardParams={["q", "status", "range", "type"]}
            fallbackFilename="my-notifications.csv"
          />
        }
      />

      <NotificationsToolbar status={status} hasUnread={allUnread} />

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Overview
          </h2>
          <RangeFilter value={range} defaultValue="today" />
        </div>
        <div className="grid gap-5 min-[640px]:grid-cols-3">
          <OverviewCard
            label="Total Notification"
            value={String(counts.total)}
            hint={PERIOD_HINT[range]}
            icon={
              <BellRing className={ICON} strokeWidth={1.5} aria-hidden="true" />
            }
          />
          <OverviewCard
            label="Read"
            value={String(counts.read)}
            hint="Already viewed"
            icon={
              <CheckCheck
                className={ICON}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            }
          />
          <OverviewCard
            label="Unread"
            value={String(counts.unread)}
            hint="Awaiting attention"
            icon={
              <MessageSquareDot
                className={ICON}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            }
          />
        </div>
      </section>

      {/* --- Notification list --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Notification
          </h2>
          <UrlSelect
            param="type"
            value={type}
            defaultValue="ALL"
            options={RIDER_NOTIFICATION_TYPES}
            ariaLabel="Notification type"
          />
        </div>

        {total === 0 ? (
          <EmptyNote>
            {q
              ? `Nothing matches “${q}”.`
              : range === "today"
                ? "Nothing new today. Change Today to This Week or All Time to see older notifications."
                : "No notifications in this period."}
          </EmptyNote>
        ) : (
          <NotificationFeed notifications={pageItems} />
        )}

        {total > 0 && (
          <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
            <p className="flex items-center gap-2 font-sora text-[12px] text-black/70">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#FF9540]"
              />
              Showing{" "}
              <strong className="font-semibold text-black">
                {first}–{last}
              </strong>{" "}
              of <strong className="font-semibold text-black">{total}</strong>{" "}
              Notifications
            </p>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={{
                q,
                status: params.status,
                range: params.range,
                type: params.type,
              }}
              basePath="/admin/my-deliveries/notifications"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[140px] min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-2">
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
        <span className="font-sora text-[12px] leading-none text-black/70">
          {hint}
        </span>
      </div>
    </div>
  );
}
