import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";
import { sum, toMoney } from "@/lib/money";
import { formatQuantity } from "@/lib/inventory-status";
import { OPEN_PURCHASE_ORDER_STATUSES } from "@/lib/supplier-status";
import { purchaseOrderRef, supplierOrderUrl } from "@/lib/supplier-order-token";
import SupplierOrderEmail from "@/emails/SupplierOrderEmail";

/**
 * src/lib/supplier-order.ts
 *
 * The restock → supplier → admin loop, in one place:
 *
 *   1. Staff press Restock (or add an ingredient with "order now")
 *        → placeSupplierOrder()    Pending order (ORDERED) + email to supplier
 *   2. Supplier opens the emailed link and presses Accept
 *        → acceptPurchaseOrderAsSupplier()   ORDERED → ON_THE_WAY, admins notified
 *   3. The goods arrive and staff press "Confirm delivery"
 *        → receivePurchaseOrder() (lib/receive-purchase-order.ts)
 *          ON_THE_WAY → RECEIVED, and ONLY now the stock goes up.
 *
 * ⚠️ Nothing here touches InventoryItem.currentStock — see step 3.
 */

type SupplierCheck =
  | { ok: true; supplier: { id: string; name: string; email: string } }
  | { ok: false; status: number; error: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Can this supplier be sent an order at all? Checked BEFORE anything is
 * created, so a supplier without an email address never leaves behind an order
 * that nobody was told about.
 */
export async function checkSupplierCanReceiveOrders(
  supplierId: string | null | undefined
): Promise<SupplierCheck> {
  if (!supplierId) {
    return { ok: false, status: 400, error: "Pick a supplier to order from." };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!supplier) {
    return { ok: false, status: 404, error: "Supplier not found." };
  }
  if (!supplier.isActive) {
    return {
      ok: false,
      status: 409,
      error: `${supplier.name} is inactive — pick an active supplier, or reactivate them on the Suppliers page.`,
    };
  }
  const email = supplier.email?.trim() ?? "";
  if (!EMAIL_SHAPE.test(email)) {
    return {
      ok: false,
      status: 422,
      error: `${supplier.name} has no email address, so the order can't be sent. Add one on the Suppliers page first.`,
    };
  }
  return { ok: true, supplier: { id: supplier.id, name: supplier.name, email } };
}

type EmailOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Emails the supplier about a Pending order (first send, or "Resend").
 *
 * Never throws. A failed email does NOT undo the order — it stays Pending with
 * `supplierEmailedAt` empty, and the Recent Deliveries row offers "Resend".
 */
export async function emailSupplierAboutOrder(purchaseOrderId: string): Promise<EmailOutcome> {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        status: true,
        note: true,
        supplierEmailedAt: true,
        supplier: { select: { name: true, email: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            quantityOrdered: true,
            inventoryItem: { select: { name: true, unit: true } },
          },
        },
      },
    });
    if (!po) return { ok: false, reason: "order not found" };
    if (po.status !== "ORDERED") return { ok: false, reason: "order is no longer pending" };

    const to = po.supplier.email?.trim() ?? "";
    if (!EMAIL_SHAPE.test(to)) {
      return { ok: false, reason: `${po.supplier.name} has no email address` };
    }

    const ref = purchaseOrderRef(po.id);
    const isReminder = po.supplierEmailedAt !== null;

    const result = await sendEmail({
      tag: "supplier-order",
      to,
      subject: `${isReminder ? "Reminder: " : ""}New order ${ref} from Cuisine`,
      // A fresh key per attempt: a retry inside sendEmail must not double-send,
      // but a deliberate "Resend" a minute later must actually go out.
      idempotencyKey: `supplier-order/${po.id}/${Date.now()}`,
      react: SupplierOrderEmail({
        supplierName: po.supplier.name,
        orderRef: ref,
        lines: po.items.map((line) => ({
          name: line.inventoryItem.name,
          quantity: formatQuantity(line.quantityOrdered, line.inventoryItem.unit),
        })),
        note: po.note,
        acceptUrl: supplierOrderUrl(po.id),
        isReminder,
        previewText: `Cuisine would like to order ${po.items.length} ${
          po.items.length === 1 ? "item" : "items"
        } from you — please accept the order.`,
      }),
    });

    if (!result.ok) return { ok: false, reason: result.reason };

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { supplierEmailedAt: new Date() },
    });
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[supplier-order] couldn't email supplier for ${purchaseOrderId} — ${reason}`);
    return { ok: false, reason };
  }
}

type PlaceOrderInput = {
  inventoryItemId: string;
  supplierId: string;
  quantity: number;
  /** Falls back to the ingredient's current cost. */
  costPerUnit?: number;
  note?: string;
  createdById: string;
};

