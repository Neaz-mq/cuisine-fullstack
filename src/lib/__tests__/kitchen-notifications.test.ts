import { describe, expect, it } from "vitest";
import {
  buildKitchenNotifications,
  describeKitchenOrder,
  isKitchenNotificationType,
  kitchenBellCounts,
  type KitchenFeedInput,
  type KitchenOrderRow,
} from "@/lib/kitchen-notifications";
import { isAlertKind, notificationCounts } from "@/lib/notification-filters";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function order(overrides: Partial<KitchenOrderRow> = {}): KitchenOrderRow {
  return {
    id: "cmabc123456",
    at: minutesBefore(2),
    firstName: "Rahim",
    orderType: "DINE_IN",
    tableLabel: "T-5",
    itemCount: 3,
    ...overrides,
  };
}

function input(overrides: Partial<KitchenFeedInput> = {}): KitchenFeedInput {
  return {
    now: NOW,
    readAt: null,
    openedIds: new Set(),
    settings: null,
    placed: [],
    cancelled: [],
    stock: [],
    supply: [],
    prep: [],
    ...overrides,
  };
}

describe("describeKitchenOrder", () => {
  it("shows the table for dine-in and 'Delivery' otherwise, with no money", () => {
    expect(describeKitchenOrder(order())).toBe("Rahim · Table T-5 · 3 items");
    expect(describeKitchenOrder(order({ orderType: "DELIVERY", tableLabel: null, itemCount: 1 }))).toBe(
      "Rahim · Delivery · 1 item"
    );
  });
});

describe("new and delayed orders", () => {
  it("makes a New order notification for a fresh PLACED order, no delay yet", () => {
    const feed = buildKitchenNotifications(input({ placed: [order()] }));
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      id: "order-cmabc123456",
      kind: "ORDER",
      title: "New order placed",
      href: "/admin/kitchen",
      read: false,
    });
    expect(feed[0].description).toContain("#ORD-123456");
  });

  it("adds a DELAYED alert once an order has waited 10 minutes, timed at the moment it became late", () => {
    const placedAt = minutesBefore(15);
    const feed = buildKitchenNotifications(input({ placed: [order({ at: placedAt })] }));
    const delayed = feed.find((item) => item.kind === "DELAYED");
    expect(delayed).toBeDefined();
    expect(delayed!.id).toBe("delayed-cmabc123456");
    expect(delayed!.createdAt).toBe(new Date(placedAt.getTime() + 10 * 60_000).toISOString());
    expect(delayed!.description).toContain("waiting 15 min");
    expect(isAlertKind(delayed!.kind)).toBe(true);
  });

  it("does not flag an order as delayed before the 10 minute mark", () => {
    const feed = buildKitchenNotifications(input({ placed: [order({ at: minutesBefore(9) })] }));
    expect(feed.some((item) => item.kind === "DELAYED")).toBe(false);
  });
});

describe("cancelled orders", () => {
  it("raises a CANCELLED system alert", () => {
    const feed = buildKitchenNotifications(input({ cancelled: [order({ at: minutesBefore(5) })] }));
    expect(feed[0]).toMatchObject({ kind: "CANCELLED", title: "Order cancelled" });
    expect(isAlertKind(feed[0].kind)).toBe(true);
  });
});

describe("stock alerts", () => {
  const base = {
    id: "i1",
    name: "Mozzarella",
    unit: "KILOGRAM",
    updatedAt: minutesBefore(30),
  };

  it("ignores in-stock items and items with no thresholds set", () => {
    const feed = buildKitchenNotifications(
      input({
        stock: [
          { ...base, currentStock: 50, reorderThreshold: 10, emergencyThreshold: 5 },
          { ...base, id: "i2", currentStock: 3, reorderThreshold: 0, emergencyThreshold: 0 },
        ],
      })
    );
    expect(feed).toHaveLength(0);
  });

  it("separates low, emergency and out of stock", () => {
    const feed = buildKitchenNotifications(
      input({
        stock: [
          { ...base, id: "low", currentStock: 8, reorderThreshold: 10, emergencyThreshold: 4 },
          { ...base, id: "emg", currentStock: 3, reorderThreshold: 10, emergencyThreshold: 4 },
          { ...base, id: "out", currentStock: 0, reorderThreshold: 10, emergencyThreshold: 4 },
        ],
      })
    );
    const byId = Object.fromEntries(feed.map((item) => [item.id, item]));
    expect(byId["stock-low"].title).toBe("Low stock alert");
    expect(byId["stock-emg"].title).toBe("Emergency stock alert");
    expect(byId["stock-emg"].description).toContain("only 3 Kg left");
    expect(byId["stock-out"].description).toBe("Mozzarella is out of stock");
    expect(byId["stock-low"].href).toBe("/admin/kitchen/inventory");
  });

  it("respects the Settings switches", () => {
    const rows = [
      { ...base, id: "low", currentStock: 8, reorderThreshold: 10, emergencyThreshold: 4 },
      { ...base, id: "emg", currentStock: 3, reorderThreshold: 10, emergencyThreshold: 4 },
    ];
    // Low off: the low item disappears, the emergency one stays.
    let feed = buildKitchenNotifications(
      input({ stock: rows, settings: { lowStockAlerts: false, emergencyStockAlerts: true } })
    );
    expect(feed.map((item) => item.id)).toEqual(["stock-emg"]);
    // Emergency off: it is still below reorder level, so it reads as low stock.
    feed = buildKitchenNotifications(
      input({ stock: rows, settings: { lowStockAlerts: true, emergencyStockAlerts: false } })
    );
    expect(feed.every((item) => item.title === "Low stock alert")).toBe(true);
    expect(feed).toHaveLength(2);
    // Both off: nothing.
    feed = buildKitchenNotifications(
      input({ stock: rows, settings: { lowStockAlerts: false, emergencyStockAlerts: false } })
    );
    expect(feed).toHaveLength(0);
  });
});

