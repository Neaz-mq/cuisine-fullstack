import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart } from "@/lib/dashboard-period";
import { filterNotifications, isNotificationFilter } from "@/lib/notification-filters";
import { getKitchenNotificationsFor } from "@/lib/kitchen-notifications-data";
import { isKitchenNotificationType } from "@/lib/kitchen-notifications";

/**
 * GET /api/admin/kitchen/notifications/export — "Export Report" on the
 * kitchen Notification page: the signed-in cook's notifications as CSV, with
 * the same search, status, type and period as the screen (and the same feed
 * function, so the file can't differ from what's on screen).
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "kitchen-notifications-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
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
  const range = isDashboardPeriod(rawRange) ? rawRange : "all";
  const rawType = searchParams.get("type");
  const type = isKitchenNotificationType(rawType) ? rawType : "ALL";

  await getRestaurantSettings(); // restaurant time zone for "today"
  const feed = await getKitchenNotificationsFor(authResult.user.id!);
  const rows = filterNotifications(feed, {
    q: searchParams.get("q") ?? undefined,
    status,
    since: periodStart(range),
  }).filter((item) => type === "ALL" || item.kind === type);

  const csv = toCsv(
    ["When", "Type", "Title", "Description", "Status"],
    rows.map((item) => [
      item.createdAt,
      item.kind,
      item.title,
      item.description,
      item.read ? "Read" : "Unread",
    ])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kitchen-notifications-${range}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
