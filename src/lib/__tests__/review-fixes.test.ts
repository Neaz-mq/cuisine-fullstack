import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the fixes from the September 2026 code review:
 *   1. requireApi* hands back the role from the DB, not the stale JWT role
 *   2. an unpaid ONLINE order can't be moved to PREPARING or DELIVERED
 *   3. a status change that loses a race (P2025) returns a clean error
 *      instead of running twice
 *   4. emailSchema trims before it validates
 */

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

const db = {
  userFindUnique: vi.fn(),
  orderFindUnique: vi.fn(),
  transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => db.userFindUnique(...a) },
    order: { findUnique: (...a: unknown[]) => db.orderFindUnique(...a) },
    $transaction: (...a: unknown[]) => db.transaction(...a),
  },
}));

// Loyalty settings come from their own tables; not what these tests check.
vi.mock("@/lib/loyalty-config", () => ({
  getActiveEarnRule: async () => null,
  getLoyaltyTiers: async () => [],
  pointsForSpend: () => 0,
}));

import { requireApiScope } from "@/lib/require-admin";
import { advanceOrderToPreparing } from "@/lib/advance-order-to-preparing";
import { markOrderDelivered } from "@/lib/mark-order-delivered";
import { emailSchema } from "@/lib/validations/common";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireApiScope uses the DB role", () => {
  it("replaces a stale OWNER role in the token with the current MANAGER role", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "OWNER" } });
    db.userFindUnique.mockResolvedValue({ role: "MANAGER", staffProfile: { isActive: true } });

    const result = await requireApiScope("staff");

    expect((result as { user: { role: string } }).user.role).toBe("MANAGER");
  });
});

const orderRow = (over: Record<string, unknown>) => ({
  status: "PLACED",
  paymentMethod: "ONLINE",
  paymentStatus: "PENDING",
  items: [],
  ...over,
});

describe("unpaid ONLINE orders", () => {
  it("can't be moved to PREPARING", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({}));
    const result = await advanceOrderToPreparing("o1");
    expect(result).toEqual({ ok: false, error: "This order hasn't been paid yet" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("can't be marked DELIVERED", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ status: "PREPARING" }));
    const result = await markOrderDelivered("o1");
    expect(result).toEqual({ ok: false, error: "This order hasn't been paid yet" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("a PAID online order still moves to PREPARING", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ paymentStatus: "PAID" }));
    db.transaction.mockResolvedValue({ order: { id: "o1", status: "PREPARING" }, deducted: false });
    const result = await advanceOrderToPreparing("o1");
    expect(result.ok).toBe(true);
  });

  it("cash (COD) orders are not affected", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ paymentMethod: "COD" }));
    db.transaction.mockResolvedValue({ order: { id: "o1", status: "PREPARING" }, deducted: false });
    const result = await advanceOrderToPreparing("o1");
    expect(result.ok).toBe(true);
  });
});

describe("losing a status race", () => {
  const p2025 = Object.assign(new Error("Record to update not found."), { code: "P2025" });

  it("PREPARING: returns a clean error instead of throwing", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ paymentMethod: "COD" }));
    db.transaction.mockRejectedValue(p2025);
    const result = await advanceOrderToPreparing("o1");
    expect(result).toEqual({
      ok: false,
      error: "This order cannot be moved to preparing from its current status",
    });
  });

  it("DELIVERED: returns a clean error instead of throwing", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ status: "PREPARING", paymentMethod: "COD" }));
    db.transaction.mockRejectedValue(p2025);
    const result = await markOrderDelivered("o1");
    expect(result).toEqual({
      ok: false,
      error: "This order cannot be marked delivered from its current status",
    });
  });

  it("other database errors still bubble up", async () => {
    db.orderFindUnique.mockResolvedValue(orderRow({ paymentMethod: "COD" }));
    db.transaction.mockRejectedValue(new Error("connection lost"));
    await expect(advanceOrderToPreparing("o1")).rejects.toThrow("connection lost");
  });
});

describe("emailSchema", () => {
  it("trims and lowercases before validating", () => {
    expect(emailSchema.parse("  John@Example.COM ")).toBe("john@example.com");
  });
  it("still rejects a bad address", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});
