import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/geo/reverse — checkout's "Use current location".
 * A location far outside the delivery area (VPN, desktop IP guess) must
 * never be turned into an address; a nearby one is.
 */

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }));
vi.mock("@/lib/get-settings", () => ({
  getRestaurantSettings: async () => ({
    deliveryFeeMode: "FLAT",
    deliveryZones: null,
    restaurantLat: 24.84491, // Bogura
    restaurantLng: 89.37532,
  }),
}));
const reverse = vi.fn();
vi.mock("@/lib/geocode", () => ({ reverseGeocode: (lat: number, lng: number) => reverse(lat, lng) }));

import { POST } from "@/app/api/geo/reverse/route";

const call = (lat: number, lng: number) =>
  POST(
    new Request("http://localhost/api/geo/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    })
  );

beforeEach(() => reverse.mockReset());

describe("POST /api/geo/reverse", () => {
  it("refuses a location on another continent and never looks it up", async () => {
    const res = await call(36.37, -96.0); // Skiatook, Oklahoma
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.far).toBe(true);
    expect(data.error).toMatch(/outside our delivery area/);
    expect(reverse).not.toHaveBeenCalled();
  });

  it("fills a nearby location", async () => {
    reverse.mockResolvedValue({
      ok: true,
      result: { address: "Sherpur Road", city: "Bogura", state: "Rajshahi Division", zip: "5800", country: "Bangladesh", countryCode: "BD" },
    });
    const res = await call(24.85, 89.37);
    expect(res.status).toBe(200);
    expect((await res.json()).city).toBe("Bogura");
  });

  it("rejects nonsense coordinates", async () => {
    expect((await call(200, 0)).status).toBe(400);
  });
});
