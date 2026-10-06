import { describe, expect, it } from "vitest";
import { allocateCash, cashTotals, oldestOwedSince, type CashOrder } from "@/lib/cash-ledger";

const day = (n: number) => new Date(2026, 9, n, 12);
const orders: CashOrder[] = [
  { orderId: "b", deliveredAt: day(5), amount: 20.97 },
  { orderId: "a", deliveredAt: day(4), amount: 23.17 },
  { orderId: "c", deliveredAt: day(6), amount: 10 },
];

describe("cash totals", () => {
  it("separates what is owed from what the rider can still report", () => {
    const t = cashTotals(54.14, 20, 14.14);
    expect(t.owed).toBe(34.14);
    expect(t.inHand).toBe(20);
  });

  it("never goes negative", () => {
    expect(cashTotals(10, 15, 0)).toMatchObject({ owed: 0, inHand: 0 });
    expect(cashTotals(10, 0, 15).inHand).toBe(0);
  });

  it("adds decimals without float drift", () => {
    expect(cashTotals(0.1 + 0.2, 0, 0).owed).toBe(0.3);
  });
});

describe("allocating hand-ins to orders (oldest first)", () => {
  it("leaves everything due when nothing was handed in", () => {
    const rows = allocateCash(orders, 0, 0);
    expect(rows.map((r) => r.orderId)).toEqual(["a", "b", "c"]);
    expect(rows.every((r) => r.status === "DUE")).toBe(true);
  });

  it("settles the oldest order first and marks the next one partial", () => {
    const rows = allocateCash(orders, 30, 0);
    expect(rows[0]).toMatchObject({ orderId: "a", status: "HANDED_IN", handedIn: 23.17 });
    expect(rows[1]).toMatchObject({ orderId: "b", status: "PARTIAL", handedIn: 6.83, due: 14.14 });
    expect(rows[2].status).toBe("DUE");
  });

  it("shows reported-but-unconfirmed cash as awaiting, after the confirmed part", () => {
    const rows = allocateCash(orders, 23.17, 20.97);
    expect(rows[0].status).toBe("HANDED_IN");
    expect(rows[1]).toMatchObject({ status: "AWAITING", awaiting: 20.97, due: 0 });
    expect(rows[2].status).toBe("DUE");
  });

  it("treats everything as handed in once the total is covered", () => {
    const rows = allocateCash(orders, 54.14, 0);
    expect(rows.every((r) => r.status === "HANDED_IN")).toBe(true);
  });

  it("does not depend on the order the database returned", () => {
    const shuffled = [orders[2], orders[0], orders[1]];
    expect(allocateCash(shuffled, 23.17, 0).map((r) => r.status)).toEqual(
      allocateCash(orders, 23.17, 0).map((r) => r.status)
    );
  });
});

describe("aging", () => {
  it("is the delivery time of the oldest order not yet confirmed", () => {
    expect(oldestOwedSince(orders, 0)).toEqual(day(4));
    expect(oldestOwedSince(orders, 23.17)).toEqual(day(5));
  });

  it("is null when nothing is owed", () => {
    expect(oldestOwedSince(orders, 54.14)).toBeNull();
    expect(oldestOwedSince([], 0)).toBeNull();
  });
});
