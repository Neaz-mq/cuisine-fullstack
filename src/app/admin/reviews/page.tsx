import { Calendar, CircleCheck, ClipboardList, Hourglass, Star } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import {
  DEFAULT_REVIEW_STATUS,
  isReviewStatus,
  reviewStatusToDb,
  type ReviewStatusFilter,
} from "@/lib/review-filters";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import UserAvatar from "@/components/admin/UserAvatar";
import Pagination from "../orders/Pagination";
import ReviewsToolbar from "./ReviewsToolbar";
import ReviewsPeriodFilter from "./ReviewsPeriodFilter";
import ReviewActions from "./ReviewActions";
import ReviewStatusBadge from "./ReviewStatusBadge";

export const metadata = { title: "Reviews" };

/**
 * /admin/reviews — built to the Figma "Reviews" frame (1059px wide,
 * column, gap 24):
 *
 *   Welcome header · date pill · Export Report
 *   Search by Customer Name, Email… + All Statuses
 *   Overview (4 tiles, own period: ?overview=)
 *   Reviews list (own period: ?period=, 7 per page: ?page=)
 *
 * Same card, title and tile styles as the Insights page, so the admin
 * pages read as one design.
 */

const PAGE_SIZE = 7;

const CARD = "flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
// Figma: "Time & Date" / "Status" labels.
const FIELD_LABEL = "font-sora text-[12px] font-normal leading-none text-black/70 min-[480px]:text-[14px]";

