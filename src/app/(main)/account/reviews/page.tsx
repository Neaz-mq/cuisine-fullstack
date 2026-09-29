import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, UtensilsCrossed } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatOrderId } from "@/lib/format-order-id";
import { buildReviewEntries, orderTitle, uniqueDishes, type ReviewStatus } from "@/lib/customer-reviews";
import { ReviewCardActions, WriteReviewButton } from "@/components/account/ReviewButtons";
import { CARD, CARD_TITLE, PRIMARY_BUTTON } from "@/components/account/ui";

export const metadata: Metadata = { title: "My Reviews" };

/**
 * src/app/(main)/account/reviews/page.tsx — customer panel → My Reviews.
 *
 * Figma, two white cards 60px apart:
 *   1. Rate Your Recent Orders — delivered orders not reviewed yet, each
 *      with "Write a Review" (opens the review form right here).
 *   2. My Reviews — one card per reviewed order: photo, dishes, "Delivered
 *      … · Order #…", stars, the comment, and Delete / Edit. "View All"
 *      shows every review (5 at first).
 *
 * Reviews are approved by the restaurant before they go public, so a
 * small line tells the customer when one is still waiting or wasn't
 * published — otherwise they wonder why it isn't on the site.
 */

const FIRST_PAGE = 5;
const RATE_LIMIT = 5;

const STATUS_NOTE: Record<ReviewStatus, { label: string; className: string } | null> = {
  PENDING: { label: "Waiting for approval", className: "bg-[#FFF8E1] text-[#B98900]" },
  REJECTED: { label: "Not published", className: "bg-[#FAE7EC] text-[#D72A37]" },
  APPROVED: null,
};

const STAR_PATH =
  "M12 2.5l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.33l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.5Z";

/** Figma: five 20px stars, #FF9540, 4px apart. */
function Stars({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true">
          <path d={STAR_PATH} fill={n <= value ? "#FF9540" : "#FFE3CC"} />
        </svg>
      ))}
    </span>
  );
}

/** Figma: 66px photo, radius 12, cream behind it. */
function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white md:h-[66px] md:w-[66px]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- menu photo from any allowed host
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <UtensilsCrossed className="h-5 w-5 text-black/30" aria-hidden="true" />
      )}
    </span>
  );
}

const ROW_TITLE =
  "line-clamp-2 font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:line-clamp-1 md:text-[24px]";
