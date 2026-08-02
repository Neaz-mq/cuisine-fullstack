import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { sendChatMessageSchema } from "@/lib/validations/chat";

/**
 * GET/POST /api/rider/deliveries/[orderId]/chat
 *
 * Rider side of the rider <-> customer live chat (see ChatMessage in
 * prisma/schema.prisma). Same ownership-check pattern as
 * POST .../location — a rider can only read/send chat for an order
 * where they're the assigned rider on that order's DeliveryTracking row,
 * never an order assigned to someone else.
 */

async function assertOwnRider(orderId: string, riderId: string) {
  const tracking = await prisma.deliveryTracking.findUnique({
    where: { orderId },
    select: { riderId: true, deliveredAt: true },
  });
  if (!tracking || tracking.riderId !== riderId) {
    return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
  }
  return tracking;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;

  const { orderId } = await params;

  const owned = await assertOwnRider(orderId, riderId);
  if (owned instanceof NextResponse) return owned;

  const messages = await prisma.chatMessage.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderRole: true, senderName: true, message: true, createdAt: true },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id;
  const riderName = authResult.user.name ?? "Rider";

  const { orderId } = await params;

  const owned = await assertOwnRider(orderId, riderId);
  if (owned instanceof NextResponse) return owned;
  if (owned.deliveredAt) {
    return NextResponse.json(
      { error: "This delivery is already complete" },
      { status: 400 }
    );
  }

  const parsed = await parseBody(req, sendChatMessageSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { message } = parsed;

  const created = await prisma.chatMessage.create({
    data: {
      orderId,
      senderRole: "RIDER",
      senderName: riderName,
      message,
    },
    select: { id: true, senderRole: true, senderName: true, message: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}
