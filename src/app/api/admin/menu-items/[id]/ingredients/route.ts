import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { setMenuItemRecipeSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Gated on "menu" (not "inventory") — this is reached from the Menu
  // Items editor, where staff who can edit a dish's recipe are the same
  // staff who can edit the dish itself. Inventory item NAMES are visible
  // here to menu-scoped staff (so the recipe editor's ingredient picker
  // works), but nothing about stock levels or cost — see the GET
  // select below.
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const ingredients = await prisma.menuItemIngredient.findMany({
    where: { menuItemId: id },
    select: {
      id: true,
      quantityRequired: true,
      inventoryItem: { select: { id: true, name: true, unit: true } },
    },
  });

  return NextResponse.json(ingredients);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const { id: menuItemId } = await params;

  const parsed = await parseBody(req, setMenuItemRecipeSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Full-replace, not a diff — delete every existing recipe line for
  // this menu item and recreate the submitted set, in one transaction.
  // Simpler and less error-prone than reconciling add/remove/update per
  // line, and the admin UI always has the complete current list in hand
  // when it submits (see setMenuItemRecipeSchema's comment).
  try {
    const ingredients = await prisma.$transaction(async (tx) => {
      await tx.menuItemIngredient.deleteMany({ where: { menuItemId } });

      if (parsed.ingredients.length === 0) return [];

      await tx.menuItemIngredient.createMany({
        data: parsed.ingredients.map((line) => ({
          menuItemId,
          inventoryItemId: line.inventoryItemId,
          quantityRequired: line.quantityRequired,
        })),
      });

      return tx.menuItemIngredient.findMany({
        where: { menuItemId },
        select: {
          id: true,
          quantityRequired: true,
          inventoryItem: { select: { id: true, name: true, unit: true } },
        },
      });
    });

    return NextResponse.json(ingredients);
  } catch {
    return NextResponse.json(
      { error: "Couldn't save recipe — check that every ingredient still exists." },
      { status: 400 }
    );
  }
}