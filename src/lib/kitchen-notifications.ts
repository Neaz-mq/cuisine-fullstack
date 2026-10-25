/**
 * src/lib/kitchen-notifications.ts
 *
 * The KITCHEN role's Notification feed — the rules only, no database.
 * kitchen-notifications-data.ts fetches the rows and hands them to
 * `buildKitchenNotifications`, so every rule here is unit-tested
 * (lib/__tests__/kitchen-notifications.test.ts).
 *
 * Like the admin and rider feeds there is no Notification table: the feed is
 * read off what actually happened, so it can never go stale.
 *
 *   • a PLACED order arrived                       → ORDER     (new ticket)
 *   • a PLACED order has waited too long           → DELAYED   (system alert)
 *   • an order was cancelled (last 24 h)           → CANCELLED (system alert)
 *   • an ingredient is low / at emergency / out    → STOCK     (system alert)
 *   • a supplier accepted a restock order          → SUPPLY    (confirm on arrival)
 *   • another cook added a prep task today         → PREP
 *
 * ⚠️ No prices anywhere: the kitchen doesn't see money (see
 * kitchen-dashboard-data.ts), so an order reads "Rahim · Table T-5 · 3 items".
 *
 * ⚠️ No Prisma import — keeping this file database-free means it is safe for
 * any caller (see notification-filters.ts for why that matters).
 */
import { formatOrderId } from "@/lib/format-order-id";
import { WAITING_ATTENTION_MINUTES } from "@/lib/kitchen-dashboard";
import { formatQuantity, stockStateOf } from "@/lib/inventory-status";
import type { AdminNotification } from "@/lib/notification-filters";

const LIVE_ORDERS = "/admin/kitchen";
const PREP_LIST = "/admin/kitchen/prep";
const INVENTORY = "/admin/kitchen/inventory";
const SUPPLIERS = "/admin/kitchen/suppliers";

export type KitchenOrderRow = {
  id: string;
  /** createdAt for PLACED rows, updatedAt for CANCELLED rows. */
  at: Date;
  firstName: string;
  orderType: "DELIVERY" | "DINE_IN";
  tableLabel: string | null;
  itemCount: number;
};

export type KitchenStockRow = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  emergencyThreshold: number;
  updatedAt: Date;
};

export type KitchenSupplyRow = {
  id: string;
  acceptedAt: Date;
  supplierName: string;
  lines: { name: string; unit: string; quantity: number }[];
};

export type KitchenPrepTaskRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  createdAt: Date;
};

export type KitchenFeedInput = {
  now: Date;
  /** "Mark All as Read" timestamp (StaffProfile.notificationsReadAt). */
  readAt: Date | null;
  /** Ids opened one by one (NotificationRead). */
  openedIds: ReadonlySet<string>;
  /** Settings → Notifications switches; null = no settings row yet (both on). */
  settings: { lowStockAlerts: boolean; emergencyStockAlerts: boolean } | null;
  placed: KitchenOrderRow[];
  cancelled: KitchenOrderRow[];
  stock: KitchenStockRow[];
  supply: KitchenSupplyRow[];
  prep: KitchenPrepTaskRow[];
};

/** "Rahim · Table T-5 · 3 items" / "Rahim · Delivery · 1 item". */
export function describeKitchenOrder(order: KitchenOrderRow): string {
  const where = order.orderType === "DINE_IN" ? `Table ${order.tableLabel ?? "—"}` : "Delivery";
  const items = `${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`;
  return `${order.firstName} · ${where} · ${items}`;
}

