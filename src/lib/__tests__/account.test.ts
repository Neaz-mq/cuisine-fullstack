import { describe, expect, it } from "vitest";
import {
  firstNameOf,
  greetingFor,
  isActiveOrder,
  orderStepIndex,
  orderSteps,
  parseOrdersTab,
  statusesForTab,
  topDishes,
} from "@/lib/account";
import { addressSchema, parseBirthDate, passwordSchema, preferencesSchema, profileSchema } from "@/lib/validations/account";
import { buildCheckoutProfile } from "@/lib/checkout-profile";

describe("customer panel helpers", () => {
  it("knows which orders are still live", () => {
    expect(isActiveOrder("PLACED")).toBe(true);
    expect(isActiveOrder("OUT_FOR_DELIVERY")).toBe(true);
    expect(isActiveOrder("DELIVERED")).toBe(false);
    expect(isActiveOrder("CANCELLED")).toBe(false);
  });

  it("uses dine-in wording for table orders", () => {
    expect(orderSteps("DELIVERY")[2]).toBe("On the way");
    expect(orderSteps("DINE_IN")[2]).toBe("Ready to serve");
    expect(orderStepIndex("PREPARING")).toBe(1);
    expect(orderStepIndex("CANCELLED")).toBe(-1);
  });

  it("reads the orders tab from the URL safely", () => {
    expect(parseOrdersTab("active")).toBe("active");
    expect(parseOrdersTab("hack")).toBe("all");
    expect(parseOrdersTab(undefined)).toBe("all");
    expect(statusesForTab("completed")).toEqual(["DELIVERED"]);
    expect(statusesForTab("all")).toBeUndefined();
  });

  it("ranks favourites by quantity, ignoring cancelled orders", () => {
    const day = (n: number) => new Date(2026, 8, n);
    const result = topDishes([
      { menuItemId: "burger", quantity: 2, orderedAt: day(1), orderStatus: "DELIVERED" },
      { menuItemId: "pizza", quantity: 1, orderedAt: day(5), orderStatus: "DELIVERED" },
      { menuItemId: "burger", quantity: 1, orderedAt: day(6), orderStatus: "DELIVERED" },
      { menuItemId: "pasta", quantity: 9, orderedAt: day(7), orderStatus: "CANCELLED" },
      { menuItemId: "soup", quantity: 1, orderedAt: day(8), orderStatus: "PLACED" },
    ]);
    expect(result).toEqual([
      { menuItemId: "burger", timesOrdered: 3 },
      { menuItemId: "soup", timesOrdered: 1 }, // tie with pizza → more recent first
      { menuItemId: "pizza", timesOrdered: 1 },
    ]);
  });

  it("greets by the restaurant's local time", () => {
    // 03:00 UTC = 09:00 in Dhaka
    expect(greetingFor(new Date("2026-09-27T03:00:00Z"), "Asia/Dhaka")).toBe("Good morning");
    expect(greetingFor(new Date("2026-09-27T09:00:00Z"), "Asia/Dhaka")).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-09-27T15:00:00Z"), "Asia/Dhaka")).toBe("Good evening");
  });

  it("finds a friendly first name", () => {
    expect(firstNameOf("Md. Neaz Morshed")).toBe("Neaz");
    expect(firstNameOf("Shepon Sardar")).toBe("Shepon");
    expect(firstNameOf(null, "neaz@gmail.com")).toBe("neaz");
    expect(firstNameOf("Md.")).toBe("Md.");
  });
});

