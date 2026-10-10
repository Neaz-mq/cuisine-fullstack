import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// PDF বানানো (ফন্ট parse + embed) CPU-ভারী: local-এ ~১s, ধীর CI runner-এ কয়েক গুণ। vitest-এর
// ডিফল্ট ৫s সেখানে অকারণে ফেল করায় (GitHub Actions-এ একবার করেছেও) — তাই এই ফাইলে সীমা ২০s।
vi.setConfig({ testTimeout: 20_000 });

const dec = (n: number) => ({ toNumber: () => n, equals: (o: { toNumber(): number }) => o.toNumber() === n });

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { category: { findMany: (...a: unknown[]) => findMany(...a) } } }));
vi.mock("@/lib/get-settings", () => ({
  getRestaurantSettings: async () => ({
    timezone: "Asia/Dhaka",
    kitchenOpenHour: 10,
    kitchenCloseHour: 22,
    currency: "USD",
    currencyMinorUnits: 2,
    taxEnabled: true,
    taxName: "VAT",
    taxMode: "EXCLUSIVE",
    taxRateDineIn: dec(0.05),
    taxRateDelivery: dec(0.05),
  }),
}));
vi.mock("@/lib/product-offers", () => ({
  findLiveOffers: async () => new Map(),
  displayPrice: (price: { toNumber(): number }) => ({
    price: price.toNumber(),
    priceLabel: "",
    oldPriceLabel: null,
    badge: null,
  }),
}));

import { GET } from "@/app/api/menu/pdf/route";

let ip = 0;
const call = (path = "/api/menu/pdf") =>
  // প্রতিটা call আলাদা IP — rate limiter-এর in-memory bucket যেন test-এ test-এ না লাগে।
  GET(new Request(`http://localhost:3000${path}`, { headers: { "x-forwarded-for": `10.0.0.${++ip}` } }));

const category = (items: unknown[]) => [{ id: "c1", name: "Signature", menuItems: items }];
const menuItem = { id: "m1", title: "Chic Burger", description: "Tasty", price: dec(12.5), foodStatus: null, calories: null, imageUrl: null };

describe("GET /api/menu/pdf", () => {
  // ⚠️ braces জরুরি: `() => findMany.mockReset()` mock-টাকেই return করে, আর vitest
  // beforeEach-এর return-করা function-কে cleanup ধরে test-এর পরে ডাকে — তখন
  // mockRejectedValue-র promise কেউ ধরে না, test "db down" দিয়ে ব্যর্থ দেখায়।
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns a PDF attachment with a dated filename and CDN caching", async () => {
    findMany.mockResolvedValue(category([menuItem]));
    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="cuisine-menu-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(Number(res.headers.get("Content-Length"))).toBe(bytes.length);
  });

  describe("photos", () => {
    afterEach(() => vi.unstubAllGlobals());
    const withPhoto = { ...menuItem, imageUrl: "https://res.cloudinary.com/dxohwanal/image/upload/v1/food/a.webp" };
    const countImages = async (res: Response) =>
      Buffer.from(await res.arrayBuffer()).toString("latin1").match(/\/Subtype\s*\/Image/g)?.length ?? 0;

    it("puts a fetched item photo into the PDF", async () => {
      const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#ff9540" } }).webp().toBuffer();
      vi.stubGlobal("fetch", vi.fn(async () => new Response(png as unknown as BodyInit, { status: 200 })));
      findMany.mockResolvedValue(category([withPhoto]));
      const res = await call();
      expect(res.status).toBe(200);
      expect(await countImages(res)).toBe(1);
    });

    it("still returns a PDF (without photos) when the image host fails", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));
      findMany.mockResolvedValue(category([withPhoto]));
      const res = await call();
      expect(res.status).toBe(200);
      expect(await countImages(res)).toBe(0);
    });

    it("never fetches an image from a host outside the allowlist", async () => {
      const spy = vi.fn(async () => new Response("x"));
      vi.stubGlobal("fetch", spy);
      findMany.mockResolvedValue(category([{ ...menuItem, imageUrl: "https://evil.example.com/a.jpg" }]));
      const res = await call();
      expect(res.status).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("opens inline with ?view=1", async () => {
    findMany.mockResolvedValue(category([menuItem]));
    const res = await call("/api/menu/pdf?view=1");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it("only asks the DB for available items (same filter as /api/menu)", async () => {
    findMany.mockResolvedValue(category([menuItem]));
    await call();
    const args = findMany.mock.calls[0][0];
    expect(args.include.menuItems.where).toEqual({ isAvailable: true });
  });

  it("returns 503 JSON, not an empty PDF, when nothing is on the menu", async () => {
    findMany.mockResolvedValue([{ id: "c1", name: "Empty", menuItems: [] }]);
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/menu/i);
  });

  it("returns 500 JSON when the database fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("db down"));
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
    spy.mockRestore();
  });

  it("rate-limits one client after 20 downloads in the window", async () => {
    // ⚠️ খালি মেনু (→ 503) ইচ্ছাকৃত: rate limit DB আর PDF বানানোর আগেই যাচাই হয়, তাই
    // এই test-এ ২১টা আসল PDF বানানোর দরকার নেই। আগে বানানো হতো — local-এ ৪.৬s, ধীর CI-তে
    // vitest-এর ৫s সীমা পেরিয়ে "Test timed out" দিত।
    findMany.mockResolvedValue([]);
    const same = () =>
      GET(new Request("http://localhost:3000/api/menu/pdf", { headers: { "x-forwarded-for": "203.0.113.9" } }));
    for (let i = 0; i < 20; i++) expect((await same()).status).not.toBe(429);
    const blocked = await same();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
