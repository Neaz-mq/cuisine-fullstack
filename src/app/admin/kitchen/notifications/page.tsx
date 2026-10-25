import { type ReactNode } from "react";
import { AlarmClock, CircleCheck, ClipboardList, MessageSquareDot } from "lucide-react";
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
import { getKitchenNotifications } from "@/lib/kitchen-notifications-data";
import {
  isKitchenNotificationType,
  KITCHEN_NOTIFICATION_TYPES,
  type KitchenNotificationType,
} from "@/lib/kitchen-notifications";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import NotificationFeed from "@/app/admin/notifications/NotificationFeed";
import NotificationsToolbar from "@/app/admin/notifications/NotificationsToolbar";
import RangeFilter from "@/app/admin/my-deliveries/RangeFilter";
import UrlSelect from "@/app/admin/my-deliveries/UrlSelect";
import { EmptyNote, RiderPageHeader } from "@/app/admin/my-deliveries/rider-ui";

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
 * /admin/kitchen/notifications (shown as /kitchen/notifications) — the
 * KITCHEN role's Notification page, laid out like the Figma frame:
 *
 *   Welcome Back                                   [date] [Export Report]
 *   search · Mark All as Read · All Statuses ⌄
 *   Overview [Today ⌄]   Total · Read · Unread · System Alerts
 *   Notification [All ⌄] Today / Yesterday / … groups
 *   Showing 1–10 of N                                  ‹ 1 2 3 … ›
 *
 * The feed is built from what happened (lib/kitchen-notifications.ts): new
 * orders, orders waiting too long, cancellations, low stock, supplier
 * deliveries on the way and prep tasks another cook added. The period
 * (Today ⌄) applies to the Overview and the list alike.
 *
 * "Mark All as Read" posts to /api/admin/notifications/read — that route is
 * role-agnostic (any staff, keyed on the session's own StaffProfile), so the
 * kitchen shares it with the admin and rider panels.
 */
export default async function KitchenNotificationsPage({
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
  const session = await requireStaff("kitchen");
  const params = await searchParams;
  await getRestaurantSettings(); // restaurant time zone for "today"
  const userId = session.user.id!;

  const q = params.q?.trim();
  const status: NotificationFilter = isNotificationFilter(params.status)
    ? params.status
    : "ALL";
  // ⚠️ Default is ALL TIME, not today: the sidebar badge and the header bell
  // count every unread item, so a "Today" default showed 0 on the page while
  // the badge said 13 (older orders, stock alerts and deliveries still waiting).
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "all";
  const type: KitchenNotificationType = isKitchenNotificationType(params.type)
    ? params.type
    : "ALL";
  const since = periodStart(range);

  // The read mark is each person's own — never the whole kitchen's.
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { notificationsReadAt: true },
  });
  const feed = await getKitchenNotifications(userId, profile?.notificationsReadAt ?? null);

  // Overview counts follow the period only — not the search, status or type —
  // so "Unread 4" never turns into 0 just because "Read" is selected below.
  const counts = notificationCounts(filterNotifications(feed, { status: "ALL", since }));
  const anyUnread = feed.some((item) => !item.read);

  const listed = filterNotifications(feed, { q, status, since }).filter(
    (item) => type === "ALL" || item.kind === type
  );
  const total = listed.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(
    totalPages,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
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
            endpoint="/api/admin/kitchen/notifications/export"
            forwardParams={["q", "status", "range", "type"]}
            fallbackFilename="kitchen-notifications.csv"
          />
        }
      />

      <NotificationsToolbar status={status} hasUnread={anyUnread} />

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Overview
          </h2>
          <RangeFilter value={range} defaultValue="all" />
        </div>
        <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            label="Total Notification"
            value={String(counts.total)}
            hint={PERIOD_HINT[range]}
            icon={<ClipboardList className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="Read"
            value={String(counts.read)}
            hint="Already viewed"
            icon={<CircleCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="Unread"
            value={String(counts.unread)}
            hint="Awaiting attention"
            icon={<MessageSquareDot className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="System Alerts"
            value={String(counts.alerts)}
            hint="Important updates"
            icon={<AlarmClock className={ICON} strokeWidth={1.5} aria-hidden="true" />}
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
            options={KITCHEN_NOTIFICATION_TYPES}
            ariaLabel="Notification type"
          />
        </div>

        {total === 0 ? (
          <EmptyNote>
            {q
              ? `Nothing matches “${q}”.`
              : range === "today"
                ? "Nothing new today. Change Today to This Week or All Time to see older notifications."
                : "Nothing to catch up on right now."}
          </EmptyNote>
        ) : (
          <NotificationFeed
            notifications={pageItems}
            markReadUrl="/api/admin/kitchen/notifications/read-item"
            showReadDot
          />
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
              basePath="/admin/kitchen/notifications"
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
  icon: ReactNode;
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
        <span className="font-sora text-[12px] leading-none text-black/70">{hint}</span>
      </div>
    </div>
  );
}