describe("account validation", () => {
  it("accepts a valid profile and an empty phone", () => {
    expect(profileSchema.safeParse({ name: "Neaz", phone: "+8801785286930" }).success).toBe(true);
    expect(profileSchema.safeParse({ name: "Neaz", phone: "" }).success).toBe(true);
    expect(
      profileSchema.safeParse({ name: "Neaz", phone: "", dateOfBirth: "1998-05-14", gender: "male" }).success
    ).toBe(true);
  });

  it("rejects an empty name or a bad phone", () => {
    expect(profileSchema.safeParse({ name: " ", phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Neaz", phone: "+88012" }).success).toBe(false);
  });

  it("rejects a made-up birth date or gender", () => {
    expect(profileSchema.safeParse({ name: "Neaz", phone: "", dateOfBirth: "1998-02-31" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Neaz", phone: "", dateOfBirth: "3000-01-01" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Neaz", phone: "", gender: "robot" }).success).toBe(false);
  });

  it("reads a birth date as a real calendar day", () => {
    const today = new Date(2026, 8, 28);
    expect(parseBirthDate("1998-05-14", today)?.toISOString()).toBe("1998-05-14T00:00:00.000Z");
    expect(parseBirthDate("2024-02-29", today)).not.toBeNull();
    expect(parseBirthDate("2023-02-29", today)).toBeNull();
    expect(parseBirthDate("1899-12-31", today)).toBeNull();
    expect(parseBirthDate("2026-09-29", today)).toBeNull();
    expect(parseBirthDate("14/05/1998", today)).toBeNull();
  });

  it("needs at least one preference switch", () => {
    expect(preferencesSchema.safeParse({}).success).toBe(false);
    expect(preferencesSchema.safeParse({ orderUpdates: false }).success).toBe(true);
    expect(preferencesSchema.safeParse({ marketingConsent: "yes" }).success).toBe(false);
  });

  it("accepts an address phone or none, but not a made-up one", () => {
    const base = { label: "Office", address: "Road 1", city: "Dhaka", state: "Dhaka", zip: "1212" };
    expect(addressSchema.safeParse(base).success).toBe(true);
    expect(addressSchema.safeParse({ ...base, phone: "+8801785286930" }).success).toBe(true);
    expect(addressSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
  });

  it("needs a strong enough new password (8+, uppercase, number or symbol)", () => {
    expect(passwordSchema.safeParse({ newPassword: "12345" }).success).toBe(false);
    expect(passwordSchema.safeParse({ currentPassword: "old", newPassword: "abcdefgh" }).success).toBe(false);
    expect(passwordSchema.safeParse({ currentPassword: "old", newPassword: "Abcdefgh" }).success).toBe(false);
    expect(passwordSchema.safeParse({ currentPassword: "old", newPassword: "Abcdefg1" }).success).toBe(true);
    expect(passwordSchema.safeParse({ newPassword: "Abcdefg!" }).success).toBe(true);
  });

  it("requires the main address fields", () => {
    const ok = addressSchema.safeParse({ label: "Home", address: "Road 11", city: "Bogura", state: "Rajshahi", zip: "5800" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ apartment: "", isDefault: false });
    expect(addressSchema.safeParse({ label: "Home", address: "", city: "Bogura", state: "R", zip: "1" }).success).toBe(false);
  });
});

describe("checkout pre-fill with the address book", () => {
  const user = { name: "Neaz", email: "n@g.com", phone: "+8801785286930" };
  const lastOrder = {
    firstName: "Neaz",
    lastName: "",
    phone: "01711111111",
    country: "Bangladesh",
    address: "Old Road",
    apartment: null,
    city: "Dhaka",
    state: "Dhaka",
    zip: "1000",
  };
  const saved = [
    { id: "a", label: "Work", address: "Office Rd", apartment: null, city: "Bogura", state: "Rajshahi", zip: "5800", phone: null, isDefault: false },
    { id: "b", label: "Home", address: "Home Rd", apartment: "2A", city: "Bogura", state: "Rajshahi", zip: "5800", phone: "+8801711000000", isDefault: true },
  ];

  it("prefers the default saved address and the profile phone", () => {
    const profile = buildCheckoutProfile(user, lastOrder, saved);
    expect(profile.address).toEqual({ address: "Home Rd", apartment: "2A", city: "Bogura", state: "Rajshahi", zip: "5800" });
    expect(profile.phone).toEqual({ number: "1785286930", countryCode: "BD", countryName: null });
    expect(profile.addresses).toHaveLength(2);
  });

  it("falls back to the last order when nothing is saved", () => {
    const profile = buildCheckoutProfile({ ...user, phone: null }, lastOrder, []);
    expect(profile.address?.address).toBe("Old Road");
    expect(profile.phone?.number).toBe("01711111111");
  });
});

import { pageList, targetProgress } from "@/lib/account";

describe("targetProgress", () => {
  const tiers = [
    { label: "Regular", minPoints: 0, discountPercent: 0, pointsMultiplier: 1 },
    { label: "VIP", minPoints: 80, discountPercent: 5, pointsMultiplier: 1.2 },
    { label: "Gold", minPoints: 500, discountPercent: 5, pointsMultiplier: 1.25 },
  ];
  it("targets the next level", () => {
    expect(targetProgress(10, tiers)).toEqual({
      target: 80,
      percent: 12,
      nextLabel: "VIP",
      reward: "5% off every order + 20% bonus points",
    });
  });
  it("is complete at the top level", () => {
    expect(targetProgress(900, tiers)).toMatchObject({ target: null, percent: 100, nextLabel: null });
  });
});

describe("pageList", () => {
  it("lists every page when there are few", () => {
    expect(pageList(1, 4)).toEqual([1, 2, 3, 4]);
  });
  it("adds gaps like Figma (1 2 3 … 6)", () => {
    expect(pageList(1, 6)).toEqual([1, 2, 3, null, 6]);
    expect(pageList(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageList(10, 10)).toEqual([1, null, 8, 9, 10]);
  });
});
