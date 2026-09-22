import { Prisma } from "@/generated/prisma/client";

/**
 * src/lib/net-revenue.ts
 *
 * "Net sales" for a set of orders — the one revenue formula the dashboard
 * and the Insights page both show, kept in one place so the two pages can
 * never disagree about the same period.
 *
 * Three things are taken out, all standard accounting practice:
 *
 *   • Tax — it sits inside grandTotal (added on top in EXCLUSIVE mode,
 *     hidden inside in INCLUSIVE mode), but it is the government's money.
 *     `grandTotal − taxAmount` is right in both modes.
 *
 *   • Tips — already outside grandTotal (they are added after it, into
 *     totalAmount), and in most countries legally the staff's money.
 *
 *   • Refunds — split in proportion: the share of the bill that was
 *     revenue is the share of the refund that comes off revenue; the rest
 *     is tax being handed back, which was never ours anyway.
 *
 * ⚠️ Gift cards and loyalty points are NOT taken out. They are ways of
 * paying, not discounts — the revenue was counted the day the gift card
 * was sold. They live outside grandTotal (in totalAmount), so this formula
 * never touches them.
 *
 * Pass the `_sum` of a prisma.order.aggregate over
 * `{ grandTotal, taxAmount, refundedAmount }`.
 */
export interface RevenueSums {
  _sum: {
    grandTotal: Prisma.Decimal | null;
    taxAmount: Prisma.Decimal | null;
    refundedAmount: Prisma.Decimal | null;
  };
}

const ZERO = new Prisma.Decimal(0);

export function netRevenueOf(agg: RevenueSums): Prisma.Decimal {
  const gross = agg._sum.grandTotal ?? ZERO;
  const tax = agg._sum.taxAmount ?? ZERO;
  const refunded = agg._sum.refundedAmount ?? ZERO;

  const net = gross.minus(tax);
  if (gross.lte(0) || refunded.lte(0)) return net;

  // Clamped, because refundedAmount is measured against totalAmount — which
  // includes the tip — so in theory a full refund of a big-tip order could
  // be larger than net.
  const revenueRefunded = Prisma.Decimal.min(refunded.times(net).dividedBy(gross), net);
  return net.minus(revenueRefunded);
}
