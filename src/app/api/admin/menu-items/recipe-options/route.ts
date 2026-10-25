import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { hasPermission } from "@/lib/permissions";

/**
 * GET /api/admin/menu-items/recipe-options
 *
 * The ingredient picker in the Add/Edit Menu Item modal: every ACTIVE
 * inventory item, by name + unit only. Gated on "menu" (not "inventory"),
 * so menu staff can build recipes, but stock levels and costs are never
 * returned here — same rule as GET /api/admin/menu-items/[id]/ingredients.
 *
 * EXCEPTION: staff who also hold the "inventory" scope (owner/manager) get
 * `costPerUnit` and `currentStock` too. That is what powers the live
 * "food cost %" and "stock covers N servings" panel in the menu popup —
 * costs are management information, so everyone else never receives them.
 */
export async function GET() {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const role = (authResult.user as { role?: string } | undefined)?.role;
  const canSeeCosts = hasPermission(role, "inventory");

  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
  });

  return NextResponse.json(
    items.map((item) =>
      canSeeCosts
        ? {
            id: item.id,
            name: item.name,
            unit: item.unit,
            costPerUnit: Number(item.costPerUnit),
            currentStock: item.currentStock,
          }
        : { id: item.id, name: item.name, unit: item.unit }
    )
  );
}
