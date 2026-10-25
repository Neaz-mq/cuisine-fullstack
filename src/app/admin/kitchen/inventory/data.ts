import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { getOpenOrderQuantities } from "@/lib/supplier-order";
import type { InventoryRowItem } from "@/app/admin/inventory/InventoryRow";

/**
 * src/app/admin/kitchen/inventory/data.ts
 *
 * What the Kitchen > Inventory page and its Emergency page both need: every
 * active ingredient (as a row), the supplier list for the modals' dropdowns,
 * and the shop currency.
 *
 * ⚠️ Mirrors the query in /admin/inventory/page.tsx — change one, change the
 * other. Everything is fetched in one Promise.all (independent queries), and
 * the status / category filtering stays in memory on purpose: "currentStock <=
 * reorderThreshold" is a column-vs-column comparison Postgres can't do in an
 * indexed WHERE (see the @@index([isActive]) note in schema.prisma), and the
 * Overview numbers need the whole list anyway.
 */
export async function loadKitchenInventory() {
  const [rows, suppliers, settings, openOrders] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderThreshold: true,
        emergencyThreshold: true,
        maxCapacity: true,
        costPerUnit: true,
        category: true,
        supplierId: true,
        image: true,
        supplier: { select: { name: true } },
        // "Used in 8 menu items"
        _count: { select: { usedInRecipes: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    getRestaurantSettings(),
    // Pending / On-the-Way orders per ingredient: the row shows "on order" and
    // Restock warns before ordering the same thing twice.
    getOpenOrderQuantities(),
  ]);

  const items: InventoryRowItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    currentStock: row.currentStock,
    reorderThreshold: row.reorderThreshold,
    emergencyThreshold: row.emergencyThreshold,
    maxCapacity: row.maxCapacity,
    // Decimal -> number at the boundary (JSON.stringify would make it a string).
    costPerUnit: Number(row.costPerUnit),
    category: row.category,
    supplierId: row.supplierId,
    image: row.image,
    usedInRecipes: row._count.usedInRecipes,
    supplierName: row.supplier?.name ?? null,
    openOrder: openOrders.get(row.id) ?? null,
  }));

  return { items, suppliers, currency: settings.currency };
}

/** Where this panel's modals talk to — the "kitchen" scope, not "inventory". */
export const KITCHEN_INVENTORY_API = "/api/admin/kitchen/inventory";
export const KITCHEN_INVENTORY_PATH = "/admin/kitchen/inventory";
