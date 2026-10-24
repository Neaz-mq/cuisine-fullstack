import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The restock → supplier → admin loop, against a tiny in-memory "database"
 * (same approach as refund-order.test.ts): the status guards
 * (`where: { id, status: "ORDERED" }`) match or don't exactly as Postgres
 * would decide, so double-accept / double-receive are really exercised.
 */

type PoRow = {
  id: string;
  status: string;
  supplierId: string;
  acceptedAt: Date | null;
  supplierEmailedAt: Date | null;
  receivedAt: Date | null;
  note: string | null;
  items: { id: string; inventoryItemId: string; quantityOrdered: number; costPerUnit: number }[];
};

const db = {
  po: new Map<string, PoRow>(),
  suppliers: new Map<
    string,
    { id: string; name: string; email: string | null; isActive: boolean }
  >(),
  stock: new Map<string, { currentStock: number; costPerUnit: number; supplierId: string | null }>(),
  movements: [] as { inventoryItemId: string; quantityChange: number }[],
  poCreateCount: 0,
};

const sendEmailMock = vi.fn();

vi.mock("@/lib/send-email", () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    supplier: {
      findUnique: async ({ where }: { where: { id: string } }) => db.suppliers.get(where.id) ?? null,
    },
    inventoryItem: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = db.stock.get(where.id);
        return row ? { id: where.id, ...row } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.stock.get(where.id)!;
        const inc = (data.currentStock as { increment?: number } | undefined)?.increment;
        if (inc !== undefined) row.currentStock += inc;
        if (data.costPerUnit !== undefined) row.costPerUnit = Number(data.costPerUnit);
        if (data.supplierId !== undefined) row.supplierId = data.supplierId as string;
        return { ...row };
      },
    },
    purchaseOrder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.poCreateCount += 1;
        const id = `po${String(db.poCreateCount).padStart(12, "0")}abcdef`;
        const lines = (data.items as { create: PoRow["items"] }).create.map((l, i) => ({
          ...l,
          id: `line${i}`,
          costPerUnit: Number(l.costPerUnit),
        }));
        db.po.set(id, {
          id,
          status: data.status as string,
          supplierId: data.supplierId as string,
          acceptedAt: null,
          supplierEmailedAt: null,
          receivedAt: null,
          note: (data.note as string | null) ?? null,
          items: lines,
        });
        return { id, status: data.status };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const po = db.po.get(where.id);
        if (!po) return null;
        const supplier = db.suppliers.get(po.supplierId)!;
        return {
          ...po,
          supplier: { name: supplier.name, email: supplier.email },
          items: po.items.map((l) => ({
            ...l,
            inventoryItem: { name: "Chicken", unit: "KILOGRAM" },
          })),
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Partial<PoRow>;
      }) => {
        const po = db.po.get(where.id);
        if (!po || po.status !== where.status) return { count: 0 };
        Object.assign(po, data);
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<PoRow> }) => {
        const po = db.po.get(where.id)!;
        Object.assign(po, data);
        return po;
      },
    },
    purchaseOrderItem: { update: async () => ({}) },
    stockMovement: {
      create: async ({ data }: { data: { inventoryItemId: string; quantityChange: number } }) => {
        db.movements.push({
          inventoryItemId: data.inventoryItemId,
          quantityChange: data.quantityChange,
        });
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

import {
  acceptPurchaseOrderAsSupplier,
  checkSupplierCanReceiveOrders,
  emailSupplierAboutOrder,
  placeSupplierOrder,
} from "@/lib/supplier-order";
import { receivePurchaseOrder } from "@/lib/receive-purchase-order";

const ITEM = "item000000000000000000001";
const SUP = "sup000000000000000000001";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret";
  db.po.clear();
  db.suppliers.clear();
  db.stock.clear();
  db.movements.length = 0;
  db.poCreateCount = 0;
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true, id: "email_1" });
  db.suppliers.set(SUP, { id: SUP, name: "Agro Culture", email: "agro@example.com", isActive: true });
  db.stock.set(ITEM, { currentStock: 2, costPerUnit: 30, supplierId: null });
});

