/**
 * src/lib/kitchen-notifications-data.ts
 *
 * Fetches the rows behind the KITCHEN role's Notification feed and hands them
 * to the pure builder (lib/kitchen-notifications.ts). Used by the page, the
 * export, the header bell's API and the sidebar badge — one function, so all
 * four always show the same numbers.
 *
 * ⚠️ Read-only and role-agnostic in the same narrow way kitchen-dashboard-
 * data.ts is: no prices, costs or contact details are selected.
 */
import { prisma } from "@/lib/prisma";
import {
  buildKitchenNotifications,
  type KitchenOrderRow,
} from "@/lib/kitchen-notifications";
import type { AdminNotification } from "@/lib/notification-filters";

/** Newest rows pulled from each source before the feed is merged. */
const SOURCE_LIMIT = 40;

/** A cancellation older than this is history, not something to act on. */
const CANCELLED_WINDOW_HOURS = 24;

/** Local midnight — "today" follows the restaurant's time zone. */
function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const ORDER_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  firstName: true,
  orderType: true,
  table: { select: { label: true } },
  items: { select: { quantity: true } },
} as const;

type OrderRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  firstName: string;
  orderType: "DELIVERY" | "DINE_IN";
  table: { label: string } | null;
  items: { quantity: number }[];
};

function toOrderRow(order: OrderRecord, at: Date): KitchenOrderRow {
  return {
    id: order.id,
    at,
    firstName: order.firstName,
    orderType: order.orderType,
    tableLabel: order.table?.label ?? null,
    itemCount: order.items.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function getKitchenNotifications(
  userId: string,
  readAt: Date | null,
  now: Date = new Date()
): Promise<AdminNotification[]> {
  const cancelledSince = new Date(now.getTime() - CANCELLED_WINDOW_HOURS * 60 * 60 * 1000);

  const [settings, placed, cancelled, stock, supply, prep, opened] = await Promise.all([
    // Settings → Notifications — the two stock-alert switches.
    prisma.restaurantSettings.findUnique({
      where: { id: "singleton" },
      select: { lowStockAlerts: true, emergencyStockAlerts: true },
    }),

    // Orders still waiting on the Live Orders board.
    prisma.order.findMany({
      where: { status: "PLACED" },
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: ORDER_SELECT,
    }),

    // Cancelled in the last day — the cook may already be working on one.
    prisma.order.findMany({
      where: { status: "CANCELLED", updatedAt: { gte: cancelledSince } },
      orderBy: { updatedAt: "desc" },
      take: SOURCE_LIMIT,
      select: ORDER_SELECT,
    }),

    // Time = `updatedAt` ("when the stock last moved"), the same trade-off the
    // admin feed documents. Whether an item is actually low is decided in the
    // pure builder, so the list is pulled wide and filtered there.
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderThreshold: true,
        emergencyThreshold: true,
        updatedAt: true,
      },
    }),

    // Restock orders a supplier accepted that are still on the way — a
    // to-do ("confirm it when it comes"), so it leaves the feed once received.
    prisma.purchaseOrder.findMany({
      where: { status: "ON_THE_WAY", acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        acceptedAt: true,
        supplier: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            quantityOrdered: true,
            inventoryItem: { select: { name: true, unit: true } },
          },
        },
      },
    }),

    // Prep tasks ANOTHER cook added today and nobody finished. Your own tasks
    // are not news to you, and yesterday's list is yesterday's shift.
    // ⚠️ `createdById` is nullable, and SQL `NOT =` skips NULLs — hence the OR.
    prisma.prepTask.findMany({
      where: {
        done: false,
        createdAt: { gte: startOfDay(now) },
        OR: [{ createdById: null }, { createdById: { not: userId } }],
      },
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: { id: true, name: true, quantity: true, unit: true, createdAt: true },
    }),

    // Notifications this person opened one by one (see NotificationRead).
    prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
    }),
  ]);

  return buildKitchenNotifications({
    now,
    readAt,
    openedIds: new Set(opened.map((row) => row.notificationId)),
    settings,
    placed: placed.map((order) => toOrderRow(order, order.createdAt)),
    cancelled: cancelled.map((order) => toOrderRow(order, order.updatedAt)),
    stock,
    supply: supply.flatMap((po) =>
      po.acceptedAt
        ? [
            {
              id: po.id,
              acceptedAt: po.acceptedAt,
              supplierName: po.supplier.name,
              lines: po.items.map((line) => ({
                name: line.inventoryItem.name,
                unit: line.inventoryItem.unit,
                quantity: line.quantityOrdered,
              })),
            },
          ]
        : []
    ),
    prep,
  });
}

/** The signed-in person's own feed (their "Mark All as Read" mark applied). */
export async function getKitchenNotificationsFor(userId: string): Promise<AdminNotification[]> {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { notificationsReadAt: true },
  });
  return getKitchenNotifications(userId, profile?.notificationsReadAt ?? null);
}

/**
 * Sidebar badge on "Notification" and the header bell's first count: how many
 * are still unread for THIS person — the same feed the page shows.
 */
export async function countUnreadKitchenNotifications(userId: string): Promise<number> {
  const feed = await getKitchenNotificationsFor(userId);
  return feed.filter((item) => !item.read).length;
}
