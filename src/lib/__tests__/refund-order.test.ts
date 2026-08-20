import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * refund-order.ts is the single most money-sensitive file in the codebase
 * — it is the only code path that ever sends money back out the door — so
 * this suite mocks "@/lib/prisma" and "@/lib/stripe" entirely (same
 * approach as order-checkout-shared.test.ts and require-admin.test.ts) and
 * exercises the actual business logic: guard clauses, the claim-then-call
 * ordering, the race-condition guards, and both the success and Stripe-
 * failure paths.
 *
 * ── ⚠️ Why the prisma mock is now STATEFUL ─────────────────────────────
 *
 * It used to return a frozen order fixture from every findUnique call, so
 * `refundedAmount` never actually moved no matter how many increments the
 * code issued. That made a whole class of bug structurally invisible:
 * double-counting looks identical to correct counting if nothing ever
 * counts. The charge.refunded race — where a webhook and refundOrder both
 * added the same amount — sailed straight through 30 green tests.
 *
 * So the mock below keeps a tiny in-memory database instead:
 *
 *   • `orderRow` — one order whose refundedAmount / paymentStatus /
 *     refundedAt are genuinely mutated by update and updateMany.
 *   • `refundRows` — a Map of Refund rows, so status guards
 *     (`where: { id, status: "PENDING" }`) either match or don't, exactly
 *     as Postgres would decide.
 *
 * That is what lets the tests at the bottom assert the thing that actually
 * matters — the FINAL refundedAmount — rather than just which methods got
 * called.
 *
 * ── Why $transaction is mocked the way it is ───────────────────────────
 *
 * refund-order.ts calls prisma.$transaction() in the callback form —
 * `$transaction(async (tx) => { ... })` — for every write group. The mock
 * invokes the callback with the same mocked `prisma` object as `tx` (the
 * shapes are identical, so this is safe). Rollback is NOT simulated:
 * what's under test is what refundOrder DECIDES to write, not Postgres's
 * isolation guarantees.
 */

const mockRefundsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    refunds: { create: (...args: unknown[]) => mockRefundsCreate(...args) },
  }),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prisma) => unknown)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import {
  refundOrder,
  recomputePaymentStatus,
  recordExternalRefunds,
} from "@/lib/refund-order";
import { toMoney, ZERO, type Money } from "@/lib/money";

/**
 * ── Why the mocks are reached through `db`, not `vi.mocked(prisma.x)` ──
 *
 * `prisma` still carries its real generated types here, so vi.mocked()
 * insists every implementation return a Prisma__OrderClient — the fluent
 * thenable that also exposes `.table`, `.refunds`, `.items` and friends —
 * rather than a plain Promise. A fake that returns `{ count: 1 }` can
 * never satisfy that, and sprinkling `as never` over each one buries the
 * intent under casts.
 *
 * So the client is widened ONCE, here, into plain vi.fn() handles. Inside
 * this file `db` and `prisma` are the same object at runtime; `db` simply
 * describes it as what it actually is under test — a hand-written fake.
 */
type MockFn = ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  order: { findUnique: MockFn; updateMany: MockFn; update: MockFn };
  refund: {
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
    findUnique: MockFn;
  };
  $transaction: MockFn;
};

/** Decimal-safe number extraction, same helper shape as the other money
 *  suites — expect(decimal).toBe(n) never passes since Decimal is an
 *  object, not a primitive. */
const amount = (d: { toNumber(): number }) => d.toNumber();

// ── The tiny in-memory database ───────────────────────────────────────

interface FakeOrder {
  id: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: Money;
  refundedAmount: Money;
  currency: string;
  /**
   * ⚠️ currency-র সাথেই রাখতে হবে, নইলে toStripeMinorUnits() undefined
   * পেয়ে "[DecimalError] Invalid argument: undefined" ছোড়ে।
   *
   * refundOrder আগে minorUnitsFor(currency) দিয়ে দশমিক অনুমান করত।
   * এখন order-এর নিজের snapshot পড়ে — কারণ charge হয়েছিল settings-এর
   * মান দিয়ে, আর দুটো আলাদা হলে refund ১০০ গুণ ভুল হতো।
   */
  currencyMinorUnits: number;
  stripePaymentIntentId: string | null;
  refundedAt: Date | null;
}

