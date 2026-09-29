import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart } from "@/lib/dashboard-period";
import { filterNotifications, isNotificationFilter } from "@/lib/notification-filters";
import { getRiderNotifications, isRiderNotificationType } from "@/lib/rider-notifications";

/**
 * GET /api/rider/notifications/export — "Export Report" on the rider
 * Notification page: the signed-in rider's own notifications as CSV, with
 * the same search, status, type and period as the screen.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "rider-notifications-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const status = isNotificationFilter(rawStatus) ? rawStatus : "ALL";
  const rawRange = searchParams.get("range");
  const range = isDashboardPeriod(rawRange) ? rawRange : "today";
  const rawType = searchParams.get("type");
  const type = isRiderNotificationType(rawType) ? rawType : "ALL";

  await getRestaurantSettings(); // restaurant time zone for "today"
  const riderId = authResult.user.id!;
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: riderId },
    select: { notificationsReadAt: true },
  });
  const feed = await getRiderNotifications(riderId, profile?.notificationsReadAt ?? null);
  const rows = filterNotifications(feed, {
    q: searchParams.get("q") ?? undefined,
    status,
    since: periodStart(range),
  }).filter((item) => type === "ALL" || item.kind === type);

  const csv = toCsv(
    ["When", "Type", "Title", "Description", "Status"],
    rows.map((item) => [item.createdAt, item.kind, item.title, item.description, item.read ? "Read" : "Unread"])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-notifications-${range}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
