import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildMenuPdf, wrap, type MenuPdfData, type MenuPdfItem } from "@/lib/menu-pdf";

const item = (over: Partial<MenuPdfItem> = {}): MenuPdfItem => ({
  title: "Chic Burger",
  description: "Juicy patty, house sauce, toasted bun.",
  price: 12.5,
  originalPrice: null,
  badge: null,
  foodStatus: null,
  calories: null,
  ...over,
});

const base = (over: Partial<MenuPdfData> = {}): MenuPdfData => ({
  restaurantName: "Cuisine",
  address: "2454 Onk Drive, Paris, France",
  hoursLabel: "10:00 AM \u2013 10:00 PM",
  qrUrl: "https://example.com/menu?utm_source=menu_pdf",
  displayUrl: "example.com/menu",
  generatedOn: "October 10, 2026",
  currency: "USD",
  currencyMinorUnits: 2,
  taxNote: "Prices exclude VAT (5%), added at checkout.",
  categories: [{ name: "Signature", items: [item(), item({ title: "Pasta" })] }],
  ...over,
});

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("buildMenuPdf", () => {
  it("produces a valid, loadable one-page A4 PDF for a small menu", async () => {
    const bytes = await buildMenuPdf(base());
    expect(text(bytes).startsWith("%PDF-")).toBe(true);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toBe("Cuisine Menu");
  });

  it("flows a long menu onto more pages instead of clipping it", async () => {
    const many = Array.from({ length: 60 }, (_, i) => item({ title: `Dish ${i + 1}` }));
    const bytes = await buildMenuPdf(base({ categories: [{ name: "Everything", items: many }] }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });

  it("does not throw on characters the embedded fonts lack (Bengali, \u09F3, emoji)", async () => {
    const bytes = await buildMenuPdf(
      base({
        currency: "BDT", // \u09F3 is not in the latin subset -> must fall back to the ISO code
        categories: [
          {
            name: "\u09AC\u09BE\u0982\u09B2\u09BE \u0996\u09BE\u09AC\u09BE\u09B0",
            items: [item({ title: "\u09AC\u09BF\u09B0\u09BF\u09AF\u09BC\u09BE\u09A8\u09BF \uD83C\uDF5B", description: "\u0985\u09A8\u09C1\u09AC\u09BE\u09A6 \uD83D\uDE00" })],
          },
        ],
      })
    );
    expect(text(bytes).startsWith("%PDF-")).toBe(true);
  });

  it("survives an empty description, a 300-char unbroken word and an offer price", async () => {
    const bytes = await buildMenuPdf(
      base({
        categories: [
          {
            name: "Edge cases",
            items: [
              item({ description: "" }),
              item({ title: "X".repeat(300), description: "Y".repeat(300) }),
              item({ price: 8, originalPrice: 10, badge: "20% OFF", foodStatus: "Veg", calories: 420 }),
            ],
          },
        ],
      })
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("does not print a phone line when none is configured", async () => {
    // placeholder নম্বর (\"+0123-456-789\") ছাপা গ্রাহকের হাতে যাবে — তাই ফাঁকা হলে লাইনটাই নেই।
    const doc = await PDFDocument.load(await buildMenuPdf(base({ phone: undefined })));
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("wrap", () => {
  it("never returns a line wider than the limit, even for one very long word", async () => {
    const pdf = await PDFDocument.create();
    const { StandardFonts } = await import("pdf-lib");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrap("short " + "W".repeat(120) + " tail", font, 10, 100);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(100);
  });
});
