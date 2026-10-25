import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { cuidSchema } from "@/lib/validations/common";
import { updateMenuItemSchema } from "@/lib/validations/menu-item";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const idCheck = cuidSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const parsed = await parseBody(req, updateMenuItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  // parsed only ever contains keys defined on the MenuItem schema above —
  // this closes the previous mass-assignment gap where the raw request
  // body was passed straight to prisma's `data`.
  // `recipe` is NOT a MenuItem column — it's split off and written to
  // MenuItemIngredient in the same transaction as the dish fields.
  const { recipe, ...fields } = parsed;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.update({ where: { id }, data: fields });

      // undefined = "don't touch the recipe". Full replace otherwise,
      // exactly like PUT /api/admin/menu-items/[id]/ingredients.
      if (recipe !== undefined) {
        await tx.menuItemIngredient.deleteMany({ where: { menuItemId: id } });
        if (recipe.length > 0) {
          await tx.menuItemIngredient.createMany({
            data: recipe.map((line) => ({
              menuItemId: id,
              inventoryItemId: line.inventoryItemId,
              quantityRequired: line.quantityRequired,
            })),
          });
        }
      }
      return item;
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Couldn't save the item — check that it and every ingredient still exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Can't delete — this item has existing orders. Mark it unavailable instead." },
      { status: 409 }
    );
  }
}