interface FakeRefund {
  id: string;
  orderId: string;
  status: string;
  stripeRefundId: string | null;
  failureReason: string | null;
}

/**
 * The slices of Prisma's argument objects this fake actually reads.
 *
 * Spelled out rather than left to inference: vi.fn()'s signature is
 * `(...args: any[]) => any`, so an untyped `args` would silently become
 * `any` and a typo like `where.refundAmount` would compile and quietly
 * disable a guard the tests exist to prove.
 */
interface OrderUpdateArgs {
  where?: { refundedAmount?: { lte?: Money } };
  data?: Record<string, unknown>;
}

interface RefundCreateArgs {
  data: Record<string, unknown>;
}

interface RefundUpdateManyArgs {
  where: { id?: string; status?: string };
  data: Record<string, unknown>;
}

interface RefundFindArgs {
  where: { id?: string; stripeRefundId?: string };
}

/** The single order under test, or null to simulate "not found". */
let orderRow: FakeOrder | null = null;
let refundRows = new Map<string, FakeRefund>();
let refundSeq = 0;

/** A valid, refundable ONLINE order — the shared starting point most
 *  tests mutate one field of. */
function seedOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  orderRow = {
    id: "order_1",
    paymentMethod: "ONLINE",
    paymentStatus: "PAID",
    totalAmount: toMoney(100),
    refundedAmount: ZERO,
    currency: "USD",
    currencyMinorUnits: 2,
    stripePaymentIntentId: "pi_123",
    refundedAt: null,
    ...overrides,
  };
  return orderRow;
}

/** Applies a Prisma `data` payload to the in-memory order, honouring the
 *  increment/decrement atomic operators refund-order.ts relies on. */
function applyOrderData(data: Record<string, unknown> | undefined) {
  if (!data || !orderRow) return;

  const refunded = data.refundedAmount as
    | { increment?: Money; decrement?: Money }
    | undefined;

  if (refunded?.increment) {
    orderRow.refundedAmount = orderRow.refundedAmount.plus(refunded.increment);
  }
  if (refunded?.decrement) {
    orderRow.refundedAmount = orderRow.refundedAmount.minus(refunded.decrement);
  }
  if (typeof data.paymentStatus === "string") {
    orderRow.paymentStatus = data.paymentStatus;
  }
  if ("refundedAt" in data) {
    orderRow.refundedAt = data.refundedAt as Date | null;
  }
}

beforeEach(() => {
  refundRows = new Map();
  refundSeq = 0;
  seedOrder();

  db.order.findUnique.mockReset();
  db.order.updateMany.mockReset();
  db.order.update.mockReset();
  db.refund.create.mockReset();
  db.refund.update.mockReset();
  db.refund.updateMany.mockReset();
  db.refund.findUnique.mockReset();
  db.$transaction.mockClear();
  mockRefundsCreate.mockReset();

  db.order.findUnique.mockImplementation(async () => orderRow);

  db.order.updateMany.mockImplementation(async (args: OrderUpdateArgs) => {
    const guard = args.where?.refundedAmount?.lte;

    // compare-and-set: the claim only lands if the current total is still
    // low enough. This is the guard that stops two refunds overspending.
    if (guard !== undefined && orderRow!.refundedAmount.greaterThan(guard)) {
      return { count: 0 };
    }

    applyOrderData(args.data);
    return { count: 1 };
  });

  db.order.update.mockImplementation(async (args: OrderUpdateArgs) => {
    applyOrderData(args.data);
    return orderRow;
  });

  db.refund.create.mockImplementation(async (args: RefundCreateArgs) => {
    const data = args.data;
    const id = `refund_${++refundSeq}`;
    refundRows.set(id, {
      id,
      orderId: data.orderId as string,
      status: data.status as string,
      stripeRefundId: (data.stripeRefundId as string) ?? null,
      failureReason: null,
    });
    return { id };
  });

  db.refund.updateMany.mockImplementation(async (args: RefundUpdateManyArgs) => {
    const row = args.where.id ? refundRows.get(args.where.id) : undefined;

    if (!row) return { count: 0 };
    // The status guard is the whole point — it is what stops refundOrder
    // and a webhook from both settling the same row.
    if (args.where.status !== undefined && row.status !== args.where.status) {
      return { count: 0 };
    }

    Object.assign(row, args.data);
    return { count: 1 };
  });

  db.refund.findUnique.mockImplementation(async (args: RefundFindArgs) => {
    const { id, stripeRefundId } = args.where;
    if (id) return refundRows.get(id) ?? null;
    if (stripeRefundId) {
      return (
        [...refundRows.values()].find((r) => r.stripeRefundId === stripeRefundId) ?? null
      );
    }
    return null;
  });

  mockRefundsCreate.mockResolvedValue({ id: "re_123" });
});