const ROW_SUB = "font-sora text-[13px] leading-[1.5] text-black/70 md:text-[14px]";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/reviews");
  const userId = session.user.id;
  const showAll = params.all === "1";

  const [settings, orders, comments, ratings] = await Promise.all([
    getRestaurantSettings(),
    prisma.order.findMany({
      where: { userId, status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        deliveredAt: true,
        items: { select: { menuItemId: true, menuItem: { select: { title: true, imageUrl: true } } } },
        deliveryTracking: { select: { riderRating: true, rider: { select: { name: true } } } },
      },
    }),
    prisma.orderReview.findMany({
      where: { order: { userId } },
      select: { orderId: true, comment: true, status: true, updatedAt: true },
    }),
    prisma.review.findMany({
      where: { userId },
      select: {
        id: true,
        menuItemId: true,
        rating: true,
        comment: true,
        status: true,
        updatedAt: true,
        menuItem: { select: { title: true, imageUrl: true } },
      },
    }),
  ]);

  const orderRows = orders.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      title: item.menuItem.title,
      imageUrl: item.menuItem.imageUrl,
    })),
    // Our own rider brought it → the review form asks about them too. First
    // name only — that's what the customer saw on the tracking page.
    rider: order.deliveryTracking
      ? {
          name: order.deliveryTracking.rider.name?.trim().split(/\s+/)[0] || "Your rider",
          rating: order.deliveryTracking.riderRating,
        }
      : null,
  }));

  const { entries, reviewedOrderIds } = buildReviewEntries(
    orderRows,
    comments,
    ratings.map((rating) => ({
      id: rating.id,
      menuItemId: rating.menuItemId,
      rating: rating.rating,
      comment: rating.comment,
      status: rating.status,
      updatedAt: rating.updatedAt,
      title: rating.menuItem.title,
      imageUrl: rating.menuItem.imageUrl,
    }))
  );

  const toRate = orderRows.filter((order) => !reviewedOrderIds.has(order.id)).slice(0, RATE_LIMIT);
  const shown = showAll ? entries : entries.slice(0, FIRST_PAGE);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: settings.timezone,
  });
  const deliveredLine = (date: Date | null, orderId: string | null) =>
    [date ? `Delivered ${dateFmt.format(date)}` : null, orderId ? `Order ${formatOrderId(orderId)}` : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      {/* Figma: Rate Your Recent Orders */}
      <section aria-labelledby="rate-orders" className={`${CARD} flex flex-col gap-6 md:gap-10`}>
        <div className="flex flex-col gap-3 md:gap-4">
          <h2 id="rate-orders" className={CARD_TITLE}>
            Rate Your Recent Orders
          </h2>
          <p className="font-sora text-[14px] leading-[1.3] tracking-[-0.01em] text-black/70 md:text-[18px] md:leading-[1.14]">
            {toRate.length > 0
              ? "These orders were delivered — tell us how they were."
              : "You're all caught up — every delivered order has a review."}
          </p>
        </div>

        {toRate.length > 0 && (
          <ul className="flex flex-col gap-4">
            {toRate.map((order) => {
              const dishes = uniqueDishes(order.items);
              const line = deliveredLine(order.deliveredAt ?? order.createdAt, order.id);
              return (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 rounded-[20px] bg-[#F9F6F3] p-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Thumb src={dishes.find((dish) => dish.imageUrl)?.imageUrl ?? null} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Link href={`/track/${order.id}`} className={`${ROW_TITLE} hover:underline`}>
                        {orderTitle(order.items)}
                      </Link>
                      <p className={ROW_SUB}>{line}</p>
                    </div>
                  </div>
                  <div className="self-end min-[560px]:self-center">
                    <WriteReviewButton order={{ orderId: order.id, orderLabel: line, dishes, rider: order.rider }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Figma: My Reviews */}
      <section aria-labelledby="my-reviews" className={`${CARD} flex flex-col gap-6 md:gap-10`}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="my-reviews" className={CARD_TITLE}>
            My Reviews
          </h2>
          {entries.length > FIRST_PAGE && (
            <Link
              href={showAll ? "/account/reviews" : "/account/reviews?all=1"}
              scroll={false}
              className="shrink-0 font-sora text-[15px] leading-[1.14] tracking-[-0.01em] text-black/70 hover:text-black hover:underline md:text-[18px]"
            >
              {showAll ? "Show Less" : "View All"}
            </Link>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <MessageSquareText className="h-6 w-6 text-black/60" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <p className="font-frank-ruhl text-[22px] font-semibold text-black">No reviews yet</p>
              <p className="mt-1 font-sora text-[14px] text-black/70">
                {toRate.length > 0 ? "Rate one of your orders above." : "After your order arrives you can rate it here."}
              </p>
            </div>
            {toRate.length === 0 && (
              <Link href="/menu" className={PRIMARY_BUTTON}>
                Browse the menu
              </Link>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {shown.map((entry) => {
              const note = STATUS_NOTE[entry.status];
              const line = deliveredLine(entry.date, entry.orderId);
              return (
                <li key={entry.key} className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4 md:gap-[25px]">
                  <div className="flex flex-col gap-4 md:gap-[25px]">
                    <div className="flex flex-col-reverse gap-3 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb src={entry.imageUrl} />
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <p className={ROW_TITLE}>{entry.title}</p>
                          {line && <p className={ROW_SUB}>{line}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 min-[560px]:flex-col min-[560px]:items-end">
                        {entry.stars !== null && <Stars value={entry.stars} />}
                        {note && (
                          <span className={`rounded-full px-2.5 py-1 font-sora text-[11px] font-semibold leading-none ${note.className}`}>
                            {note.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {entry.rider?.rating && (
                      <p className="flex flex-wrap items-center gap-2 font-sora text-[13px] text-black/70 md:text-[14px]">
                        Rider {entry.rider.name}:
                        <Stars value={entry.rider.rating} />
                      </p>
                    )}
                    {entry.comment && (
                      <p className="whitespace-pre-line break-words font-sora text-[13px] leading-[1.5] text-black/70 md:max-w-[635px] md:text-[14px]">
                        {entry.comment}
                      </p>
                    )}
                  </div>
                  <ReviewCardActions
                    order={
                      entry.orderId
                        ? { orderId: entry.orderId, orderLabel: line, dishes: entry.dishes, rider: entry.rider }
                        : null
                    }
                    reviewId={entry.reviewId}
                    ratings={entry.ratings}
                    comment={entry.comment}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
