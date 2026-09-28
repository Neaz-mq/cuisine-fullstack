import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { attributeDishRatings } from "@/lib/customer-reviews";

/**
 * DELETE /api/account/reviews — My Reviews → "Delete".
 *
 *   { orderId }  — the whole review of one order: its written comment and
 *                  the dish ratings given with it (lib/customer-reviews.ts
 *                  decides which ratings those are).
 *   { reviewId } — a single dish rating that isn't tied to any order.
 *
 * Only the signed-in customer's own reviews — anything else is "not found".
 * Deleting also takes it off the site, if it was published.
 */
const deleteSchema = z.union([
  z.object({ orderId: z.string().min(1).max(64) }),
  z.object({ reviewId: z.string().min(1).max(64) }),
]);

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const userId = session.user.id;

  const rate = checkRateLimit(request, "account-reviews", { limit: 20, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many changes — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, deleteSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if ("reviewId" in parsed) {
      const { count } = await prisma.review.deleteMany({ where: { id: parsed.reviewId, userId } });
      if (count === 0) return NextResponse.json({ error: "Review not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const order = await prisma.order.findFirst({
      where: { id: parsed.orderId, userId },
      select: { id: true, items: { select: { menuItemId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Review not found." }, { status: 404 });

    const dishIds = [...new Set(order.items.map((item) => item.menuItemId))];
    const [orders, ratings] = await Promise.all([
      prisma.order.findMany({
        where: { userId, status: "DELIVERED", items: { some: { menuItemId: { in: dishIds } } } },
        select: { id: true, createdAt: true, deliveredAt: true, items: { select: { menuItemId: true } } },
      }),
      prisma.review.findMany({
        where: { userId, menuItemId: { in: dishIds } },
        select: { id: true, menuItemId: true, updatedAt: true },
      }),
    ]);

    const attribution = attributeDishRatings(
      orders.map((o) => ({ ...o, items: o.items.map((item) => ({ ...item, title: "", imageUrl: null })) })),
      ratings
    );
    const ratingIds = ratings.filter((rating) => attribution.get(rating.id) === order.id).map((rating) => rating.id);

    const [comments, dishRatings] = await prisma.$transaction([
      prisma.orderReview.deleteMany({ where: { orderId: order.id } }),
      prisma.review.deleteMany({ where: { id: { in: ratingIds }, userId } }),
    ]);
    if (comments.count === 0 && dishRatings.count === 0) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[account/reviews] delete failed:", error);
    return NextResponse.json({ error: "Couldn't delete this review. Please try again." }, { status: 500 });
  }
}
