import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, PenLine, Star, UtensilsCrossed } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatOrderId } from "@/lib/format-order-id";
import { CARD, CARD_SUBTITLE, CARD_TITLE, PRIMARY_BUTTON, SMALL_PRIMARY } from "@/components/account/ui";

export const metadata: Metadata = { title: "My Reviews" };

/**
 * src/app/(main)/account/reviews/page.tsx — customer panel → My Reviews.
 *
 *   • Waiting for your review — delivered orders not reviewed yet. "Write
 *     a review" opens the order's page straight on the review form
 *     (/track/[id]?review=1), the same form as after delivery.
 *   • Your reviews — what the customer wrote about each order, with the
 *     dishes they rated, and whether it is on the site yet (reviews are
 *     approved by the restaurant first).
 */

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Under review", className: "bg-[#FFF8E1] text-[#B98900]" },
  APPROVED: { label: "Published", className: "bg-[#E8FFEC] text-[#0ECF00]" },
  REJECTED: { label: "Not published", className: "bg-[#FAE7EC] text-[#D72A37]" },
};

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= value ? "fill-[#FF9540] text-[#FF9540]" : "fill-transparent text-black/20"}`}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/reviews");
  const userId = session.user.id;

  const [settings, waiting, orderReviews, dishReviews] = await Promise.all([
    getRestaurantSettings(),
    prisma.order.findMany({
      where: { userId, status: "DELIVERED", orderReview: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        items: { select: { quantity: true, menuItem: { select: { title: true, imageUrl: true } } } },
      },
    }),
    prisma.orderReview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, orderId: true, comment: true, status: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        id: true,
        rating: true,
        comment: true,
        status: true,
        updatedAt: true,
        menuItemId: true,
        menuItem: { select: { title: true, imageUrl: true } },
      },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: settings.timezone });
  const averageRating = dishReviews.length
    ? dishReviews.reduce((sum, review) => sum + review.rating, 0) / dishReviews.length
    : null;

  return (
    <>
      {/* Waiting for your review */}
      <section aria-labelledby="to-review" className={`${CARD} flex flex-col gap-5`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="to-review" className={CARD_TITLE}>
              Waiting for Your Review
            </h2>
            <p className={CARD_SUBTITLE}>Tell us how it went — it takes under a minute and helps other food lovers.</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
            <PenLine className="h-[18px] w-[18px] text-black" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </div>

        {waiting.length === 0 ? (
          <p className="rounded-[20px] bg-[#F9F6F3] px-5 py-6 text-center font-sora text-[14px] text-black/70">
            You&apos;re all caught up — no delivered orders waiting for a review.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {waiting.map((order) => {
              const cover = order.items.find((line) => line.menuItem.imageUrl)?.menuItem.imageUrl;
              return (
                <li
                  key={order.id}
                  className="flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between md:px-[30px] md:py-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white">
                      {cover ? (
                        <Image src={cover} alt="" fill sizes="56px" className="object-cover" />
                      ) : (
                        <UtensilsCrossed className="h-5 w-5 text-black/30" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] text-black">{formatOrderId(order.id)}</p>
                      <p className="mt-1 line-clamp-1 font-sora text-[13px] text-black/70 md:text-[14px]">
                        {dateFmt.format(order.createdAt)} ·{" "}
                        {order.items.map((line) => line.menuItem.title).join(", ")}
                      </p>
                    </div>
                  </div>
                  <Link href={`/track/${order.id}?review=1`} className={`${SMALL_PRIMARY} h-10 shrink-0 self-start px-5 min-[560px]:self-center`}>
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    Write a review
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Your reviews */}
      <section aria-labelledby="my-reviews" className={`${CARD} flex flex-col gap-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-reviews" className={CARD_TITLE}>
            My Reviews
          </h2>
          {averageRating !== null && (
            <span className="flex items-center gap-2 font-sora text-[14px] text-black/70 md:text-[16px]">
              <Star className="h-4 w-4 fill-[#FF9540] text-[#FF9540]" aria-hidden="true" />
              <strong className="font-semibold text-black">{averageRating.toFixed(1)}</strong> average ·{" "}
              {dishReviews.length} {dishReviews.length === 1 ? "dish" : "dishes"} rated
            </span>
          )}
        </div>

        {orderReviews.length === 0 && dishReviews.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <MessageSquareText className="h-6 w-6 text-black/60" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <p className="font-frank-ruhl text-[22px] font-semibold text-black">No reviews yet</p>
              <p className="mt-1 font-sora text-[14px] text-black/70">After your order arrives you can rate it here.</p>
            </div>
            <Link href="/menu" className={PRIMARY_BUTTON}>
              Browse the menu
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {orderReviews.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-frank-ruhl text-[20px] font-semibold text-black md:text-[22px]">About your orders</h3>
                <ul className="flex flex-col gap-4">
                  {orderReviews.map((review) => {
                    const status = STATUS[review.status] ?? STATUS.PENDING;
                    return (
                      <li key={review.id} className="flex flex-col gap-3 rounded-[20px] bg-[#F9F6F3] p-4 md:px-[30px] md:py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link
                            href={`/track/${review.orderId}`}
                            className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] text-black hover:underline"
                          >
                            {formatOrderId(review.orderId)}
                          </Link>
                          <span className={`rounded-full px-3 py-1.5 font-sora text-[12px] font-semibold leading-none ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="whitespace-pre-line break-words font-sora text-[14px] leading-[1.6] text-black md:text-[15px]">
                          “{review.comment}”
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 font-sora text-[12px] text-black/60">
                          <span>{dateFmt.format(review.createdAt)}</span>
                          <Link href={`/track/${review.orderId}?review=1`} className="font-semibold text-black hover:underline">
                            Edit review
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {dishReviews.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-frank-ruhl text-[20px] font-semibold text-black md:text-[22px]">Dishes you rated</h3>
                <ul className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
                  {dishReviews.map((review) => {
                    const status = STATUS[review.status] ?? STATUS.PENDING;
                    return (
                      <li key={review.id} className="flex min-w-0 gap-3 rounded-[20px] bg-[#F9F6F3] p-3">
                        <Link
                          href={`/menu/${review.menuItemId}`}
                          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white"
                        >
                          {review.menuItem.imageUrl ? (
                            <Image src={review.menuItem.imageUrl} alt={review.menuItem.title} fill sizes="64px" className="object-cover" />
                          ) : (
                            <UtensilsCrossed className="h-5 w-5 text-black/30" aria-hidden="true" />
                          )}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <Link
                            href={`/menu/${review.menuItemId}`}
                            className="line-clamp-1 font-frank-ruhl text-[18px] font-semibold leading-tight text-black hover:underline"
                          >
                            {review.menuItem.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2">
                            <Stars value={review.rating} />
                            <span className={`rounded-full px-2 py-1 font-sora text-[10px] font-semibold leading-none ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="line-clamp-2 font-sora text-[12px] leading-[1.5] text-black/70">{review.comment}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