describe("recomputePaymentStatus", () => {
  it("returns PAID when nothing has been refunded", () => {
    expect(recomputePaymentStatus(ZERO, toMoney(100))).toBe("PAID");
  });

  it("returns PARTIALLY_REFUNDED when some but not all has come back", () => {
    expect(recomputePaymentStatus(toMoney(40), toMoney(100))).toBe("PARTIALLY_REFUNDED");
  });

  it("returns REFUNDED when the refunded amount exactly matches the total", () => {
    expect(recomputePaymentStatus(toMoney(100), toMoney(100))).toBe("REFUNDED");
  });

  it("returns REFUNDED even if refundedAmount somehow exceeds the total", () => {
    // Shouldn't happen given the >= comparison in refundOrder, but the
    // function itself should still fail safe rather than report
    // PARTIALLY_REFUNDED on an order that has nothing left to give back.
    expect(recomputePaymentStatus(toMoney(120), toMoney(100))).toBe("REFUNDED");
  });
});

describe("refundOrder — guard clauses", () => {
  it("refuses an order that does not exist", async () => {
    orderRow = null;
    const result = await refundOrder({ orderId: "nope" });
    expect(result).toEqual({ ok: false, error: "Order not found" });
  });

  it("refuses a cash order — there is no card to send money back to", async () => {
    seedOrder({ paymentMethod: "COD" });
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "Only online card payments can be refunded here",
    });
  });

  it("refuses an unpaid order", async () => {
    seedOrder({ paymentStatus: "PENDING" });
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({ ok: false, error: "This order has not been paid" });
  });

  it("refuses a FAILED payment the same way as PENDING", async () => {
    seedOrder({ paymentStatus: "FAILED" });
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({ ok: false, error: "This order has not been paid" });
  });

  it("tells a fully refunded order apart from an unpaid one", async () => {
    // Two very different situations that must never share a message —
    // staff reading "has not been paid" on a refunded order would assume
    // the payment never went through.
    seedOrder({ paymentStatus: "REFUNDED", refundedAmount: toMoney(100) });
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "This order has already been fully refunded",
    });
  });

  it("allows a PARTIALLY_REFUNDED order to be refunded further", async () => {
    seedOrder({ paymentStatus: "PARTIALLY_REFUNDED", refundedAmount: toMoney(30) });
    const result = await refundOrder({ orderId: "order_1", amount: 10 });
    expect(result.ok).toBe(true);
  });

  it("refuses when the order has no Stripe payment intent on record", async () => {
    seedOrder({ stripePaymentIntentId: null });
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "This order has no Stripe payment on record",
    });
  });

  it("rejects a zero amount", async () => {
    const result = await refundOrder({ orderId: "order_1", amount: 0 });
    expect(result).toEqual({ ok: false, error: "Amount must be greater than zero" });
  });

  it("rejects a negative amount", async () => {
    const result = await refundOrder({ orderId: "order_1", amount: -5 });
    expect(result).toEqual({ ok: false, error: "Amount must be greater than zero" });
  });

  it("rejects an amount larger than what's left to refund", async () => {
    seedOrder({ refundedAmount: toMoney(60) }); // 40 left
    const result = await refundOrder({ orderId: "order_1", amount: 50 });
    expect(result).toEqual({
      ok: false,
      error: "Amount is more than what is left to refund",
    });
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });
});

describe("refundOrder — success paths", () => {
  it("defaults to refunding everything still owed when amount is omitted", async () => {
    const result = await refundOrder({ orderId: "order_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(100);
    expect(amount(result.refundedAmount)).toBe(100);
    expect(result.paymentStatus).toBe("REFUNDED");
    expect(amount(orderRow!.refundedAmount)).toBe(100);
  });

  it("refunds only the requested amount for a partial refund", async () => {
    const result = await refundOrder({ orderId: "order_1", amount: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(30);
    expect(amount(result.refundedAmount)).toBe(30);
    expect(result.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("adds the new refund on top of what was already refunded", async () => {
    seedOrder({ paymentStatus: "PARTIALLY_REFUNDED", refundedAmount: toMoney(40) });

    // 60 left; refund the rest.
    const result = await refundOrder({ orderId: "order_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(60);
    expect(amount(result.refundedAmount)).toBe(100);
    expect(result.paymentStatus).toBe("REFUNDED");
  });

  it("calls Stripe with the payment intent and the amount in minor units", async () => {
    await refundOrder({ orderId: "order_1", amount: 12.5 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_123",
        amount: 1250, // $12.50 -> 1250 cents
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("refund_") })
    );
  });

  it("scales minor units correctly for a three-decimal currency", async () => {
    seedOrder({ currency: "KWD", currencyMinorUnits: 3, totalAmount: toMoney(10) });

    await refundOrder({ orderId: "order_1", amount: 1.5 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500 }), // 1.500 KWD -> 1500 fils
      expect.anything()
    );
  });

  it("uses the order's own minor units, not a guess from the currency code", async () => {
    /**
     * ⚠️ এই test-টার fixture ইচ্ছাকৃতভাবে *অসঙ্গত*: currency JPY কিন্তু
     * দশমিক ২। বাস্তবে এমন order তৈরি হয় যখন admin ইয়েন বেছে
     * "Decimal places" ২-তে রেখে দেয় — settings form সেটা আটকায় না।
     *
     * আসল কথাটা হলো ওই order-টা **২ দশমিক ধরেই charge হয়েছিল**।
     * তাই refund-ও ২ ধরেই যেতে হবে, নইলে গ্রাহক ১০০ গুণ কম ফেরত পাবেন।
     *
     * আগের কোড এখানে defaultMinorUnitsFor("JPY") = 0 ব্যবহার করত, ফলে
     * ¥12.50 ফেরত যেতো ১২ minor unit হিসেবে, ১২৫০ নয়।
     */
    seedOrder({ currency: "JPY", currencyMinorUnits: 2 });

    await refundOrder({ orderId: "order_1", amount: 12.5 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1250 }),
      expect.anything()
    );
  });

  it("uses the PENDING refund row's own id as the Stripe idempotency key", async () => {
    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: "refund_refund_1",
    });
  });

  it("tags the Stripe refund with the row id so the webhook can recognise it", async () => {
    // This metadata is what closes the charge.refunded race — without it
    // the webhook cannot tell our own refund apart from a dashboard one
    // until stripeRefundId is written, which happens too late.
    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { orderId: "order_1", refundId: "refund_1" },
      }),
      expect.anything()
    );
  });

  it("passes the trimmed reason and the issuing staff id through to the PENDING row", async () => {
    await refundOrder({
      orderId: "order_1",
      amount: 10,
      reason: "  Wrong dish sent  ",
      issuedById: "staff_1",
    });

    expect(db.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "Wrong dish sent",
          issuedById: "staff_1",
        }),
      })
    );
  });

  it("marks the refund row SUCCEEDED and stores the Stripe refund id", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_success" });

    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(refundRows.get("refund_1")).toMatchObject({
      status: "SUCCEEDED",
      stripeRefundId: "re_success",
    });
  });

  it("records the first refundedAt but never overwrites it on a later refund", async () => {
    const firstRefundedAt = new Date("2026-01-01T00:00:00Z");
    seedOrder({
      paymentStatus: "PARTIALLY_REFUNDED",
      refundedAmount: toMoney(20),
      refundedAt: firstRefundedAt,
    });

    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(orderRow!.refundedAt).toBe(firstRefundedAt);
  });

  it("stamps refundedAt on the first refund of an order", async () => {
    await refundOrder({ orderId: "order_1", amount: 10 });
    expect(orderRow!.refundedAt).toBeInstanceOf(Date);
  });
});