describe("supply and prep", () => {
  it("lists the supplier's accepted order with its lines", () => {
    const feed = buildKitchenNotifications(
      input({
        supply: [
          {
            id: "po1",
            acceptedAt: minutesBefore(60),
            supplierName: "Fresh Farms",
            lines: [
              { name: "Tomato", unit: "KILOGRAM", quantity: 12.5 },
              { name: "Basil", unit: "PIECE", quantity: 4 },
            ],
          },
        ],
      })
    );
    expect(feed[0]).toMatchObject({
      kind: "SUPPLY",
      title: "Delivery on the way",
      href: "/admin/kitchen/suppliers",
    });
    expect(feed[0].description).toContain("Fresh Farms accepted the order for 12.5 Kg Tomato, 4 pcs Basil");
  });

  it("lists a prep task added by another cook", () => {
    const feed = buildKitchenNotifications(
      input({
        prep: [{ id: "t1", name: "Chop onions", quantity: 5, unit: "KILOGRAM", createdAt: minutesBefore(3) }],
      })
    );
    expect(feed[0]).toMatchObject({ kind: "PREP", href: "/admin/kitchen/prep" });
    expect(feed[0].description).toContain("Chop onions · 5 Kg");
  });
});

describe("read state and ordering", () => {
  it("treats everything as unread when Mark All as Read was never pressed", () => {
    const feed = buildKitchenNotifications(input({ placed: [order()] }));
    expect(feed.every((item) => !item.read)).toBe(true);
  });

  it("marks items at or before readAt as read, and later ones as unread", () => {
    const feed = buildKitchenNotifications(
      input({
        readAt: minutesBefore(5),
        placed: [order({ id: "old", at: minutesBefore(6) }), order({ id: "new", at: minutesBefore(2) })],
      })
    );
    const byId = Object.fromEntries(feed.map((item) => [item.id, item.read]));
    expect(byId["order-old"]).toBe(true);
    expect(byId["order-new"]).toBe(false);
  });

  it("counts an item opened one by one as read even when it is newer than readAt", () => {
    const feed = buildKitchenNotifications(
      input({ placed: [order({ id: "x1" })], openedIds: new Set(["order-x1"]) })
    );
    expect(feed[0].read).toBe(true);
  });

  it("sorts newest first", () => {
    const feed = buildKitchenNotifications(
      input({
        placed: [order({ id: "a", at: minutesBefore(8) }), order({ id: "b", at: minutesBefore(1) })],
        prep: [{ id: "t", name: "Dice", quantity: 1, unit: "KILOGRAM", createdAt: minutesBefore(4) }],
      })
    );
    expect(feed.map((item) => item.id)).toEqual(["order-b", "prep-t", "order-a"]);
  });

  it("feeds the Overview counts, with delayed/cancelled/stock as System Alerts", () => {
    const feed = buildKitchenNotifications(
      input({
        placed: [order({ at: minutesBefore(20) })],
        cancelled: [order({ id: "c1", at: minutesBefore(5) })],
      })
    );
    const counts = notificationCounts(feed);
    expect(counts.total).toBe(3); // order + delayed + cancelled
    expect(counts.alerts).toBe(2); // delayed + cancelled
    expect(counts.unread).toBe(3);
  });
});

describe("type filter and bell", () => {
  it("validates the ?type= value", () => {
    expect(isKitchenNotificationType("STOCK")).toBe(true);
    expect(isKitchenNotificationType("PAYOUT")).toBe(false);
    expect(isKitchenNotificationType(undefined)).toBe(false);
  });

  it("bell: counts all unread without `since`, only newer unread with it", () => {
    const feed = buildKitchenNotifications(
      input({
        readAt: minutesBefore(30),
        placed: [order({ id: "a", at: minutesBefore(8) }), order({ id: "b", at: minutesBefore(1) })],
      })
    );
    expect(kitchenBellCounts(feed, null).newCount).toBe(2);
    const since = minutesBefore(4);
    const counts = kitchenBellCounts(feed, since);
    expect(counts.newCount).toBe(1);
    expect(counts.latestAt).toBe(minutesBefore(1).toISOString());
  });

  it("bell: empty feed has no latestAt", () => {
    expect(kitchenBellCounts([], null)).toEqual({ newCount: 0, latestAt: null });
  });
});