function readPeriod(value: string | undefined): DashboardPeriod {
  return isDashboardPeriod(value) ? value : "today";
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    overview?: string;
    period?: string;
    page?: string;
  }>;
}) {
  // The layout already checks the "reviews" scope; this call also gives us
  // the session for the welcome name.
  const session = await requireStaff("reviews");

  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status: ReviewStatusFilter = isReviewStatus(params.status)
    ? params.status
    : DEFAULT_REVIEW_STATUS;
  const overviewPeriod = readPeriod(params.overview);
  const listPeriod = readPeriod(params.period);
  const requestedPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();
  const settings = await getRestaurantSettings();

  // ── Overview ────────────────────────────────────────────────────────────
  const overviewSince = periodStart(overviewPeriod, now);
  const inOverview: Prisma.ReviewWhereInput = overviewSince
    ? { createdAt: { gte: overviewSince } }
    : {};

  // ── List ────────────────────────────────────────────────────────────────
  const listSince = periodStart(listPeriod, now);
  const dbStatus = reviewStatusToDb(status);
  const listWhere: Prisma.ReviewWhereInput = {
    ...(listSince ? { createdAt: { gte: listSince } } : {}),
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

  const [totalReviews, positiveReviews, ratingAgg, pendingReviews, listTotal] =
    await Promise.all([
      prisma.review.count({ where: inOverview }),
      prisma.review.count({ where: { ...inOverview, rating: { gte: 4 } } }),
      // Only approved reviews count towards the rating — that is the rating
      // customers actually see on the menu.
      prisma.review.aggregate({
        _avg: { rating: true },
        where: { ...inOverview, status: "APPROVED" },
      }),
      // ⚠️ Pending ignores the period on purpose: it is the moderation
      // backlog. A review left last week and still waiting must not vanish
      // from this number just because the card is set to "Today".
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: listWhere }),
    ]);

  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const reviews = await prisma.review.findMany({
    where: listWhere,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true, image: true } },
      menuItem: { select: { title: true } },
    },
  });

  const averageRating = ratingAgg._avg.rating;

  const overviewTiles = [
    {
      label: "Total Reviews",
      value: totalReviews.toLocaleString("en-US"),
      hint: "All Customer Reviews",
      icon: ClipboardList,
    },
    {
      label: "Positive Reviews",
      value: positiveReviews.toLocaleString("en-US"),
      hint: "4–5 Star Reviews",
      icon: CircleCheck,
    },
    {
      label: "Average Rating",
      value: averageRating === null ? "—" : `${averageRating.toFixed(1)} ★`,
      hint: "Overall Rating",
      icon: Star,
    },
    {
      label: "Pending",
      value: pendingReviews.toLocaleString("en-US"),
      hint: "Awaiting Response",
      icon: Hourglass,
    },
  ];

  // "Jul 3, 10:00 AM" in the restaurant's own time zone — the server runs
  // in UTC, so without timeZone every time would be off by the UTC offset.
  const formatWhen = (date: Date) =>
    date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: settings.timezone,
    });

  const rangeStart = listTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, listTotal);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Welcome header — same markup as the dashboard ── */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-nowrap items-center gap-2.5 md:w-auto md:justify-start">
          <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black md:h-11 md:flex-none md:justify-start md:px-4 md:text-[14px]">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: settings.timezone,
              })}
            </span>
          </span>
          <ExportReportButton
            endpoint="/api/admin/reviews/export"
            forwardParams={["q", "status", "period"]}
            fallbackFilename="cuisine-reviews.csv"
          />
        </div>
      </div>

      <ReviewsToolbar status={status} />

      {/* ── Overview ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Overview</h2>
          <ReviewsPeriodFilter param="overview" value={overviewPeriod} />
        </div>

        {/* Figma: row, gap 20, four equal tiles. Two per row below xl —
            four in a row at tablet width squeezes "Positive Reviews" under
            its icon. One per row below 480px. */}
        <div className="grid gap-4 min-[480px]:grid-cols-2 md:gap-5 xl:grid-cols-4">
          {overviewTiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-tight text-black lg:text-[20px] lg:leading-none">
                  {tile.label}
                </h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <tile.icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {tile.value}
                </p>
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">{tile.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Reviews</h2>
          <ReviewsPeriodFilter param="period" value={listPeriod} resetPage />
        </div>

        {reviews.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.3] text-black/70">
            {q || status !== "all"
              ? "No reviews match your search or filter."
              : "No reviews in this period yet."}
          </p>
        ) : (
          /* Figma: column, gap 16; each row #F9F6F3, radius 16, padding 16. */
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => {
              const name = review.user.name?.trim() || review.user.email || "Customer";
              return (
                <li
                  key={review.id}
                  className={[
                    "grid min-w-0 items-center gap-4 rounded-[16px] bg-[#F9F6F3] p-4",
                    // Phone: stacked. Tablet: two rows. Desktop: one row,
                    // like the Figma.
                    "[grid-template-areas:'who'_'what'_'meta'_'actions']",
                    "md:grid-cols-[minmax(0,1fr)_auto] md:[grid-template-areas:'who_actions'_'what_meta']",
                    // Fixed widths for the last two columns so Time & Date, Status
                    // and the buttons line up from row to row.
                    "xl:grid-cols-[minmax(0,210px)_minmax(0,1fr)_252px_200px] xl:gap-6 xl:[grid-template-areas:'who_what_meta_actions']",
                  ].join(" ")}
                >
                  {/* Customer — Figma: 60×60 photo, name Frank Ruhl 20,
                      email Sora 12 Black/70. */}
                  <div className="flex min-w-0 items-center gap-4 [grid-area:who]">
                    <UserAvatar src={review.user.image} name={name} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate font-frank-ruhl text-[18px] font-medium leading-[1.2] text-black min-[480px]:text-[20px]">
                        {name}
                      </p>
                      {review.user.email && (
                        <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                          {review.user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rating + dish. Figma: 5 stars 20px #FF9540, the number
                      in Frank Ruhl 14, dish Frank Ruhl 16. The comment is
                      not in the Figma but it is what staff are moderating,
                      so it sits underneath, two lines max. */}
                  <div className="flex min-w-0 flex-col gap-2 [grid-area:what]">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            aria-hidden="true"
                            className={`h-4 w-4 min-[480px]:h-5 min-[480px]:w-5 ${
                              i < review.rating ? "text-[#FF9540]" : "text-[#FF9540]/30"
                            }`}
                            fill={i < review.rating ? "currentColor" : "none"}
                            strokeWidth={1.5}
                          />
                        ))}
                      </div>
                      <span className="font-frank-ruhl text-[14px] font-medium leading-none text-black">
                        {review.rating}
                      </span>
                    </div>
                    <p className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
                      {review.menuItem.title}
                    </p>
                    {review.comment && (
                      <p className="line-clamp-2 break-words font-sora text-[12px] leading-[1.5] text-black/70">
                        “{review.comment}”
                      </p>
                    )}
                  </div>

                  {/* Time & Date | Status — Figma: label Sora 14 Black/70,
                      value Frank Ruhl 16, gap 12. */}
                  <div className="grid grid-cols-2 gap-4 [grid-area:meta] md:justify-self-end xl:grid-cols-[136px_100px] xl:justify-self-stretch">
                    <div className="flex min-w-0 flex-col gap-3">
                      <span className={FIELD_LABEL}>Time &amp; Date</span>
                      <span className="whitespace-nowrap font-frank-ruhl text-[15px] font-medium leading-none text-black min-[480px]:text-[16px]">
                        {formatWhen(review.createdAt)}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <span className={FIELD_LABEL}>Status</span>
                      <ReviewStatusBadge status={review.status} />
                    </div>
                  </div>

                  <div className="min-w-0 [grid-area:actions]">
                    <ReviewActions
                      reviewId={review.id}
                      status={review.status}
                      customerName={name}
                      customerEmail={review.user.email}
                      itemTitle={review.menuItem.title}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {listTotal > 0 && (
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            {/* Figma: "● Showing 1-5 of 20 …" — orange dot, Sora 12. */}
            <p className="flex items-center gap-2 font-sora text-[12px] leading-[15px] text-black/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" />
              <span>
                Showing{" "}
                <span className="font-semibold text-black">
                  {rangeStart}-{rangeEnd}
                </span>{" "}
                of <span className="font-semibold text-black">{listTotal}</span>{" "}
                {listTotal === 1 ? "Review" : "Reviews"}
              </span>
            </p>
            {/* ⚠️ Same fix as the Insights lists: 7 page buttons × 34px is
                wider than the card at 320px, so below 480px they shrink to
                28px with a 4px gap. */}
            <div className="min-w-0 max-[479px]:[&_nav>*]:h-7 max-[479px]:[&_nav>*]:w-7 max-[479px]:[&_nav]:gap-1">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                searchParams={{
                  q,
                  status: status === DEFAULT_REVIEW_STATUS ? undefined : status,
                  overview: params.overview,
                  period: params.period,
                }}
                basePath="/admin/reviews"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
