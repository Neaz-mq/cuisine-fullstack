import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { cuidSchema } from "@/lib/validations/common";
import { updateInventoryItemSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";
import { syncIngredientTagsOnRename } from "@/lib/sync-ingredient-tags";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    // usedInRecipes tells the item's detail page which menu items would
    // be affected by editing/deactivating it — e.g. "used in 4 recipes"
    // before letting staff deactivate an item that's still load-bearing.
    include: {
      usedInRecipes: {
        select: { quantityRequired: true, menuItem: { select: { id: true, title: true } } },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const idCheck = cuidSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const parsed = await parseBody(req, updateInventoryItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  // ফাঁকা string → null, POST-এর একই কারণ (ওখানকার মন্তব্য দ্রষ্টব্য)।
  // `!== undefined` জরুরি: "পাঠানো হয়নি" (অপরিবর্তিত) আর "ফাঁকা
  // পাঠানো হয়েছে" (মুছে দাও) — দুটো আলাদা।
  const data = { ...parsed } as Record<string, unknown>;
  for (const key of ["category", "supplierId", "image"] as const) {
    if (parsed[key] !== undefined) data[key] = parsed[key] || null;
  }

  try {
    // A rename must reach the dishes that use this ingredient: their
    // customer-facing ingredient list holds a copy of the NAME. Rename and
    // copy-update happen in ONE transaction so they can't disagree.
    const updated = await prisma.$transaction(async (tx) => {
      const before =
        typeof parsed.name === "string"
          ? await tx.inventoryItem.findUnique({ where: { id }, select: { name: true } })
          : null;

      const item = await tx.inventoryItem.update({ where: { id }, data });

      if (before && before.name !== item.name) {
        await syncIngredientTagsOnRename(tx, id, before.name, item.name);
      }
      return item;
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "An inventory item with this name already exists." },
      { status: 409 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // Soft-disable, never a hard delete — an item with StockMovement/recipe
  // history has to stay queryable (see InventoryItem.isActive's schema
  // note). Same "deactivate, don't delete" pattern already used for
  // staff (StaffProfile.isActive).
  try {
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }
}