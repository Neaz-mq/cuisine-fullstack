import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import {
  DEFAULT_REVIEW_STATUS,
  isReviewStatus,
  reviewStatusToDb,
  type ReviewStatusFilter,
} from "@/lib/review-filters";

/**
 * GET /api/admin/reviews/export
 *
 * The "Export Report" button on /admin/reviews. Every review matching the
 * search (?q=), status (?status=) and list period (?period=, default
 * Today) on screen — all pages, not just the one you are looking at.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("reviews");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "reviews-export", {
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
  const q = searchParams.get("q")?.trim() || undefined;
  const rawStatus = searchParams.get("status");
  const status: ReviewStatusFilter = isReviewStatus(rawStatus) ? rawStatus : DEFAULT_REVIEW_STATUS;
  const rawPeriod = searchParams.get("period");
  const period: DashboardPeriod = isDashboardPeriod(rawPeriod) ? rawPeriod : "today";

  const since = periodStart(period);
  const dbStatus = reviewStatusToDb(status);
  const where: Prisma.ReviewWhereInput = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(dbStatus ? { status: dbStatus } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { menuItem: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  try {
    const [settings, reviews] = await Promise.all([
      getRestaurantSettings(),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          rating: true,
          comment: true,
          status: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          menuItem: { select: { title: true } },
        },
      }),
    ]);

    const header = ["Date", "Customer", "Email", "Menu Item", "Rating", "Comment", "Status"];
    const rows = reviews.map((review) => [
      review.createdAt.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: settings.timezone,
      }),
      review.user.name ?? "",
      review.user.email ?? "",
      review.menuItem.title,
      review.rating,
      review.comment ?? "",
      review.status.charAt(0) + review.status.slice(1).toLowerCase(),
    ]);

    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cuisine-reviews-${status}-${period}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Always answer with JSON, so the button can show a real message
    // instead of a blank "Export failed". The details go to the server log.
    console.error("GET /api/admin/reviews/export error:", error);
    return NextResponse.json(
      { error: "Couldn't build the reviews export. Please try again." },
      { status: 500 }
    );
  }
}
