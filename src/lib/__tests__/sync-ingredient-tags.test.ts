import { describe, expect, it } from "vitest";
import { renameIngredientTag } from "@/lib/sync-ingredient-tags";

describe("renameIngredientTag", () => {
  it("replaces the old name in place", () => {
    expect(renameIngredientTag(["Bun", "Test Chicken", "Lettuce"], "Test Chicken", "Chicken Item")).toEqual([
      "Bun",
      "Chicken Item",
      "Lettuce",
    ]);
  });

  it("matches case-insensitively and ignores stray spaces", () => {
    expect(renameIngredientTag([" test chicken "], "Test Chicken", "Chicken Item")).toEqual(["Chicken Item"]);
  });

  it("removes the duplicate a rename can create", () => {
    expect(renameIngredientTag(["Chicken Item", "Test Chicken"], "Test Chicken", "Chicken Item")).toEqual([
      "Chicken Item",
    ]);
  });

  it("leaves unrelated tags untouched", () => {
    expect(renameIngredientTag(["Salt", "Oil"], "Test Chicken", "Chicken Item")).toEqual(["Salt", "Oil"]);
  });
});
