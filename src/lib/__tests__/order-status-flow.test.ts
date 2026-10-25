import { describe, expect, it } from "vitest";
import {
  canAssignRider,
  canTransition,
  isTerminalStatus,
  nextStatuses,
  transitionError,
} from "@/lib/order-state-machine";
import { orderStatusLabel } from "@/lib/order-status-filter";
import { KITCHEN_STATUS_TO_ORDER_STATUS } from "@/lib/kitchen-status";
import { orderStatusUpdateSchema } from "@/lib/validations/order";

describe("order status flow", () => {
  it("walks PLACED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED", () => {
    expect(canTransition("PLACED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("can't skip the kitchen's Ready step", () => {
    expect(canTransition("PLACED", "READY")).toBe(false);
    expect(canTransition("PLACED", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("PREPARING", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("PREPARING", "DELIVERED")).toBe(false);
  });

  it("dine-in is served straight from READY", () => {
    expect(canTransition("READY", "DELIVERED")).toBe(true);
  });

  it("never goes backwards", () => {
    expect(canTransition("READY", "PREPARING")).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "READY")).toBe(false);
    expect(canTransition("DELIVERED", "OUT_FOR_DELIVERY")).toBe(false);
    expect(transitionError("DELIVERED", "READY")).toMatch(/already delivered/);
  });

  it("an order can be cancelled until it is delivered", () => {
    for (const status of ["PLACED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const) {
      expect(nextStatuses(status)).toContain("CANCELLED");
    }
    expect(isTerminalStatus("DELIVERED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });

  it("only a READY order gets a rider (or one being reassigned)", () => {
    expect(canAssignRider("READY")).toBe(true);
    expect(canAssignRider("OUT_FOR_DELIVERY")).toBe(true);
    expect(canAssignRider("PLACED")).toBe(false);
    expect(canAssignRider("PREPARING")).toBe(false);
    expect(canAssignRider("DELIVERED")).toBe(false);
    expect(canAssignRider("CANCELLED")).toBe(false);
  });
});

describe("READY labels and plumbing", () => {
  it("is called Ready for delivery orders and Ready to Serve for dine-in", () => {
    expect(orderStatusLabel("READY", "DELIVERY")).toBe("Ready");
    expect(orderStatusLabel("READY", "DINE_IN")).toBe("Ready to Serve");
    expect(orderStatusLabel("OUT_FOR_DELIVERY", "DELIVERY")).toBe("On the Way");
  });

  it("is the kitchen board's Ready column", () => {
    expect(KITCHEN_STATUS_TO_ORDER_STATUS.ready).toBe("READY");
  });

  it("is accepted by the status update schema", () => {
    expect(orderStatusUpdateSchema.safeParse({ status: "READY" }).success).toBe(true);
    expect(orderStatusUpdateSchema.safeParse({ status: "NOPE" }).success).toBe(false);
  });
});
