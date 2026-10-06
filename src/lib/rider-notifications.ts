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
 *     (only with "New Order Alerts" on, and only orders their
 *     Settings accept — radius, cash)
 *   • the owner paid (or rejected) a cash-out request        → PAYOUT
 *   • the owner confirmed (or disputed) a cash hand-in, or
 *     recorded cash they received from the rider             → PAYOUT
 *   • the restaurant verified (or rejected) a document       → DOCUMENT
 *
 * "Unread" = happened after the rider last pressed "Mark All as Read"
 * (StaffProfile.notificationsReadAt, the same column the admin feed uses)
 * AND not opened one by one (NotificationRead).
 */
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmount } from "@/lib/currency-format";
import { findAvailableOrders, getRiderPreferences } from "@/lib/rider-panel";
import { areaLabel, deliveryEarning } from "@/lib/rider-stats";
import type { AdminNotification } from "@/lib/notification-filters";
import { documentLabel } from "@/lib/rider-documents";

const SOURCE_LIMIT = 30;

const BASE = "/admin/my-deliveries";

export async function getRiderNotifications(
  riderId: string,
  readAt: Date | null
): Promise<AdminNotification[]> {
  const prefs = await getRiderPreferences(riderId);
  const [trackings, messages, available, payouts, handovers, documents, opened] = await Promise.all([
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
    prefs.newOrderAlerts ? findAvailableOrders(SOURCE_LIMIT, prefs) : Promise.resolve([]),
    prisma.riderPayout.findMany({
      where: { riderId, processedAt: { not: null }, status: { in: ["PAID", "REJECTED"] } },
      orderBy: { processedAt: "desc" },
      take: SOURCE_LIMIT,
      select: { id: true, amount: true, currency: true, status: true, destination: true, processedAt: true, note: true },
    }),
    // Cash hand-ins the owner has answered (or recorded themselves).
    prisma.cashRemittance.findMany({
      where: { riderId, decidedAt: { not: null }, status: { in: ["CONFIRMED", "DISPUTED"] } },
      orderBy: { decidedAt: "desc" },
      take: SOURCE_LIMIT,
      select: { id: true, amount: true, currency: true, status: true, source: true, adminNote: true, decidedAt: true },
    }),
    prisma.riderDocument.findMany({
      where: { riderId, reviewedAt: { not: null }, status: { in: ["VERIFIED", "REJECTED"] } },
      select: { id: true, type: true, status: true, reviewedAt: true, note: true },
    }),
    // Notifications the rider opened one by one (see NotificationRead).
    prisma.notificationRead.findMany({
      where: { userId: riderId },
      select: { notificationId: true },
    }),
  ]);
  const openedIds = new Set(opened.map((row) => row.notificationId));

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

  for (const payout of payouts) {
    if (!payout.processedAt) continue;
    const amount = formatAmount(payout.amount.toNumber(), payout.currency);
    const paid = payout.status === "PAID";
    feed.push({
      id: `payout-${payout.id}`,
      kind: "PAYOUT",
      title: paid ? `Cash out of ${amount} paid` : `Cash out of ${amount} was not approved`,
      description: paid
        ? `Sent to ${payout.destination}`
        : `${payout.note ? `Reason: ${payout.note} · ` : ""}The money is back in your balance`,
      createdAt: payout.processedAt.toISOString(),
      read: isRead(payout.processedAt),
      href: `${BASE}/earnings`,
    });
  }

  for (const handover of handovers) {
    if (!handover.decidedAt) continue;
    const amount = formatAmount(handover.amount.toNumber(), handover.currency);
    const confirmed = handover.status === "CONFIRMED";
    feed.push({
      id: `cash-${handover.id}`,
      kind: "PAYOUT",
      title: confirmed
        ? handover.source === "ADMIN"
          ? `Cash received: ${amount}`
          : `Cash hand-in of ${amount} confirmed`
        : `Cash hand-in of ${amount} was not confirmed`,
      description: confirmed
        ? handover.source === "ADMIN"
          ? "The restaurant recorded the cash you handed in"
          : "The restaurant received it — it's off what you owe"
        : `${handover.adminNote ? `Reason: ${handover.adminNote} · ` : ""}It still counts as with you`,
      createdAt: handover.decidedAt.toISOString(),
      read: isRead(handover.decidedAt),
      href: `${BASE}/cash`,
    });
  }

  for (const doc of documents) {
    if (!doc.reviewedAt) continue;
    const label = documentLabel(doc.type);
    const verified = doc.status === "VERIFIED";
    feed.push({
      id: `document-${doc.id}-${doc.reviewedAt.getTime()}`,
      kind: "DOCUMENT",
      title: verified ? `${label} verified` : `${label} needs a new upload`,
      description: verified
        ? "The restaurant checked it — you're all set"
        : doc.note
          ? `Reason: ${doc.note}`
          : "Please upload it again from your Profile",
      createdAt: doc.reviewedAt.toISOString(),
      read: isRead(doc.reviewedAt),
      href: "/admin/profile",
    });
  }

  // Opening a notification marks just that one as read, on top of the
  // "Mark All as Read" timestamp.
  for (const item of feed) {
    if (!item.read && openedIds.has(item.id)) item.read = true;
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
  { value: "PAYOUT", label: "Payouts" },
  { value: "DOCUMENT", label: "Documents" },
] as const;

export type RiderNotificationType = (typeof RIDER_NOTIFICATION_TYPES)[number]["value"];

export function isRiderNotificationType(value: unknown): value is RiderNotificationType {
  return RIDER_NOTIFICATION_TYPES.some((option) => option.value === value);
}
