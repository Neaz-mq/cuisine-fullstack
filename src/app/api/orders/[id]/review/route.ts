import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOrderAccess } from "@/lib/order-access";
import { parseBody } from "@/lib/validations/parse";
import { orderReviewSchema } from "@/lib/validations/order-review";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/orders/[id]/review
 *
 * The "How Was Your Food Experience?" pop-up on /track/[orderId], sent
 * once the order is delivered. It carries up to two things:
 *
 *   comment → one OrderReview for the whole order (as before).
 *
 *   ratings → one `Review` per rated dish, status PENDING. These are what
 *             /admin/reviews lists for Accept / Reject, and what the dish's
 *             menu page shows once approved. Before this, nothing in the
 *             app ever created a `Review`, so the admin page stayed empty
 *             no matter how many customers reviewed their food.
 *
 * ⚠️ Star ratings need a logged-in customer who OWNS the order:
 *   - a `Review` row must belong to a user (userId is required), so guest
 *     orders can only leave the written comment;
 *   - staff can open any order's tracking page, and must not be able to
 *     post ratings in a customer's name.
 *
 * Sending again updates the same rows (one review per customer per dish —
 * the @@unique in the schema) and puts them back to PENDING, so an edited
 * review is checked again before it goes public.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rate = checkRateLimit(req, "order-review", { limit: 10, windowMs: 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(req, orderReviewSchema);
  if (parsed instanceof NextResponse) return parsed;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
      firstName: true,
      items: { select: { menuItemId: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const access = await resolveOrderAccess(order);
  if (!access) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "You can review this order once it has been delivered." },
      { status: 409 }
    );
  }

  // Only dishes that were actually in this order, one rating per dish (if
  // the same dish is sent twice, the last one wins).
  const orderedDishes = new Set(order.items.map((item) => item.menuItemId));
  const ratings = new Map<string, number>();
  for (const { menuItemId, rating } of parsed.ratings) {
    if (orderedDishes.has(menuItemId)) ratings.set(menuItemId, rating);
  }

  if (ratings.size > 0 && (access !== "owner" || !order.userId)) {
    return NextResponse.json(
      { error: "Please log in with the account that placed this order to rate dishes." },
      { status: 403 }
    );
  }

  if (parsed.comment.length === 0 && ratings.size === 0) {
    return NextResponse.json(
      { error: "Please rate a dish or write a few words about your experience" },
      { status: 400 }
    );
  }

  const userId = order.userId;
  const comment = parsed.comment || null;

  await prisma.$transaction([
    ...(comment
      ? [
          prisma.orderReview.upsert({
            where: { orderId: order.id },
            create: {
              orderId: order.id,
              userId: order.userId,
              authorName: order.firstName,
              comment,
            },
            update: { comment, status: "PENDING" },
          }),
        ]
      : []),
    ...(userId
      ? [...ratings].map(([menuItemId, rating]) =>
          prisma.review.upsert({
            where: { userId_menuItemId: { userId, menuItemId } },
            create: { userId, menuItemId, rating, comment, status: "PENDING" },
            update: { rating, comment, status: "PENDING" },
          })
        )
      : []),
  ]);

  return NextResponse.json({ ok: true, rated: ratings.size }, { status: 201 });
}
