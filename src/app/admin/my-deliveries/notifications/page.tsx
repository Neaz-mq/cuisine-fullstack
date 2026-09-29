import { BellRing, CheckCheck, Mail, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import {
  filterNotifications,
  isNotificationFilter,
  notificationCounts,
  type NotificationFilter,
} from "@/lib/notification-filters";
import { getRiderNotifications } from "@/lib/rider-notifications";
import NotificationFeed from "@/app/admin/notifications/NotificationFeed";
import NotificationsToolbar from "@/app/admin/notifications/NotificationsToolbar";
import RangeFilter from "../RangeFilter";
import { RiderPageHeader, RiderSection, RiderStatCard } from "../rider-ui";

export const metadata = { title: "Notification" };

const ICON = "h-[18px] w-[18px]";

/**
 * Rider panel → Notification: new deliveries, customer messages, finished
 * deliveries and ratings, cancellations, and orders waiting for a rider —
 * read off what happened (lib/rider-notifications.ts). Same look and the
 * same "Mark All as Read" as the admin Notification page.
 */
export default async function RiderNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; range?: string }>;
}) {
  const session = await requireStaff("myDeliveries");
  const params = await searchParams;
  await getRestaurantSettings();

  const q = params.q?.trim();
  const status: NotificationFilter = isNotificationFilter(params.status) ? params.status : "ALL";
  const range: DashboardPeriod = isDashboardPeriod(params.range) ? params.range : "all";
  const since = periodStart(range);

  const profile = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id! },
    select: { notificationsReadAt: true },
  });
  const feed = await getRiderNotifications(session.user.id!, profile?.notificationsReadAt ?? null);
  const counts = notificationCounts(filterNotifications(feed, { status: "ALL", since }));
  const notifications = filterNotifications(feed, { q, status, since });

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader title="Notification" subtitle="Deliveries, customer messages and updates for you." now={new Date()} />

      <NotificationsToolbar status={status} hasUnread={counts.unread > 0} />

      <RiderSection title="Overview" action={<RangeFilter value={range} defaultValue="all" />}>
        <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
          <RiderStatCard
            tone="cream"
            label="Total Notification"
            value={String(counts.total)}
            hint={since ? "In this period" : "All notifications"}
            icon={<BellRing className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderStatCard
            tone="cream"
            label="Read"
            value={String(counts.read)}
            hint="Already viewed"
            icon={<CheckCheck className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderStatCard
            tone="cream"
            label="Unread"
            value={String(counts.unread)}
            hint="New for you"
            icon={<Mail className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
          <RiderStatCard
            tone="cream"
            label="Alerts"
            value={String(counts.alerts)}
            hint="Cancelled orders"
            icon={<TriangleAlert className={ICON} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </RiderSection>

      <RiderSection title="Notification">
        <NotificationFeed notifications={notifications} />
      </RiderSection>
    </div>
  );
}
