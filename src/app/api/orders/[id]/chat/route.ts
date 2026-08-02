import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { sendChatMessageSchema } from "@/lib/validations/chat";

/**
 * GET/POST /api/orders/[id]/chat
 *
 * Customer side of the rider <-> customer live chat (see ChatMessage in
 * prisma/schema.prisma for the full design note). Public/unauthenticated,
 * same trust model as GET /api/orders/[id] — the unguessable order id
 * *is* the access token, since guest checkout customers have no account
 * to authenticate with.
 *
 * GET returns the full message history regardless of order status, so a
 * customer can still read what was said after delivery. POST (sending a
 * new message) is only allowed while the order is OUT_FOR_DELIVERY — chat
 * exists to coordinate an in-progress handoff, not as a general-purpose
 * messaging feature before or after that window.
 */

async function loadOrderForChat(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      status: true,
      orderType: true,
      shippingMethod: true,
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await loadOrderForChat(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderRole: true, senderName: true, message: true, createdAt: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await loadOrderForChat(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.orderType !== "DELIVERY" || order.shippingMethod !== "OWN_DELIVERY") {
    return NextResponse.json({ error: "Chat isn't available for this order" }, { status: 400 });
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    return NextResponse.json(
      { error: "Chat is only available while your order is out for delivery" },
      { status: 400 }
    );
  }

  const parsed = await parseBody(req, sendChatMessageSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { message } = parsed;

  const created = await prisma.chatMessage.create({
    data: {
      orderId: id,
      senderRole: "CUSTOMER",
      senderName: order.firstName,
      message,
    },
    select: { id: true, senderRole: true, senderName: true, message: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}
 