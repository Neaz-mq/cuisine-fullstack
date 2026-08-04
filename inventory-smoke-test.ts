/**
 * Inventory Management — Phase 1 smoke test
 *
 * Standalone script (NOT part of the vitest/jest suite) — run once by hand
 * to sanity-check the new schema end-to-end against your real dev DB:
 *   1. Creates an InventoryItem (or reuses "Chicken" if you already made one
 *      in Prisma Studio)
 *   2. Links it to an existing MenuItem via MenuItemIngredient
 *   3. Records a PURCHASE StockMovement and checks currentStock updates
 *      correctly and atomically (mirrors the LoyaltyTransaction pattern)
 *   4. Records an ORDER_DEDUCTION and checks currentStock decreases
 *   5. Cleans up everything it created (the pre-existing "Chicken" row and
 *      any MenuItem you already have are left untouched)
 *
 * Usage:
 *   npx tsx inventory-smoke-test.ts
 *
 * (If you don't have tsx: npm i -D tsx --save-dev, or run via
 *  `npx ts-node inventory-smoke-test.ts` if ts-node is already configured.)
 *
 * Place this file anywhere in your repo (project root is fine) — it uses
 * your existing PrismaClient import path, so double-check the import below
 * matches src/generated/prisma per your schema's generator output.
 */

import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function main() {
  console.log("── Inventory Management smoke test ──────────────────────\n");

  // ── Step 0: find an existing MenuItem to attach a recipe to ──────────
  const menuItem = await prisma.menuItem.findFirst();
  assert(!!menuItem, "found an existing MenuItem to test against");
  if (!menuItem) return; // unreachable, but keeps TS happy below

  // ── Step 1: create (or reuse) an InventoryItem ────────────────────────
  const inventoryItem = await prisma.inventoryItem.upsert({
    where: { name: "Smoke Test Chicken" },
    update: {},
    create: {
      name: "Smoke Test Chicken",
      unit: "KILOGRAM",
      currentStock: 0,
      reorderThreshold: 2,
      costPerUnit: 350,
    },
  });
  assert(inventoryItem.currentStock === 0, "InventoryItem created with currentStock = 0");

  // ── Step 2: link it to the menu item via a recipe row ─────────────────
  const recipe = await prisma.menuItemIngredient.upsert({
    where: {
      menuItemId_inventoryItemId: {
        menuItemId: menuItem.id,
        inventoryItemId: inventoryItem.id,
      },
    },
    update: { quantityRequired: 0.25 },
    create: {
      menuItemId: menuItem.id,
      inventoryItemId: inventoryItem.id,
      quantityRequired: 0.25, // 250g chicken per unit sold
    },
  });
  assert(recipe.quantityRequired === 0.25, "MenuItemIngredient recipe row created (250g per unit)");

  // ── Step 3: record a PURCHASE — stock should go up atomically ─────────
  const afterPurchase = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { currentStock: { increment: 10 } }, // buy 10kg
    });

    await tx.stockMovement.create({
      data: {
        type: "PURCHASE",
        quantityChange: 10,
        resultingStock: updated.currentStock,
        note: "smoke-test purchase",
        inventoryItemId: inventoryItem.id,
      },
    });

    return updated;
  });
  assert(afterPurchase.currentStock === 10, "currentStock is 10 after a 10kg PURCHASE");

  const purchaseMovement = await prisma.stockMovement.findFirst({
    where: { inventoryItemId: inventoryItem.id, type: "PURCHASE" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!purchaseMovement && purchaseMovement.resultingStock === 10,
    "StockMovement ledger row recorded with resultingStock = 10"
  );

  // ── Step 4: simulate an ORDER_DEDUCTION — stock should go down ────────
  // (This is the same shape the real PREPARING-status hook will use later:
  // one transaction, decrement + ledger row together, race-safe.)
  const deductionQty = recipe.quantityRequired * 2; // as if 2 units were ordered
  const afterDeduction = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { currentStock: { decrement: deductionQty } },
    });

    await tx.stockMovement.create({
      data: {
        type: "ORDER_DEDUCTION",
        quantityChange: -deductionQty,
        resultingStock: updated.currentStock,
        inventoryItemId: inventoryItem.id,
      },
    });

    return updated;
  });
  assert(
    Math.abs(afterDeduction.currentStock - (10 - deductionQty)) < 1e-9,
    `currentStock correctly reduced to ${10 - deductionQty} after ORDER_DEDUCTION`
  );

  // ── Step 5: relation reads work both directions ────────────────────────
  const itemWithMovements = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItem.id },
    include: { stockMovements: true, usedInRecipes: true },
  });
  assert(
    (itemWithMovements?.stockMovements.length ?? 0) === 2,
    "InventoryItem.stockMovements relation returns both ledger rows"
  );
  assert(
    (itemWithMovements?.usedInRecipes.length ?? 0) === 1,
    "InventoryItem.usedInRecipes relation returns the recipe row"
  );

  const menuItemWithIngredients = await prisma.menuItem.findUnique({
    where: { id: menuItem.id },
    include: { ingredients: true },
  });
  assert(
    (menuItemWithIngredients?.ingredients.length ?? 0) >= 1,
    "MenuItem.ingredients relation returns the recipe row"
  );

  // ── Cleanup — remove everything this script created ────────────────────
  await prisma.stockMovement.deleteMany({ where: { inventoryItemId: inventoryItem.id } });
  await prisma.menuItemIngredient.delete({ where: { id: recipe.id } });
  await prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
  console.log("\n🧹 Cleaned up test data (Smoke Test Chicken + its movements/recipe removed)");

  console.log("\n── All checks passed ──────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("\n💥 Smoke test failed:\n", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });