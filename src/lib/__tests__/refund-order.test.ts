import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * refund-order.ts is the single most money-sensitive file in the codebase
 * — it is the only code path that ever sends money back out the door — so
 * this suite mocks "@/lib/prisma" and "@/lib/stripe" entirely (same
 * approach as order-checkout-shared.test.ts and require-admin.test.ts) and
 * exercises the actual business logic: guard clauses, the claim-then-call
 * ordering, the race-condition guard, and both the success and Stripe-
 * failure paths.
 *
 * ── Why $transaction is mocked the way it is ───────────────────────────
 *
 * refund-order.ts calls prisma.$transaction() in two different shapes:
 *
 *   1. Callback form — `$transaction(async (tx) => { ...; return X })` —
 *      used for the atomic claim + PENDING row write.
 *   2. Array form — `$transaction([promiseA, promiseB])` — used for the
 *      SUCCEEDED/FAILED status updates.
 *
 * The mock below handles both: a function argument is invoked with the
 * same mocked `prisma` object as `tx` (their methods have identical
 * shapes, so this is safe), and an array argument is resolved with
 * Promise.all. Neither path needs a real transaction semantics for these
 * tests — what's under test is what refundOrder() DECIDES to call and
 * with what arguments, not Postgres's isolation guarantees.
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
import { toMoney, ZERO } from "@/lib/money";

/** Decimal-safe number extraction, same helper shape as the other money
 *  suites — expect(decimal).toBe(n) never passes since Decimal is an
 *  object, not a primitive. */
const amount = (d: { toNumber(): number }) => d.toNumber();

/** A valid, refundable ONLINE order — the shared starting point most
 *  tests mutate one field of. */
function orderFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order_1",
    paymentMethod: "ONLINE",
    paymentStatus: "PAID",
    totalAmount: toMoney(100),
    refundedAmount: ZERO,
    currency: "USD",
    stripePaymentIntentId: "pi_123",
    refundedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(prisma.order.findUnique).mockReset();
  vi.mocked(prisma.order.updateMany).mockReset();
  vi.mocked(prisma.order.update).mockReset();
  vi.mocked(prisma.refund.create).mockReset();
  vi.mocked(prisma.refund.update).mockReset();
  vi.mocked(prisma.refund.findUnique).mockReset();
  vi.mocked(prisma.$transaction).mockClear();
  mockRefundsCreate.mockReset();

  // Sensible defaults for the "happy path" plumbing — individual tests
  // override whichever step they care about.
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.refund.create).mockResolvedValue({ id: "refund_1" } as never);
  mockRefundsCreate.mockResolvedValue({ id: "re_123" } as never);
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
    expect(recomputePaymentStatus(toMoney(101), toMoney(100))).toBe("REFUNDED");
  });
});

describe("refundOrder — guard clauses", () => {
  it("fails when the order doesn't exist", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const result = await refundOrder({ orderId: "missing" });
    expect(result).toEqual({ ok: false, error: "Order not found" });
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it("refuses COD / Pay-at-Table orders", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentMethod: "COD" }) as never
    );
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "Only online card payments can be refunded here",
    });
  });

  it("refuses an order that was never paid (PENDING)", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentStatus: "PENDING" }) as never
    );
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({ ok: false, error: "This order has not been paid" });
  });

  it("refuses a FAILED payment the same way as PENDING", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentStatus: "FAILED" }) as never
    );
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({ ok: false, error: "This order has not been paid" });
  });

  /**
   * This is the exact bug fixed in this change: an already-REFUNDED order
   * used to fall into the generic "not been paid" branch, which told
   * staff the opposite of what actually happened (all the money already
   * came back, not none of it). REFUNDED must be its own distinct error.
   */
  it("tells a fully refunded order apart from an unpaid one", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentStatus: "REFUNDED", refundedAmount: toMoney(100) }) as never
    );
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "This order has already been fully refunded",
    });
  });

  it("allows a PARTIALLY_REFUNDED order to be refunded further", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentStatus: "PARTIALLY_REFUNDED", refundedAmount: toMoney(30) }) as never
    );
    const result = await refundOrder({ orderId: "order_1", amount: 10 });
    expect(result.ok).toBe(true);
  });

  it("refuses when the order has no Stripe payment intent on record", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ stripePaymentIntentId: null }) as never
    );
    const result = await refundOrder({ orderId: "order_1" });
    expect(result).toEqual({
      ok: false,
      error: "This order has no Stripe payment on record",
    });
  });

  it("rejects a zero amount", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    const result = await refundOrder({ orderId: "order_1", amount: 0 });
    expect(result).toEqual({ ok: false, error: "Amount must be greater than zero" });
  });

  it("rejects a negative amount", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    const result = await refundOrder({ orderId: "order_1", amount: -5 });
    expect(result).toEqual({ ok: false, error: "Amount must be greater than zero" });
  });

  it("rejects an amount larger than what's left to refund", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ refundedAmount: toMoney(60) }) as never // 40 left
    );
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);

    const result = await refundOrder({ orderId: "order_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(100);
    expect(amount(result.refundedAmount)).toBe(100);
    expect(result.paymentStatus).toBe("REFUNDED");
  });

  it("refunds only the requested amount for a partial refund", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);

    const result = await refundOrder({ orderId: "order_1", amount: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(30);
    expect(amount(result.refundedAmount)).toBe(30);
    expect(result.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("adds the new refund on top of what was already refunded", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ paymentStatus: "PARTIALLY_REFUNDED", refundedAmount: toMoney(40) }) as never
    );

    // 60 left; refund the rest.
    const result = await refundOrder({ orderId: "order_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(amount(result.amount)).toBe(60);
    expect(amount(result.refundedAmount)).toBe(100);
    expect(result.paymentStatus).toBe("REFUNDED");
  });

  it("calls Stripe with the payment intent and the amount in minor units", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ currency: "USD" }) as never
    );

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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ currency: "KWD", totalAmount: toMoney(10) }) as never
    );

    await refundOrder({ orderId: "order_1", amount: 1.5 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500 }), // 1.500 KWD -> 1500 fils
      expect.anything()
    );
  });

  it("uses the PENDING refund row's own id as the Stripe idempotency key", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    vi.mocked(prisma.refund.create).mockResolvedValue({ id: "refund_abc123" } as never);

    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.anything(),
      { idempotencyKey: "refund_refund_abc123" }
    );
  });

  it("passes the trimmed reason and the issuing staff id through to the PENDING row", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);

    await refundOrder({
      orderId: "order_1",
      amount: 10,
      reason: "  Wrong dish sent  ",
      issuedById: "staff_1",
    });

    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "Wrong dish sent",
          issuedById: "staff_1",
        }),
      })
    );
  });

  it("records the first refundedAt but never overwrites it on a later refund", async () => {
    const firstRefundedAt = new Date("2026-01-01T00:00:00Z");
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({
        paymentStatus: "PARTIALLY_REFUNDED",
        refundedAmount: toMoney(20),
        refundedAt: firstRefundedAt,
      }) as never
    );

    await refundOrder({ orderId: "order_1", amount: 10 });

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundedAt: firstRefundedAt }),
      })
    );
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 });

    const result = await refundOrder({ orderId: "order_1", amount: 50 });

    expect(result).toEqual({
      ok: false,
      error: "Amount is more than what is left to refund",
    });
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });
});

describe("refundOrder — Stripe failure", () => {
  it("releases the claimed amount and reports the failure when Stripe rejects the refund", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    vi.mocked(prisma.refund.create).mockResolvedValue({ id: "refund_fail" } as never);
    mockRefundsCreate.mockRejectedValue(new Error("Your card was declined"));

    const result = await refundOrder({ orderId: "order_1", amount: 25 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toBe("Stripe refused the refund");
    expect(result.detail).toBe("Your card was declined");

    // The claim made in step 1 must be given back — otherwise this money
    // stays "reserved" forever and a legitimate future refund would be
    // blocked by a refund that never actually happened.
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: { refundedAmount: { decrement: expect.anything() } },
      })
    );

    // The PENDING row becomes a record of the failed attempt, not a
    // successful one — support needs failureReason to explain "why not".
    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "refund_fail" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("truncates an unreasonably long Stripe error message before storing it", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFixture() as never);
    vi.mocked(prisma.refund.create).mockResolvedValue({ id: "refund_long" } as never);
    mockRefundsCreate.mockRejectedValue(new Error("x".repeat(1000)));

    const result = await refundOrder({ orderId: "order_1", amount: 10 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.detail?.length).toBe(1000); // returned to the caller in full
    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failureReason: expect.stringMatching(/^x{500}$/), // stored truncated to 500
        }),
      })
    );
  });
});

describe("recordExternalRefunds", () => {
  it("does nothing when no order matches the payment intent", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const recorded = await recordExternalRefunds("pi_unknown", [
      { id: "re_1", amount: 1000 },
    ]);

    expect(recorded).toBe(0);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("skips a refund that's already been recorded (our own UI-issued refund arriving as a webhook echo)", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ currency: "USD" }) as never
    );
    vi.mocked(prisma.refund.findUnique).mockResolvedValue({ id: "existing_row" } as never);

    const recorded = await recordExternalRefunds("pi_123", [{ id: "re_1", amount: 1000 }]);

    expect(recorded).toBe(0);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it("records a genuinely new dashboard refund and updates the order's running total", async () => {
    vi.mocked(prisma.order.findUnique)
      .mockResolvedValueOnce(orderFixture({ currency: "USD", refundedAmount: ZERO }) as never)
      // The "fresh" re-read after recording, used to recompute paymentStatus.
      .mockResolvedValueOnce({
        refundedAmount: toMoney(10),
        totalAmount: toMoney(100),
      } as never);
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(null);

    const recorded = await recordExternalRefunds("pi_123", [
      { id: "re_new", amount: 1000, reason: "requested_by_customer" },
    ]);

    expect(recorded).toBe(1);
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeRefundId: "re_new",
          issuedById: null, // no staff member — this came from Stripe itself
        }),
      })
    );
    // The order's status is recomputed from the fresh totals, not assumed.
    expect(prisma.order.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { paymentStatus: "PARTIALLY_REFUNDED" },
      })
    );
  });

  it("swallows a unique-constraint race on stripeRefundId instead of throwing", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ currency: "USD" }) as never
    );
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.refund.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      })
    );

    const recorded = await recordExternalRefunds("pi_123", [{ id: "re_race", amount: 500 }]);

    // Another webhook delivery won the race and wrote the row first — that
    // is the expected outcome, not an error to surface.
    expect(recorded).toBe(0);
  });

  it("re-throws a database error that isn't the expected unique-constraint race", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      orderFixture({ currency: "USD" }) as never
    );
    vi.mocked(prisma.refund.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.refund.create).mockRejectedValue(new Error("connection reset"));

    await expect(
      recordExternalRefunds("pi_123", [{ id: "re_boom", amount: 500 }])
    ).rejects.toThrow("connection reset");
  });
});
