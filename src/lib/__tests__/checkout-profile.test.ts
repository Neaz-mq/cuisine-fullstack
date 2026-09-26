import { describe, expect, it } from "vitest";
import { buildCheckoutProfile, splitE164 } from "@/lib/checkout-profile";
import { addressFromOsm } from "@/lib/geocode";

const user = { name: "Shepon Sardar", email: "shepon@example.com", phone: null };
const order = {
  firstName: "Shepon",
  lastName: "S",
  phone: "01785286936",
  country: "Bangladesh",
  address: "House 12, Road 11, Banani",
  apartment: "Flat 4B",
  city: "Dhaka",
  state: "Dhaka Division",
  zip: "1213",
};

describe("splitE164", () => {
  it("splits an international number into country + national part", () => {
    expect(splitE164("+8801785286936")).toEqual({ number: "1785286936", countryCode: "BD" });
  });
  it("returns null for garbage", () => {
    expect(splitE164("hello")).toBeNull();
  });
});

describe("buildCheckoutProfile", () => {
  it("Google account, no orders yet → name + email only", () => {
    const profile = buildCheckoutProfile(user, null);
    expect(profile).toEqual({ fullName: "Shepon Sardar", email: "shepon@example.com", phone: null, address: null });
  });

  it("uses the last delivery order's phone and address", () => {
    const profile = buildCheckoutProfile(user, order);
    expect(profile.fullName).toBe("Shepon Sardar"); // account name wins
    expect(profile.phone).toEqual({ number: "01785286936", countryCode: null, countryName: "Bangladesh" });
    expect(profile.address).toEqual({
      address: "House 12, Road 11, Banani",
      apartment: "Flat 4B",
      city: "Dhaka",
      state: "Dhaka Division",
      zip: "1213",
    });
  });

  it("falls back to the registration phone, then the order name", () => {
    const profile = buildCheckoutProfile({ name: null, email: "a@b.co", phone: "+8801785286936" }, null);
    expect(profile.phone).toEqual({ number: "1785286936", countryCode: "BD", countryName: null });
    expect(buildCheckoutProfile({ ...user, name: " " }, order).fullName).toBe("Shepon S");
  });

  it("an order without an address gives no address", () => {
    const profile = buildCheckoutProfile(user, { ...order, address: null, city: null });
    expect(profile.address).toBeNull();
  });
});

describe("addressFromOsm", () => {
  it("builds the street line from house number, road and area", () => {
    expect(
      addressFromOsm({
        house_number: "12",
        road: "Road 11",
        suburb: "Banani",
        city: "Dhaka",
        state: "Dhaka Division",
        postcode: "1213",
        country: "Bangladesh",
        country_code: "bd",
      })
    ).toEqual({
      address: "12 Road 11, Banani",
      city: "Dhaka",
      state: "Dhaka Division",
      zip: "1213",
      country: "Bangladesh",
      countryCode: "BD",
    });
  });

  it("falls back to town / district and skips an area equal to the city", () => {
    const result = addressFromOsm({ neighbourhood: "Bogura", town: "Bogura", state_district: "Rajshahi Division" });
    expect(result.address).toBe("");
    expect(result.city).toBe("Bogura");
    expect(result.state).toBe("Rajshahi Division");
    expect(result.zip).toBe("");
  });
});

describe("currentLocationLimitKm", () => {
  it("uses the last delivery zone's limit in distance mode", async () => {
    const { currentLocationLimitKm, normalizeDeliveryZones } = await import("@/lib/delivery-zones");
    const zones = normalizeDeliveryZones([
      { upToKm: 3, fee: 2 },
      { upToKm: 8, fee: 5 },
    ]);
    expect(currentLocationLimitKm("DISTANCE", zones)).toBe(8);
  });

  it("falls back to 50 km for a flat fee or an open-ended last zone", async () => {
    const { currentLocationLimitKm, normalizeDeliveryZones, LOCATION_SANITY_KM } = await import("@/lib/delivery-zones");
    const open = normalizeDeliveryZones([
      { upToKm: 3, fee: 2 },
      { upToKm: null, fee: 9 },
    ]);
    expect(LOCATION_SANITY_KM).toBe(50);
    expect(currentLocationLimitKm("DISTANCE", open)).toBe(50);
    expect(currentLocationLimitKm("FLAT", [])).toBe(50);
  });
});
