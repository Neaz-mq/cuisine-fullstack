import { NextRequest, NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { notificationsQuerySchema } from "@/lib/validations/admin";
import { parseQuery } from "@/lib/validations/parse";
import { getKitchenNotificationsFor } from "@/lib/kitchen-notifications-data";
import { kitchenBellCounts } from "@/lib/kitchen-notifications";

/**
 * GET /api/admin/kitchen/notifications — the KITCHEN header bell's poll.
 *
 * Kitchen-side counterpart to /api/admin/notifications (which counts every
 * PLACED order restaurant-wide and needs the "orders" scope a cook doesn't
 * have). This one counts the cook's OWN unread kitchen notifications, from the
 * very same feed the Notification page and the sidebar badge use — so the
 * three numbers can never disagree.
 *
 *   no `since`   → how many are unread right now (the badge on first load)
 *   `since=<ts>` → how many unread ones appeared after that moment
 *
 * `latestAt` is the newest item's time, which the bell sends back as the next
 * `since`.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const parsedQuery = parseQuery(searchParams, notificationsQuerySchema);
  if (parsedQuery instanceof NextResponse) return parsedQuery;
  const { since } = parsedQuery;

  const feed = await getKitchenNotificationsFor(authResult.user.id!);
  const { newCount, latestAt } = kitchenBellCounts(feed, since ? new Date(since) : null);

  return NextResponse.json(
    { newCount, latestAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