type PlaceOrderResult =
  | {
      ok: true;
      purchaseOrder: { id: string; status: string };
      supplierName: string;
      emailed: boolean;
      emailError?: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Creates a Pending (ORDERED) purchase order for one ingredient and emails the
 * supplier.
 *
 * ⚠️ The supplier is checked first; the order is only created if the email has
 * somewhere to go. If the email itself then fails (mail provider down) the
 * order is kept — it's real, the restaurant wants the goods — and the caller
 * gets `emailed: false` so the UI can say "saved, but not sent yet".
 */
export async function placeSupplierOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const check = await checkSupplierCanReceiveOrders(input.supplierId);
  if (!check.ok) return check;

  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
    select: { id: true, costPerUnit: true, supplierId: true },
  });
  if (!item) return { ok: false, status: 404, error: "Inventory item not found." };

  const costPerUnit = input.costPerUnit ?? Number(item.costPerUnit);
  const totalCost = sum(toMoney(costPerUnit).times(input.quantity));

  const purchaseOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        supplierId: check.supplier.id,
        status: "ORDERED",
        orderedAt: new Date(),
        note: input.note?.trim() || null,
        totalCost,
        createdById: input.createdById,
        items: {
          create: [
            {
              inventoryItemId: item.id,
              quantityOrdered: input.quantity,
              costPerUnit,
            },
          ],
        },
      },
      select: { id: true, status: true },
    });

    // Ordering from a supplier makes them the ingredient's usual supplier
    // (what the old Restock did) — only when it changes.
    if (item.supplierId !== check.supplier.id) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { supplierId: check.supplier.id },
      });
    }

    return created;
  });

  const mail = await emailSupplierAboutOrder(purchaseOrder.id);

  return {
    ok: true,
    purchaseOrder,
    supplierName: check.supplier.name,
    emailed: mail.ok,
    ...(mail.ok ? {} : { emailError: mail.reason }),
  };
}

type AcceptResult =
  | { ok: true; status: string; alreadyAccepted: boolean }
  | { ok: false; reason: "cancelled" | "not_found" };

/**
 * The supplier pressed "Accept" on the emailed link: ORDERED → ON_THE_WAY.
 *
 * ⚠️ One conditional UPDATE (… WHERE status = 'ORDERED'), so a double click or
 * two open tabs can't accept twice. Pressing it again on an already accepted or
 * delivered order is answered "fine, already done" — never an error.
 */
export async function acceptPurchaseOrderAsSupplier(
  purchaseOrderId: string
): Promise<AcceptResult> {
  const claimed = await prisma.purchaseOrder.updateMany({
    where: { id: purchaseOrderId, status: "ORDERED" },
    data: { status: "ON_THE_WAY", acceptedAt: new Date() },
  });
  if (claimed.count === 1) {
    return { ok: true, status: "ON_THE_WAY", alreadyAccepted: false };
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { status: true },
  });
  if (!po || po.status === "DRAFT") return { ok: false, reason: "not_found" };
  if (po.status === "CANCELLED") return { ok: false, reason: "cancelled" };
  return { ok: true, status: po.status, alreadyAccepted: true };
}

/**
 * Open (Pending or On the Way) ordered quantity per ingredient — so the Restock
 * modal can warn "you already have 12 Kg on order" before staff order the same
 * thing twice.
 */
export async function getOpenOrderQuantities(
  inventoryItemIds?: string[]
): Promise<Map<string, { quantity: number; status: string; supplierName: string }>> {
  const lines = await prisma.purchaseOrderItem.findMany({
    where: {
      ...(inventoryItemIds ? { inventoryItemId: { in: inventoryItemIds } } : {}),
      purchaseOrder: { status: { in: [...OPEN_PURCHASE_ORDER_STATUSES] } },
    },
    select: {
      inventoryItemId: true,
      quantityOrdered: true,
      purchaseOrder: { select: { status: true, supplier: { select: { name: true } } } },
    },
  });

  const byItem = new Map<string, { quantity: number; status: string; supplierName: string }>();
  for (const line of lines) {
    const existing = byItem.get(line.inventoryItemId);
    if (existing) {
      existing.quantity += line.quantityOrdered;
      // "On the way" is further along than "Pending" — show the latest stage.
      if (line.purchaseOrder.status === "ON_THE_WAY") existing.status = "ON_THE_WAY";
    } else {
      byItem.set(line.inventoryItemId, {
        quantity: line.quantityOrdered,
        status: line.purchaseOrder.status,
        supplierName: line.purchaseOrder.supplier.name,
      });
    }
  }
  return byItem;
}
