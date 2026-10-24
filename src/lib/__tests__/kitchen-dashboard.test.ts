import { describe, it, expect } from "vitest";
import {
  averagePrepMinutes,
  buildPrepSnapshot,
  joinNames,
  percentChange,
  plural,
  summarizeInventory,
  type PrepOrder,
} from "@/lib/kitchen-dashboard";
import { isShiftOnDuty } from "@/lib/staff-shift";

const at = (hour: number, minute = 0) => new Date(2026, 9, 24, hour, minute);

describe("percentChange", () => {
  it("is null when last week had nothing to compare with", () => {
    expect(percentChange(5, 0)).toBeNull();
  });
  it("rounds to whole percent, up and down", () => {
    expect(percentChange(104, 100)).toBe(4);
    expect(percentChange(90, 100)).toBe(-10);
    expect(percentChange(100, 100)).toBe(0);
  });
});

describe("averagePrepMinutes", () => {
  const start = new Date(2026, 9, 24, 12, 0);
  const plus = (m: number) => new Date(start.getTime() + m * 60000);

  it("averages preparing → dispatched in whole minutes", () => {
    expect(
      averagePrepMinutes([
        { preparingAt: start, dispatchedAt: plus(10) },
        { preparingAt: start, dispatchedAt: plus(13) },
      ])
    ).toBe(12); // 11.5 → 12
  });
  it("ignores orders missing a timestamp, negative spans and forgotten >4h orders", () => {
    expect(
      averagePrepMinutes([
        { preparingAt: null, dispatchedAt: plus(10) },
        { preparingAt: start, dispatchedAt: null },
        { preparingAt: plus(5), dispatchedAt: start },
        { preparingAt: start, dispatchedAt: plus(600) },
      ])
    ).toBeNull();
  });
  it("is null with no rows", () => {
    expect(averagePrepMinutes([])).toBeNull();
  });
});

describe("summarizeInventory", () => {
  const item = (id: string, currentStock: number, reorder = 5, emergency = 2) => ({
    id,
    name: id,
    currentStock,
    reorderThreshold: reorder,
    emergencyThreshold: emergency,
  });

  it("counts low + emergency + out as attention, emergency + out as urgent", () => {
    const glance = summarizeInventory([
      item("fine", 20),
      item("low", 4),
      item("emergency", 1),
      item("out", 0),
    ]);
    expect(glance.attention).toBe(3);
    expect(glance.urgent).toBe(2);
  });
  it("lists urgent items emptiest first", () => {
    const glance = summarizeInventory([item("a", 2), item("b", 0), item("c", 1)]);
    expect(glance.urgentItems.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
  it("does not flag items whose thresholds were never set", () => {
    expect(summarizeInventory([item("x", 3, 0, 0)]).attention).toBe(0);
  });
});

describe("buildPrepSnapshot", () => {
  const dish = (
    status: string,
    quantity: number,
    ings: { id: string; name: string; per: number; unit?: string }[]
  ): PrepOrder => ({
    status,
    items: [
      {
        quantity,
        menuItem: {
          ingredients: ings.map((i) => ({
            quantityRequired: i.per,
            inventoryItem: { id: i.id, name: i.name, unit: i.unit ?? "KILOGRAM" },
          })),
        },
      },
    ],
  });

  it("sums a recipe × quantity per ingredient across orders", () => {
    const rows = buildPrepSnapshot([
      dish("PLACED", 2, [{ id: "chk", name: "Chicken Breast", per: 0.5 }]),
      dish("PLACED", 4, [{ id: "chk", name: "Chicken Breast", per: 0.5 }]),
    ]);
    expect(rows).toEqual([
      { id: "chk", label: "Prepare Chicken Breast", quantityLabel: "3 Kg", done: false },
    ]);
  });

  it("is done only when no order needing it is still PLACED", () => {
    const rows = buildPrepSnapshot([
      dish("PREPARING", 1, [{ id: "rice", name: "Rice", per: 1 }]),
      dish("DELIVERED", 1, [{ id: "rice", name: "Rice", per: 1 }]),
      dish("PLACED", 1, [{ id: "oil", name: "Oil", per: 1, unit: "LITER" }]),
      dish("PREPARING", 1, [{ id: "oil", name: "Oil", per: 1, unit: "LITER" }]),
    ]);
    expect(rows.find((r) => r.id === "rice")?.done).toBe(true);
    expect(rows.find((r) => r.id === "oil")?.done).toBe(false);
  });

  it("lists open rows first (most remaining first), done rows last", () => {
    const rows = buildPrepSnapshot([
      dish("PREPARING", 1, [{ id: "a", name: "Aaa", per: 9 }]),
      dish("PLACED", 1, [{ id: "b", name: "Bbb", per: 1 }]),
      dish("PLACED", 1, [{ id: "c", name: "Ccc", per: 5 }]),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("skips ingredients with a zero quantity and rounds float noise", () => {
    const rows = buildPrepSnapshot([
      dish("PLACED", 3, [
        { id: "z", name: "Zero", per: 0 },
        { id: "f", name: "Flour", per: 0.1 },
      ]),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantityLabel).toBe("0.3 Kg");
  });

  it("returns nothing for no orders", () => {
    expect(buildPrepSnapshot([])).toEqual([]);
  });
});

describe("isShiftOnDuty", () => {
  it("matches each shift's hours (end exclusive)", () => {
    expect(isShiftOnDuty("MORNING", at(6))).toBe(true);
    expect(isShiftOnDuty("MORNING", at(13, 59))).toBe(true);
    expect(isShiftOnDuty("MORNING", at(14))).toBe(false);
    expect(isShiftOnDuty("EVENING", at(14))).toBe(true);
    expect(isShiftOnDuty("EVENING", at(22))).toBe(false);
  });
  it("lets overlapping shifts both be on duty", () => {
    expect(isShiftOnDuty("AFTERNOON", at(12))).toBe(true);
    expect(isShiftOnDuty("MORNING", at(12))).toBe(true);
  });
  it("handles the night shift across midnight", () => {
    expect(isShiftOnDuty("NIGHT", at(23))).toBe(true);
    expect(isShiftOnDuty("NIGHT", at(2))).toBe(true);
    expect(isShiftOnDuty("NIGHT", at(6))).toBe(false);
    expect(isShiftOnDuty("NIGHT", at(12))).toBe(false);
  });
  it("is false with no shift assigned", () => {
    expect(isShiftOnDuty(null, at(12))).toBe(false);
    expect(isShiftOnDuty(undefined, at(12))).toBe(false);
  });
});

describe("wording helpers", () => {
  it("plural", () => {
    expect(plural(1, "order", "orders")).toBe("order");
    expect(plural(0, "order", "orders")).toBe("orders");
  });
  it("joinNames", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C", "D"])).toBe("A, B and 2 more");
  });
});