describe("refundOrder — concurrent refund claims", () => {
  /**
   * The atomic claim (order.updateMany with a `refundedAmount: { lte }`
   * guard) is what stops two admins clicking "Issue refund" on the same
   * order at the same moment from together sending back more than was
   * ever charged. A count of 0 means someone else's claim won the race —
   * this must fail the same way an over-large amount would, not silently
   * proceed to call Stripe anyway.
   */
  it("fails cleanly when another refund claimed the balance first", async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await refundOrder({ orderId: "order_1", amount: 50 });

    expect(result).toEqual({
      ok: false,
      error: "Amount is more than what is left to refund",
    });
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it("two full refunds in a row cannot together exceed the amount charged", async () => {
    const first = await refundOrder({ orderId: "order_1" });
    expect(first.ok).toBe(true);

    // The order is now fully refunded; a second attempt must be refused
    // by the guard clause rather than sending another 100 out the door.
    const second = await refundOrder({ orderId: "order_1", amount: 100 });

    expect(second.ok).toBe(false);
    expect(amount(orderRow!.refundedAmount)).toBe(100);
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);
  });
});

describe("refundOrder — Stripe failure", () => {
  it("releases the claimed amount and reports the failure when Stripe rejects the refund", async () => {
    mockRefundsCreate.mockRejectedValue(new Error("Your card was declined"));

    const result = await refundOrder({ orderId: "order_1", amount: 25 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toBe("Stripe refused the refund");
    expect(result.detail).toBe("Your card was declined");

    // The claim made in step 1 must be given back — otherwise this money
    // stays "reserved" forever and a legitimate future refund would be
    // blocked by a refund that never actually happened.
    expect(amount(orderRow!.refundedAmount)).toBe(0);
    expect(orderRow!.paymentStatus).toBe("PAID");

    // The PENDING row becomes a record of the failed attempt, not a
    // successful one — support needs failureReason to explain "why not".
    expect(refundRows.get("refund_1")).toMatchObject({ status: "FAILED" });
  });

  it("leaves refundedAt unset when the only refund attempt failed", async () => {
    mockRefundsCreate.mockRejectedValue(new Error("nope"));

    await refundOrder({ orderId: "order_1", amount: 25 });

    // Claiming that money started coming back on this date would be a
    // lie — nothing ever left Stripe.
    expect(orderRow!.refundedAt).toBeNull();
  });

  it("truncates an unreasonably long Stripe error message before storing it", async () => {
    mockRefundsCreate.mockRejectedValue(new Error("x".repeat(1000)));

    const result = await refundOrder({ orderId: "order_1", amount: 10 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.detail?.length).toBe(1000); // returned to the caller in full
    expect(refundRows.get("refund_1")!.failureReason).toMatch(/^x{500}$/);
  });
});

describe("refundOrder — the charge.refunded race", () => {
  /**
   * ⚠️ These are the regression tests for the bug this file exists to
   * stop. Stripe fires charge.refunded the instant refunds.create()
   * returns — routinely BEFORE step 4 writes stripeRefundId.
   *
   * The old code deduped only on stripeRefundId, so the webhook saw an
   * unrecognised refund, wrote a SECOND Refund row and incremented
   * refundedAmount a second time. Step 4 then hit a unique violation and
   * fell into the failure path, which marked the (successful!) refund
   * FAILED and told the admin "Stripe refused the refund". The admin's
   * natural next move — refund again by hand from the dashboard — is how
   * a customer ends up paid back twice.
   *
   * The mock below fires the webhook from inside refunds.create(), which
   * is precisely the window that used to be open.
   */
  function webhookFiresDuringStripeCall(stripeRefundId: string, minorUnits: number) {
    mockRefundsCreate.mockImplementation(async () => {
      await recordExternalRefunds("pi_123", [
        {
          id: stripeRefundId,
          amount: minorUnits,
          metadata: { orderId: "order_1", refundId: "refund_1" },
        },
      ]);
      return { id: stripeRefundId };
    });
  }

  it("counts the refund once, not twice, when the webhook lands mid-flight", async () => {
    webhookFiresDuringStripeCall("re_race", 2500);

    const result = await refundOrder({ orderId: "order_1", amount: 25 });

    expect(result.ok).toBe(true);
    expect(amount(orderRow!.refundedAmount)).toBe(25); // not 50
  });

  it("still reports success to the admin when the webhook wins the race", async () => {
    webhookFiresDuringStripeCall("re_race", 2500);

    const result = await refundOrder({ orderId: "order_1", amount: 25 });

    // The old code reported "Stripe refused the refund" here, on a refund
    // that had in fact gone through.
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("does not create a second Refund row for our own refund", async () => {
    webhookFiresDuringStripeCall("re_race", 2500);

    await refundOrder({ orderId: "order_1", amount: 25 });

    expect(refundRows.size).toBe(1);
    expect(refundRows.get("refund_1")).toMatchObject({
      status: "SUCCEEDED",
      stripeRefundId: "re_race",
    });
  });

  it("leaves a partial refund as PARTIALLY_REFUNDED, not REFUNDED", async () => {
    // The old code recomputed paymentStatus from the transient doubled
    // total, so a 50% refund of a 100 order briefly read as 100 and the
    // order was marked fully REFUNDED — blocking the second half from
    // ever being refunded.
    webhookFiresDuringStripeCall("re_race", 5000);

    await refundOrder({ orderId: "order_1", amount: 50 });

    expect(orderRow!.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(amount(orderRow!.refundedAmount)).toBe(50);
  });

  it("reports success when the Stripe call times out but the webhook confirms it", async () => {
    // A read timeout is not a rejection: the refund can be perfectly real
    // even though our HTTP call threw. If a webhook has already settled
    // the row, releasing the claim would tell the ledger no money moved
    // while the customer has in fact been paid.
    mockRefundsCreate.mockImplementation(async () => {
      await recordExternalRefunds("pi_123", [
        {
          id: "re_timeout",
          amount: 2500,
          metadata: { orderId: "order_1", refundId: "refund_1" },
        },
      ]);
      throw new Error("socket hang up");
    });

    const result = await refundOrder({ orderId: "order_1", amount: 25 });

    expect(result.ok).toBe(true);
    expect(amount(orderRow!.refundedAmount)).toBe(25);
    expect(refundRows.get("refund_1")).toMatchObject({ status: "SUCCEEDED" });
  });
});

describe("recordExternalRefunds", () => {
  it("does nothing when no order matches the payment intent", async () => {
    orderRow = null;

    const recorded = await recordExternalRefunds("pi_unknown", [
      { id: "re_1", amount: 1000 },
    ]);

    expect(recorded).toBe(0);
    expect(db.refund.create).not.toHaveBeenCalled();
  });

  it("skips a refund already recorded under the same Stripe id", async () => {
    refundRows.set("refund_existing", {
      id: "refund_existing",
      orderId: "order_1",
      status: "SUCCEEDED",
      stripeRefundId: "re_1",
      failureReason: null,
    });

    const recorded = await recordExternalRefunds("pi_123", [{ id: "re_1", amount: 1000 }]);

    expect(recorded).toBe(0);
    expect(db.refund.create).not.toHaveBeenCalled();
  });

  it("records a genuinely new dashboard refund and updates the order's running total", async () => {
    const recorded = await recordExternalRefunds("pi_123", [
      { id: "re_new", amount: 1000, reason: "requested_by_customer" },
    ]);

    expect(recorded).toBe(1);
    expect(db.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeRefundId: "re_new",
          status: "SUCCEEDED",
          // No staff member issued this one — that null is the marker
          // saying "someone did this in the Stripe dashboard".
          issuedById: null,
        }),
      })
    );
    expect(amount(orderRow!.refundedAmount)).toBe(10);
    expect(orderRow!.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("converts Stripe minor units using the order's own currency", async () => {
    seedOrder({ currency: "KWD", currencyMinorUnits: 3, totalAmount: toMoney(50) });

    await recordExternalRefunds("pi_123", [{ id: "re_kwd", amount: 1500 }]);

    // 1500 fils is 1.500 KWD, not 15.00 — three decimals, not two.
    expect(amount(orderRow!.refundedAmount)).toBe(1.5);
  });

  it("marks the order REFUNDED once the dashboard refunds cover the total", async () => {
    await recordExternalRefunds("pi_123", [{ id: "re_all", amount: 10000 }]);

    expect(orderRow!.paymentStatus).toBe("REFUNDED");
    expect(orderRow!.refundedAt).toBeInstanceOf(Date);
  });

  it("ignores metadata pointing at a refund belonging to a different order", async () => {
    // metadata is attacker-adjacent input: it can arrive from another
    // environment or a restored database. Crediting this order on the
    // strength of it would move money on the wrong ledger.
    refundRows.set("refund_elsewhere", {
      id: "refund_elsewhere",
      orderId: "order_999",
      status: "PENDING",
      stripeRefundId: null,
      failureReason: null,
    });

    const recorded = await recordExternalRefunds("pi_123", [
      { id: "re_x", amount: 1000, metadata: { refundId: "refund_elsewhere" } },
    ]);

    // Falls through to the dashboard path and is recorded against THIS
    // order as a new row; the other order's row is left untouched.
    expect(recorded).toBe(1);
    expect(refundRows.get("refund_elsewhere")).toMatchObject({ status: "PENDING" });
  });

  it("repairs a refund we wrongly marked FAILED when Stripe says it succeeded", async () => {
    // The timeout case, seen from the webhook's side: our call threw, we
    // released the claim, but the money really did move.
    refundRows.set("refund_lost", {
      id: "refund_lost",
      orderId: "order_1",
      status: "FAILED",
      stripeRefundId: null,
      failureReason: "socket hang up",
    });

    const recorded = await recordExternalRefunds("pi_123", [
      { id: "re_found", amount: 2500, metadata: { refundId: "refund_lost" } },
    ]);

    expect(recorded).toBe(1);
    expect(refundRows.get("refund_lost")).toMatchObject({
      status: "SUCCEEDED",
      stripeRefundId: "re_found",
      failureReason: null,
    });
    expect(amount(orderRow!.refundedAmount)).toBe(25);
  });

  it("is idempotent across repeated deliveries of the same event", async () => {
    const payload = [{ id: "re_dup", amount: 2500 }];

    await recordExternalRefunds("pi_123", payload);
    await recordExternalRefunds("pi_123", payload);
    await recordExternalRefunds("pi_123", payload);

    // Stripe retries webhooks aggressively; three deliveries must move
    // the ledger exactly once.
    expect(amount(orderRow!.refundedAmount)).toBe(25);
  });

  it("treats a unique-constraint clash as another delivery winning, not an error", async () => {
    db.refund.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const recorded = await recordExternalRefunds("pi_123", [{ id: "re_race", amount: 500 }]);

    expect(recorded).toBe(0);
  });

  it("rethrows database errors that are not a unique-constraint clash", async () => {
    db.refund.create.mockRejectedValue(new Error("connection reset"));

    await expect(
      recordExternalRefunds("pi_123", [{ id: "re_boom", amount: 500 }])
    ).rejects.toThrow("connection reset");
  });
});