describe("placing an order", () => {
  it("creates a Pending order, emails the supplier, and leaves stock alone", async () => {
    const result = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.emailed).toBe(true);
    expect(db.po.get(result.purchaseOrder.id)?.status).toBe("ORDERED");
    expect(db.po.get(result.purchaseOrder.id)?.supplierEmailedAt).not.toBeNull();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe("agro@example.com");
    // Stock must NOT move until the delivery is confirmed.
    expect(db.stock.get(ITEM)?.currentStock).toBe(2);
    expect(db.movements).toHaveLength(0);
  });

  it("refuses (and creates nothing) when the supplier has no email", async () => {
    db.suppliers.set(SUP, { id: SUP, name: "Agro Culture", email: null, isActive: true });
    const result = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 5,
      createdById: "user1",
    });
    expect(result.ok).toBe(false);
    expect(db.po.size).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("refuses an inactive supplier", async () => {
    db.suppliers.set(SUP, { id: SUP, name: "Old Co", email: "a@b.co", isActive: false });
    const check = await checkSupplierCanReceiveOrders(SUP);
    expect(check.ok).toBe(false);
  });

  it("keeps the order, unemailed, when the mail provider fails — Resend can retry", async () => {
    sendEmailMock.mockResolvedValueOnce({ ok: false, reason: "provider down" });
    const result = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 5,
      createdById: "user1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.emailed).toBe(false);
    expect(db.po.get(result.purchaseOrder.id)?.supplierEmailedAt).toBeNull();

    const retry = await emailSupplierAboutOrder(result.purchaseOrder.id);
    expect(retry.ok).toBe(true);
    expect(db.po.get(result.purchaseOrder.id)?.supplierEmailedAt).not.toBeNull();
  });

  it("won't email about an order that's no longer pending", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 5,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    await acceptPurchaseOrderAsSupplier(placed.purchaseOrder.id);
    sendEmailMock.mockClear();
    const again = await emailSupplierAboutOrder(placed.purchaseOrder.id);
    expect(again.ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("the full loop", () => {
  it("Pending → supplier accepts → On the Way → admin confirms → Delivered (+stock)", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    const id = placed.purchaseOrder.id;

    // Staff can't receive something the supplier hasn't accepted.
    const early = await receivePurchaseOrder(id, undefined, "user1");
    expect(early).toEqual({ ok: false, error: "The supplier hasn't accepted this order yet" });
    expect(db.stock.get(ITEM)?.currentStock).toBe(2);

    const accepted = await acceptPurchaseOrderAsSupplier(id);
    expect(accepted).toEqual({ ok: true, status: "ON_THE_WAY", alreadyAccepted: false });
    expect(db.po.get(id)?.status).toBe("ON_THE_WAY");
    expect(db.po.get(id)?.acceptedAt).not.toBeNull();
    expect(db.stock.get(ITEM)?.currentStock).toBe(2); // still not credited

    const received = await receivePurchaseOrder(id, undefined, "user1");
    expect(received.ok).toBe(true);
    expect(db.po.get(id)?.status).toBe("RECEIVED");
    expect(db.stock.get(ITEM)?.currentStock).toBe(14);
    expect(db.movements).toEqual([{ inventoryItemId: ITEM, quantityChange: 12 }]);
  });

  it("accepting twice is harmless", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    await acceptPurchaseOrderAsSupplier(placed.purchaseOrder.id);
    const second = await acceptPurchaseOrderAsSupplier(placed.purchaseOrder.id);
    expect(second).toEqual({ ok: true, status: "ON_THE_WAY", alreadyAccepted: true });
  });

  it("receiving twice credits stock only once", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    const id = placed.purchaseOrder.id;
    await acceptPurchaseOrderAsSupplier(id);

    const [a, b] = await Promise.all([
      receivePurchaseOrder(id, undefined, "user1"),
      receivePurchaseOrder(id, undefined, "user2"),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(db.stock.get(ITEM)?.currentStock).toBe(14);
    expect(db.movements).toHaveLength(1);
  });

  it("a cancelled order can't be accepted", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    db.po.get(placed.purchaseOrder.id)!.status = "CANCELLED";
    expect(await acceptPurchaseOrderAsSupplier(placed.purchaseOrder.id)).toEqual({
      ok: false,
      reason: "cancelled",
    });
  });

  it("a short delivery credits what actually arrived", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    const id = placed.purchaseOrder.id;
    await acceptPurchaseOrderAsSupplier(id);
    const result = await receivePurchaseOrder(id, [{ inventoryItemId: ITEM, quantityReceived: 10 }], "u");
    expect(result.ok).toBe(true);
    expect(db.stock.get(ITEM)?.currentStock).toBe(12);
  });

  it("rejects a receive payload that doesn't match the order's lines", async () => {
    const placed = await placeSupplierOrder({
      inventoryItemId: ITEM,
      supplierId: SUP,
      quantity: 12,
      createdById: "user1",
    });
    if (!placed.ok) throw new Error("setup");
    const id = placed.purchaseOrder.id;
    await acceptPurchaseOrderAsSupplier(id);
    const result = await receivePurchaseOrder(
      id,
      [{ inventoryItemId: "someOtherItem000000000000", quantityReceived: 5 }],
      "u"
    );
    expect(result.ok).toBe(false);
    expect(db.stock.get(ITEM)?.currentStock).toBe(2);
  });
});
