/**
 * src/lib/rider-cash.ts
 *
 * Cash-on-delivery money a rider holds for the restaurant, and the
 * hand-ins (CashRemittance rows) that settle it. The arithmetic itself is
 * in lib/cash-ledger.ts; this file only reads the rows.
 *
 * Who can write what — this is what keeps BOTH sides honest:
 *
 *   rider  → "I handed in $X"   a PENDING row, timestamped. If the owner
 *            forgets to record it, the rider still has a dated claim that
 *            the owner can see and has to answer (confirm or dispute).
 *   owner  → confirms or disputes that claim, or records cash received
 *            directly (a CONFIRMED row, source ADMIN) when the rider
 *            didn't report it first.
 *
 * Only CONFIRMED rows reduce what the rider owes. PENDING rows reduce what
 * the rider can still report, so one handful of cash can't be reported
 * twice. Nothing is ever deleted — a mistake is cancelled / disputed and
 * stays in the history.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cashTotals, oldestOwedSince, type CashOrder, type CashTotals } from "@/lib/cash-ledger";

type Db = typeof prisma | Prisma.TransactionClient;

export type RiderCash = CashTotals & { orders: CashOrder[] };

const COD_DELIVERED = {
  deliveredAt: { not: null },
  order: { status: "DELIVERED", paymentMethod: "COD" },
} satisfies Prisma.DeliveryTrackingWhereInput;

/** Every cash order this rider delivered, plus what has been handed in. */
export async function getRiderCash(riderId: string, db: Db = prisma): Promise<RiderCash> {
  const [rows, remittances] = await Promise.all([
    db.deliveryTracking.findMany({
      where: { riderId, ...COD_DELIVERED },
      orderBy: { deliveredAt: "asc" },
      select: { orderId: true, deliveredAt: true, order: { select: { totalAmount: true } } },
    }),
    db.cashRemittance.groupBy({
      by: ["status"],
      where: { riderId, status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { amount: true },
    }),
  ]);

  const orders: CashOrder[] = rows.map((row) => ({
    orderId: row.orderId,
    deliveredAt: row.deliveredAt,
    amount: row.order.totalAmount.toNumber(),
  }));
  const sumOf = (status: "PENDING" | "CONFIRMED") =>
    remittances.find((row) => row.status === status)?._sum.amount?.toNumber() ?? 0;

  const collected = orders.reduce((sum, order) => sum + order.amount, 0);
  return { ...cashTotals(collected, sumOf("CONFIRMED"), sumOf("PENDING")), orders };
}

export type RiderCashSummary = CashTotals & {
  riderId: string;
  name: string;
  email: string | null;
  /** Delivery time of the oldest cash order not yet confirmed as handed in. */
  oldestOwedSince: Date | null;
  cashOrders: number;
};

/**
 * Admin → Rider Cash: one row per rider who has ever collected cash.
 *
 * Grouped in JS, not SQL: Prisma can't group a DeliveryTracking by a
 * column of its related Order. The query reads three small columns only,
 * so it stays cheap until there are tens of thousands of cash deliveries.
 */
export async function getRiderCashSummaries(): Promise<RiderCashSummary[]> {
  const [rows, remittances] = await Promise.all([
    prisma.deliveryTracking.findMany({
      where: COD_DELIVERED,
      select: { riderId: true, orderId: true, deliveredAt: true, order: { select: { totalAmount: true } } },
    }),
    prisma.cashRemittance.groupBy({
      by: ["riderId", "status"],
      where: { status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { amount: true },
    }),
  ]);

  const byRider = new Map<string, CashOrder[]>();
  for (const row of rows) {
    const list = byRider.get(row.riderId) ?? [];
    list.push({ orderId: row.orderId, deliveredAt: row.deliveredAt, amount: row.order.totalAmount.toNumber() });
    byRider.set(row.riderId, list);
  }
  // A rider with a hand-in but (somehow) no cash orders still shows up.
  for (const row of remittances) if (!byRider.has(row.riderId)) byRider.set(row.riderId, []);

  const riderIds = [...byRider.keys()];
  if (riderIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: riderIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return riderIds
    .map((riderId) => {
      const orders = byRider.get(riderId) ?? [];
      const sumOf = (status: "PENDING" | "CONFIRMED") =>
        remittances.find((row) => row.riderId === riderId && row.status === status)?._sum.amount?.toNumber() ?? 0;
      const collected = orders.reduce((sum, order) => sum + order.amount, 0);
      const totals = cashTotals(collected, sumOf("CONFIRMED"), sumOf("PENDING"));
      const user = userById.get(riderId);
      return {
        riderId,
        name: user?.name || user?.email || "Rider",
        email: user?.email ?? null,
        ...totals,
        oldestOwedSince: oldestOwedSince(orders, totals.confirmed),
        cashOrders: orders.length,
      };
    })
    .sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}
