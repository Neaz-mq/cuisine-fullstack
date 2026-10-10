import { describe, expect, it } from "vitest";
import { buildMenuHighlights, type HighlightSourceItem } from "@/lib/menu-highlights";

const item = (over: Partial<HighlightSourceItem> & { id: string }): HighlightSourceItem => ({
  title: over.id,
  priceLabel: "$10.00",
  oldPriceLabel: null,
  imageUrl: null,
  isAvailable: true,
  proteinGrams: null,
  prepTimeMinutes: null,
  rating: null,
  ...over,
});

const keys = (items: HighlightSourceItem[]) =>
  buildMenuHighlights([{ items }]).map((group) => group.key);

describe("buildMenuHighlights", () => {
  it("returns nothing when no dish has the data", () => {
    expect(buildMenuHighlights([{ items: [item({ id: "a" })] }])).toEqual([]);
    expect(buildMenuHighlights([])).toEqual([]);
  });

  it("ignores unavailable dishes", () => {
    const groups = buildMenuHighlights([
      { items: [item({ id: "a", isAvailable: false, rating: 5, prepTimeMinutes: 5, proteinGrams: 50 })] },
    ]);
    expect(groups).toEqual([]);
  });

  it("favorites need a rating of at least 4.0 and sort best first", () => {
    const [group] = buildMenuHighlights([
      {
        items: [
          item({ id: "low", rating: 3.9 }),
          item({ id: "good", rating: 4.2 }),
          item({ id: "best", rating: 4.9 }),
        ],
      },
    ]);
    expect(group.key).toBe("favorites");
    expect(group.dishes.map((d) => d.id)).toEqual(["best", "good"]);
    expect(group.dishes[0].metric).toBe("4.9");
  });

  it("quick sorts by shortest prep time and skips unknown or zero", () => {
    const [group] = buildMenuHighlights([
      {
        items: [
          item({ id: "slow", prepTimeMinutes: 40 }),
          item({ id: "unknown" }),
          item({ id: "zero", prepTimeMinutes: 0 }),
          item({ id: "fast", prepTimeMinutes: 10 }),
        ],
      },
    ]);
    expect(group.key).toBe("quick");
    expect(group.dishes.map((d) => d.id)).toEqual(["fast", "slow"]);
    expect(group.dishes[0].metric).toBe("10 min");
  });

  it("protein sorts by most grams and rounds to one decimal", () => {
    const [group] = buildMenuHighlights([
      {
        items: [
          item({ id: "a", proteinGrams: 12.34 }),
          item({ id: "b", proteinGrams: 40 }),
          item({ id: "none", proteinGrams: 0 }),
        ],
      },
    ]);
    expect(group.key).toBe("protein");
    expect(group.dishes.map((d) => d.id)).toEqual(["b", "a"]);
    expect(group.dishes[1].metric).toBe("12.3 g protein");
  });

  it("a dish appears in only one group (favorites, then quick, then protein)", () => {
    const groups = buildMenuHighlights([
      {
        items: [
          item({ id: "star", rating: 5, prepTimeMinutes: 5, proteinGrams: 60 }),
          item({ id: "other", prepTimeMinutes: 20, proteinGrams: 30 }),
        ],
      },
    ]);
    const all = groups.flatMap((g) => g.dishes.map((d) => d.id));
    expect(new Set(all).size).toBe(all.length);
    expect(groups.find((g) => g.key === "favorites")?.dishes[0].id).toBe("star");
  });

  it("caps each group at three and links to the dish page", () => {
    const items = ["a", "b", "c", "d", "e"].map((id, i) =>
      item({ id, prepTimeMinutes: i + 1 })
    );
    const [group] = buildMenuHighlights([{ items }]);
    expect(group.dishes).toHaveLength(3);
    expect(group.dishes[0].href).toBe("/menu/a");
  });

  it("keeps the offer price labels", () => {
    const [group] = buildMenuHighlights([
      { items: [item({ id: "a", rating: 4.5, priceLabel: "$9.00", oldPriceLabel: "$10.00" })] },
    ]);
    expect(group.dishes[0].priceLabel).toBe("$9.00");
    expect(group.dishes[0].oldPriceLabel).toBe("$10.00");
  });

  it("drops groups that end up empty", () => {
    expect(keys([item({ id: "a", prepTimeMinutes: 10 })])).toEqual(["quick"]);
  });
});