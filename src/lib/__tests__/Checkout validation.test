import { describe, it, expect, vi } from "vitest";

/**
 * validateBilling and calcGiftCardAmountToApply are both pure functions,
 * but the modules that export them (order-checkout-shared.ts, gift-cards.ts)
 * unconditionally import "@/lib/prisma" at the top for their OTHER
 * exports. Mocking it here — same as order-checkout-shared.test.ts — means
 * this suite never needs a generated Prisma client or a live DATABASE_URL,
 * even though neither function under test touches the database at all.
 *
 * validateBilling is the server-side re-check behind checkout — it has to
 * hold even if a request bypasses the UI entirely (direct API call), so
 * it's tested independently of any component. Covers both the
 * DELIVERY-vs-DINE_IN required-field split (added for QR table ordering)
 * and the phone regex that guards against non-digit input.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { validateBilling, type Billing } from "@/lib/order-checkout-shared";
import { calcGiftCardAmountToApply } from "@/lib/gift-cards";

function billing(overrides: Partial<Billing> = {}): Billing {
  return {
    firstName: "Rahim",
    lastName: "Uddin",
    phone: "01712345678",
    email: "rahim@example.com",
    country: "Bangladesh",
    address: "123 Road",
    city: "Bogura",
    state: "Rajshahi",
    zip: "5800",
    ...overrides,
  };
}

describe("validateBilling — DELIVERY orders", () => {
  it("accepts a fully filled-in delivery billing form", () => {
    expect(validateBilling(billing(), "DELIVERY")).toBeNull();
  });

  it("rejects a missing delivery-only field (email)", () => {
    const result = validateBilling(billing({ email: "" }), "DELIVERY");
    expect(result).toMatch(/email/i);
  });

  it("rejects a missing delivery-only field (address)", () => {
    const result = validateBilling(billing({ address: "" }), "DELIVERY");
    expect(result).toMatch(/address/i);
  });

  it("rejects a missing always-required field (phone) even with everything else present", () => {
    const result = validateBilling(billing({ phone: "" }), "DELIVERY");
    expect(result).toMatch(/phone/i);
  });

  it("defaults to DELIVERY rules when orderType is omitted", () => {
    const result = validateBilling(billing({ email: "" }));
    expect(result).toMatch(/email/i);
  });
});

describe("validateBilling — DINE_IN orders (QR table ordering)", () => {
  it("accepts a DINE_IN billing form with only name and phone — no delivery fields needed", () => {
    const dineInBilling: Billing = {
      firstName: "Karim",
      lastName: "Ahmed",
      phone: "01812345678",
    };
    expect(validateBilling(dineInBilling, "DINE_IN")).toBeNull();
  });

  it("still requires firstName/lastName/phone for DINE_IN", () => {
    const result = validateBilling(
      { firstName: "", lastName: "Ahmed", phone: "01812345678" },
      "DINE_IN"
    );
    expect(result).toMatch(/firstName/i);
  });

  it("does NOT reject a DINE_IN order for a missing email/address — those aren't required", () => {
    const dineInBilling: Billing = {
      firstName: "Karim",
      lastName: "Ahmed",
      phone: "01812345678",
    };
    // No email, address, city, state, zip at all — must still pass.
    expect(validateBilling(dineInBilling, "DINE_IN")).toBeNull();
  });
});

describe("validateBilling — phone format", () => {
  it("accepts a plain local number and an international +-prefixed one", () => {
    expect(validateBilling(billing({ phone: "01712345678" }))).toBeNull();
    expect(validateBilling(billing({ phone: "+8801712345678" }))).toBeNull();
  });

  it("rejects letters or symbols in the phone number", () => {
    const result = validateBilling(billing({ phone: "017-ABCDEFG" }));
    expect(result).toMatch(/digits/i);
  });

  it("rejects a phone number that's too short or too long", () => {
    expect(validateBilling(billing({ phone: "12345" }))).toMatch(/digits/i);
    expect(validateBilling(billing({ phone: "1".repeat(20) }))).toMatch(/digits/i);
  });
});

describe("calcGiftCardAmountToApply", () => {
  it("applies the full order total when the gift card balance covers it", () => {
    expect(calcGiftCardAmountToApply(300, 500)).toBe(300);
  });

  it("caps the applied amount at the remaining gift card balance", () => {
    expect(calcGiftCardAmountToApply(500, 300)).toBe(300);
  });

  it("never returns a negative amount for an already-zeroed-out total", () => {
    expect(calcGiftCardAmountToApply(-50, 300)).toBe(0);
  });

  it("returns 0 when the order total is already fully covered elsewhere", () => {
    expect(calcGiftCardAmountToApply(0, 300)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(calcGiftCardAmountToApply(10.005, 100)).toBeCloseTo(10.01, 2);
  });
});