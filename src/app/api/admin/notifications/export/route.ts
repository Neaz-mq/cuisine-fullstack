import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { DEFAULT_OVERVIEW_RANGE, isSummaryRange, summaryRangeStart } from "@/lib/payment-filters";
import {
  filterNotifications,
  getAdminNotifications,
  isNotificationFilter,
} from "@/lib/admin-notifications";

/**
 * GET /api/admin/notifications/export — পাতার "Export Report"।
 *
 * ⚠️ ছাঁকনিগুলো পাতার সাথে হুবহু এক (`q`, `status`, `overview`), আর
 * feed-টাও একই function থেকে আসে — নাহলে পর্দায় এক জিনিস দেখে ফাইলে
 * আরেক জিনিস পাওয়া যেত।
 */
export async function GET(request: Request) {
  const authResult = await requireApiStaff();
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "notifications-export", {
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
  const q = searchParams.get("q")?.trim();
  const rawStatus = searchParams.get("status");
  const status = isNotificationFilter(rawStatus) ? rawStatus : "ALL";
  const rawRange = searchParams.get("overview");
  const range = isSummaryRange(rawRange) ? rawRange : DEFAULT_OVERVIEW_RANGE;

  // read-চিহ্নটা প্রতিটা staff-এর নিজের, তাই export-ও তাঁর নিজের
  // "পড়া/অপঠিত" অবস্থা অনুযায়ী।
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: authResult.user.id },
    select: { notificationsReadAt: true },
  });

  const feed = await getAdminNotifications(profile?.notificationsReadAt ?? null);
  const rows = filterNotifications(feed, {
    q,
    status,
    since: summaryRangeStart(range),
  });

  const header = ["When", "Type", "Title", "Description", "Status"];

  const csvRows = rows.map((item) => [
    // ISO — spreadsheet-এ sort আর ছাঁকা দুটোই এতে ঠিকঠাক কাজ করে।
    item.createdAt,
    item.kind,
    item.title,
    item.description,
    item.read ? "Read" : "Unread",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, csvRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-notifications-${String(status).toLowerCase()}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