export function buildKitchenNotifications(input: KitchenFeedInput): AdminNotification[] {
  const { now, readAt, openedIds, settings } = input;

  // ⚠️ `readAt` null = "Mark All as Read" was never pressed → everything is
  // unread, which is the correct behaviour (same rule as the admin feed).
  const isRead = (at: Date) => readAt !== null && at.getTime() <= readAt.getTime();
  const lowOn = settings?.lowStockAlerts ?? true;
  const emergencyOn = settings?.emergencyStockAlerts ?? true;

  const feed: AdminNotification[] = [];

  for (const order of input.placed) {
    feed.push({
      id: `order-${order.id}`,
      kind: "ORDER",
      title: "New order placed",
      description: `Order ${formatOrderId(order.id)} · ${describeKitchenOrder(order)}`,
      createdAt: order.at.toISOString(),
      read: isRead(order.at),
      href: LIVE_ORDERS,
    });

    // An order still PLACED after WAITING_ATTENTION_MINUTES. Its time is the
    // moment it BECAME late (placed + 10 min), not "now" — a fixed time is
    // what lets "read" stay read between page loads, and it is never in the
    // future because we only get here once that moment has passed.
    const lateAt = new Date(order.at.getTime() + WAITING_ATTENTION_MINUTES * 60_000);
    if (lateAt.getTime() <= now.getTime()) {
      const waited = Math.max(
        WAITING_ATTENTION_MINUTES,
        Math.floor((now.getTime() - order.at.getTime()) / 60_000)
      );
      feed.push({
        id: `delayed-${order.id}`,
        kind: "DELAYED",
        title: "Order waiting too long",
        description: `Order ${formatOrderId(order.id)} · ${describeKitchenOrder(order)} — waiting ${waited} min, start it now`,
        createdAt: lateAt.toISOString(),
        read: isRead(lateAt),
        href: LIVE_ORDERS,
      });
    }
  }

  for (const order of input.cancelled) {
    feed.push({
      id: `cancelled-${order.id}`,
      kind: "CANCELLED",
      title: "Order cancelled",
      description: `Order ${formatOrderId(order.id)} · ${describeKitchenOrder(order)} — stop preparing it`,
      createdAt: order.at.toISOString(),
      read: isRead(order.at),
      href: LIVE_ORDERS,
    });
  }

  for (const item of input.stock) {
    const state = stockStateOf(item);
    if (state === "in-stock") continue;

    const left = formatQuantity(item.currentStock, item.unit);
    const critical = state === "emergency" || state === "out";

    // Same switches as the admin feed: emergency off → an emergency item is
    // still below its reorder level, so it reads as a plain low-stock alert;
    // low off → nothing for a merely-low item.
    if (critical ? !emergencyOn && !lowOn : !lowOn) continue;
    const asEmergency = critical && emergencyOn;

    const description =
      state === "out"
        ? `${item.name} is out of stock`
        : asEmergency
          ? `${item.name} is at emergency level — only ${left} left`
          : `${item.name} is running low — only ${left} left`;

    feed.push({
      id: `stock-${item.id}`,
      kind: "STOCK",
      title: asEmergency ? "Emergency stock alert" : "Low stock alert",
      description,
      createdAt: item.updatedAt.toISOString(),
      read: isRead(item.updatedAt),
      href: INVENTORY,
    });
  }

  for (const po of input.supply) {
    const lines = po.lines
      .map((line) => `${formatQuantity(line.quantity, line.unit)} ${line.name}`)
      .join(", ");
    feed.push({
      id: `supply-${po.id}`,
      kind: "SUPPLY",
      title: "Delivery on the way",
      description: `${po.supplierName} accepted the order${lines ? ` for ${lines}` : ""} — confirm it when it arrives`,
      createdAt: po.acceptedAt.toISOString(),
      read: isRead(po.acceptedAt),
      href: SUPPLIERS,
    });
  }

  for (const task of input.prep) {
    feed.push({
      id: `prep-${task.id}`,
      kind: "PREP",
      title: "New prep task",
      description: `${task.name} · ${formatQuantity(task.quantity, task.unit)} added to today's Prep List`,
      createdAt: task.createdAt.toISOString(),
      read: isRead(task.createdAt),
      href: PREP_LIST,
    });
  }

  // Opening a notification marks just that one as read, on top of the
  // "Mark All as Read" timestamp.
  for (const item of feed) {
    if (!item.read && openedIds.has(item.id)) item.read = true;
  }

  // Newest first; the id breaks ties so the order is stable between loads.
  return feed.sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt)
  );
}

/** Kitchen Notification page → "All ⌄": what kind of notification. */
export const KITCHEN_NOTIFICATION_TYPES = [
  { value: "ALL", label: "All" },
  { value: "ORDER", label: "New Orders" },
  { value: "DELAYED", label: "Delayed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "STOCK", label: "Stock" },
  { value: "SUPPLY", label: "Deliveries" },
  { value: "PREP", label: "Prep Tasks" },
] as const;

export type KitchenNotificationType = (typeof KITCHEN_NOTIFICATION_TYPES)[number]["value"];

export function isKitchenNotificationType(value: unknown): value is KitchenNotificationType {
  return KITCHEN_NOTIFICATION_TYPES.some((option) => option.value === value);
}

/**
 * What the header bell polls: how many unread items there are (no `since`),
 * or how many unread items appeared after `since`; plus the newest item's
 * time to use as the next `since`.
 */
export function kitchenBellCounts(
  feed: AdminNotification[],
  since: Date | null
): { newCount: number; latestAt: string | null } {
  const newCount = feed.filter(
    (item) => !item.read && (!since || new Date(item.createdAt) > since)
  ).length;
  // The feed is sorted newest-first.
  return { newCount, latestAt: feed[0]?.createdAt ?? null };
}
