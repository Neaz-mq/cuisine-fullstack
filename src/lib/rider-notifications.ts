/**
 * src/lib/rider-notifications.ts
 *
 * The rider panel's Notification page (and the sidebar badge), built the
 * same way as the admin one (lib/admin-notifications.ts): there is no
 * notification table — the feed is read off what actually happened:
 *
 *   • an order was assigned to the rider, or they took one   → DELIVERY
 *   • a customer sent them a chat message                    → CHAT
 *   • they finished a delivery (+ what they earned)          → DELIVERY
 *   • a customer rated the delivery                          → REVIEW
 *   • an order of theirs was cancelled                       → CANCELLED
 *   • an order is waiting for a rider (Available Orders)     → ORDER
 *
 * "Unread" = happened after the rider last pressed "Mark All as Read"
 * (StaffProfile.notificationsReadAt, the same column the admin feed uses).
 */
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmount } from "@/lib/currency-format";
import { findAvailableOrders } from "@/lib/rider-panel";
import { areaLabel, deliveryEarning } from "@/lib/rider-stats";
import type { AdminNotification } from "@/lib/notification-filters";

const SOURCE_LIMIT = 30;

const BASE = "/admin/my-deliveries";

export async function getRiderNotifications(
  riderId: string,
  readAt: Date | null
): Promise<AdminNotification[]> {
  const [trackings, messages, available] = await Promise.all([
    prisma.deliveryTracking.findMany({
      where: { riderId },
      orderBy: { assignedAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        orderId: true,
        assignedAt: true,
        deliveredAt: true,
        selfAssigned: true,
        riderRating: true,
        riderRatedAt: true,
        order: {
          select: {
            status: true,
            firstName: true,
            address: true,
            city: true,
            state: true,
            updatedAt: true,
            deliveryFee: true,
            tipAmount: true,
            currency: true,
            currencyMinorUnits: true,
          },
        },
      },
    }),
    prisma.chatMessage.findMany({
      where: { senderRole: "CUSTOMER", order: { deliveryTracking: { is: { riderId } } } },
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: { id: true, orderId: true, senderName: true, message: true, createdAt: true },
    }),
    findAvailableOrders(SOURCE_LIMIT),
  ]);

  const isRead = (at: Date) => readAt !== null && at.getTime() <= readAt.getTime();
  const feed: AdminNotification[] = [];

  for (const row of trackings) {
    const order = row.order;
    const id = formatOrderId(row.orderId);
    const area = areaLabel(order);
    const open = row.deliveredAt === null && order.status !== "CANCELLED";

    feed.push({
      id: `assigned-${row.orderId}`,
      kind: "DELIVERY",
      title: row.selfAssigned ? "You accepted a delivery" : "New delivery assigned to you",
      description: `Order ${id} · ${order.firstName} · ${area}`,
      createdAt: row.assignedAt.toISOString(),
      read: isRead(row.assignedAt),
      href: open ? `${BASE}/active` : `${BASE}/history`,
    });

    if (row.deliveredAt && order.status === "DELIVERED") {
      const earned = formatAmount(deliveryEarning(order).toFixed(order.currencyMinorUnits), order.currency);
      feed.push({
        id: `delivered-${row.orderId}`,
        kind: "DELIVERY",
        title: "Delivery completed",
        description: `Order ${id} delivered to ${order.firstName} · you earned ${earned}`,
        createdAt: row.deliveredAt.toISOString(),
        read: isRead(row.deliveredAt),
        href: `${BASE}/history`,
      });
    }

    if (row.riderRating !== null && row.riderRatedAt) {
      feed.push({
        id: `rated-${row.orderId}`,
        kind: "REVIEW",
        title: `${order.firstName} rated your delivery ${row.riderRating}★`,
        description: `Order ${id} · ${area}`,
        createdAt: row.riderRatedAt.toISOString(),
        read: isRead(row.riderRatedAt),
        href: `${BASE}/history`,
      });
    }

    if (order.status === "CANCELLED") {
      feed.push({
        id: `cancelled-${row.orderId}`,
        kind: "CANCELLED",
        title: "Order cancelled",
        description: `Order ${id} for ${order.firstName} was cancelled — no need to deliver it`,
        createdAt: order.updatedAt.toISOString(),
        read: isRead(order.updatedAt),
        href: `${BASE}/history`,
      });
    }
  }

  for (const message of messages) {
    const text = message.message.length > 90 ? `${message.message.slice(0, 87)}…` : message.message;
    feed.push({
      id: `chat-${message.id}`,
      kind: "CHAT",
      title: `New message from ${message.senderName}`,
      description: `${formatOrderId(message.orderId)} · “${text}”`,
      createdAt: message.createdAt.toISOString(),
      read: isRead(message.createdAt),
      href: `${BASE}/active`,
    });
  }

  for (const order of available) {
    const earning = formatAmount(order.earning, order.currency);
    feed.push({
      id: `available-${order.orderId}`,
      kind: "ORDER",
      title: "Order waiting for a rider",
      description: `Order ${formatOrderId(order.orderId)} · ${order.area} · earn ${earning}`,
      createdAt: order.since,
      read: isRead(new Date(order.since)),
      href: `${BASE}/available`,
    });
  }

  return feed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Sidebar badge: unread notifications. */
export async function countUnreadRiderNotifications(riderId: string): Promise<number> {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: riderId },
    select: { notificationsReadAt: true },
  });
  const feed = await getRiderNotifications(riderId, profile?.notificationsReadAt ?? null);
  return feed.filter((item) => !item.read).length;
}

/** Rider Notification page → "All ⌄": what kind of notification. */
export const RIDER_NOTIFICATION_TYPES = [
  { value: "ALL", label: "All" },
  { value: "DELIVERY", label: "Deliveries" },
  { value: "ORDER", label: "Waiting Orders" },
  { value: "CHAT", label: "Messages" },
  { value: "REVIEW", label: "Ratings" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export type RiderNotificationType = (typeof RIDER_NOTIFICATION_TYPES)[number]["value"];

export function isRiderNotificationType(value: unknown): value is RiderNotificationType {
  return RIDER_NOTIFICATION_TYPES.some((option) => option.value === value);
}
