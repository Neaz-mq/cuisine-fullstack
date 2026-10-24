import { describe, expect, it } from "vitest";
import { DELIVERY_STATUS_STYLE, OPEN_PURCHASE_ORDER_STATUSES } from "@/lib/supplier-status";

describe("delivery status labels", () => {
  it("maps the supplier flow to Pending → On the Way → Delivered", () => {
    expect(DELIVERY_STATUS_STYLE.ORDERED.label).toBe("Pending");
    expect(DELIVERY_STATUS_STYLE.ON_THE_WAY.label).toBe("On the Way");
    expect(DELIVERY_STATUS_STYLE.RECEIVED.label).toBe("Delivered");
    expect(DELIVERY_STATUS_STYLE.CANCELLED.label).toBe("Cancelled");
  });

  it("never calls an unsent draft Pending", () => {
    expect(DELIVERY_STATUS_STYLE.DRAFT.label).toBe("Draft");
  });

  it("counts Pending and On the Way as awaiting delivery", () => {
    expect([...OPEN_PURCHASE_ORDER_STATUSES]).toEqual(["ORDERED", "ON_THE_WAY"]);
  });
});
