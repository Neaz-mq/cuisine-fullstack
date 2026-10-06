/**
 * src/lib/cash-ledger.ts
 *
 * The maths of "cash a rider collected vs. cash they handed in" — no
 * database, so it can be unit-tested and shared by the rider page, the
 * admin page and the API guards.
 *
 *   collected  = totalAmount of every cash-on-delivery order they delivered
 *   confirmed  = hand-ins the restaurant has CONFIRMED (the only ones that
 *                reduce what the rider owes)
 *   pending    = hand-ins the rider reported that the restaurant hasn't
 *                confirmed yet
 *
 *   owed       = collected − confirmed            the restaurant's view
 *   inHand     = collected − confirmed − pending what the rider can still
 *                                                 report as handed in
 *
 * Industry practice (Uber Eats / Foodpanda / Pathao style cash
 * reconciliation) is a running ledger, not a per-shift reset: every
 * delivered cash order adds to what is owed, every confirmed hand-in
 * subtracts from it, and the oldest orders are treated as settled first
 * (FIFO). That gives each order a clear "settled / not settled" state and
 * makes aging obvious ("this cash has been out for 4 days").
 */
import { roundMoney } from "@/lib/rider-stats";

/** Differences smaller than this are rounding noise, not money. */
const EPSILON = 0.005;

export type CashOrder = {
  orderId: string;
  deliveredAt: Date | null;
  amount: number;
};

/**
 * HANDED_IN  fully covered by confirmed hand-ins
 * PARTIAL    partly covered by confirmed hand-ins, the rest still owed
 * AWAITING   not covered by a confirmed hand-in, but a reported (pending)
 *            hand-in covers it — waiting for the restaurant to confirm
 * DUE        still with the rider
 */
export type CashOrderStatus = "HANDED_IN" | "PARTIAL" | "AWAITING" | "DUE";

export type CashOrderAllocation = CashOrder & {
  /** Covered by confirmed hand-ins. */
  handedIn: number;
  /** Covered by a pending hand-in. */
  awaiting: number;
  /** Still with the rider. */
  due: number;
  status: CashOrderStatus;
};

export type CashTotals = {
  collected: number;
  confirmed: number;
  pending: number;
  /** collected − confirmed: what the restaurant says the rider still holds. */
  owed: number;
  /** collected − confirmed − pending: what the rider can still report. */
  inHand: number;
};

export function cashTotals(collected: number, confirmed: number, pending: number): CashTotals {
  const c = roundMoney(collected);
  const k = roundMoney(confirmed);
  const p = roundMoney(pending);
  return {
    collected: c,
    confirmed: k,
    pending: p,
    owed: Math.max(0, roundMoney(c - k)),
    inHand: Math.max(0, roundMoney(c - k - p)),
  };
}

/**
 * Spread confirmed money over the orders oldest-first, then pending money
 * over what is left. Orders are sorted here (by delivery time, then id) so
 * the result never depends on the order the database returned them in.
 */
export function allocateCash(orders: CashOrder[], confirmed: number, pending: number): CashOrderAllocation[] {
  const sorted = [...orders].sort((a, b) => {
    const at = a.deliveredAt?.getTime() ?? 0;
    const bt = b.deliveredAt?.getTime() ?? 0;
    return at - bt || a.orderId.localeCompare(b.orderId);
  });

  let confirmedLeft = Math.max(0, confirmed);
  let pendingLeft = Math.max(0, pending);

  return sorted.map((order) => {
    const handedIn = Math.min(order.amount, confirmedLeft);
    confirmedLeft -= handedIn;
    const awaiting = Math.min(order.amount - handedIn, pendingLeft);
    pendingLeft -= awaiting;
    const due = roundMoney(order.amount - handedIn - awaiting);

    let status: CashOrderStatus;
    if (order.amount - handedIn <= EPSILON) status = "HANDED_IN";
    else if (handedIn > EPSILON) status = "PARTIAL";
    else if (due <= EPSILON) status = "AWAITING";
    else status = "DUE";

    return { ...order, handedIn: roundMoney(handedIn), awaiting: roundMoney(awaiting), due, status };
  });
}

/**
 * When the oldest cash the restaurant has not yet confirmed was delivered —
 * the "aging" figure on the admin page. null = nothing is owed.
 */
export function oldestOwedSince(orders: CashOrder[], confirmed: number): Date | null {
  const allocation = allocateCash(orders, confirmed, 0);
  const open = allocation.find((order) => order.status !== "HANDED_IN");
  return open?.deliveredAt ?? null;
}
