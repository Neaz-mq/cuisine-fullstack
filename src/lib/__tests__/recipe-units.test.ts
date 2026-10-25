import { describe, expect, it } from "vitest";
import { compatibleUnits, convertQuantity, toDisplayQuantity } from "@/lib/recipe-units";

describe("recipe units", () => {
  it("converts within a family", () => {
    expect(convertQuantity(500, "GRAM", "KILOGRAM")).toBe(0.5);
    expect(convertQuantity(0.5, "KILOGRAM", "GRAM")).toBe(500);
    expect(convertQuantity(250, "MILLILITER", "LITER")).toBe(0.25);
  });

  it("refuses to convert across families", () => {
    expect(convertQuantity(1, "GRAM", "LITER")).toBeNaN();
    expect(convertQuantity(1, "PIECE", "GRAM")).toBeNaN();
  });

  it("only offers same-family units", () => {
    expect(compatibleUnits("KILOGRAM")).toEqual(["GRAM", "KILOGRAM"]);
    expect(compatibleUnits("PIECE")).toEqual(["PIECE"]);
  });

  it("shows small Kg/L amounts in g/ml", () => {
    expect(toDisplayQuantity(0.5, "KILOGRAM")).toEqual({ value: 500, unit: "GRAM" });
    expect(toDisplayQuantity(2, "KILOGRAM")).toEqual({ value: 2, unit: "KILOGRAM" });
    expect(toDisplayQuantity(0.25, "LITER")).toEqual({ value: 250, unit: "MILLILITER" });
  });

  it("20 Kg minus 500 g is 19.5 Kg", () => {
    const perServing = convertQuantity(500, "GRAM", "KILOGRAM");
    expect(20 - perServing).toBe(19.5);
  });
});
