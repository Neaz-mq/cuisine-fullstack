import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

// 1 loyalty point per $10 spent, rounded down.
const POINTS_PER_CURRENCY_UNIT = 10;

// Public, unauthenticated lookup for the /track/[orderId] page. Guest
// checkout customers have no account to log into, so tracking has to work
// without a session — the unguessable cuid order id is effectively the
// access token here (same pattern most delivery apps use for tracking
// links). Deliberately selects only tracking-relevant fields — not phone,
// full address, or email — to limit what's exposed on an endpoint with no
// auth check.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      totalAmount: true,
      firstName: true,
      city: true,
      shippingMethod: true,
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          menuItem: { select: { title: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    select: { userId: true, totalAmount: true, pointsAwarded: true },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only credit points the first time an order reaches DELIVERED, and only
  // for orders placed by a logged-in user (guest checkout has no userId to
  // credit).
  const shouldAwardPoints =
    body.status === "DELIVERED" &&
    !existingOrder.pointsAwarded &&
    !!existingOrder.userId;

  if (shouldAwardPoints) {
    const pointsEarned = Math.floor(existingOrder.totalAmount / POINTS_PER_CURRENCY_UNIT);

    const [updated] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: body.status, pointsAwarded: true },
      }),
      ...(pointsEarned > 0
        ? [
            prisma.user.update({
              where: { id: existingOrder.userId as string },
              data: { loyaltyPoints: { increment: pointsEarned } },
            }),
            prisma.loyaltyTransaction.create({
              data: {
                points: pointsEarned,
                reason: "ORDER_DELIVERED",
                userId: existingOrder.userId as string,
                orderId: id,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(updated);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: body.status },
  });

  return NextResponse.json(updated);
}