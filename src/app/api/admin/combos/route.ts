import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createComboSchema } from "@/lib/validations/combo";
import { parseBody } from "@/lib/validations/parse";

// Combos are part of the menu, so they use the "menu" scope (OWNER + MANAGER) —
// the same one /api/admin/upload-image already accepts for the combo photo.
export async function POST(req: NextRequest) {
  const result = await requireApiScope("menu");
  if (result instanceof NextResponse) return result;

  const parsed = await parseBody(req, createComboSchema);
  if (parsed instanceof NextResponse) return parsed;

  const ids = parsed.items.map((i) => i.menuItemId);
  const found = await prisma.menuItem.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    return NextResponse.json(
      { error: "One of the selected menu items no longer exists. Refresh and try again." },
      { status: 400 }
    );
  }

  const combo = await prisma.combo.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      imageUrl: parsed.imageUrl ?? null,
      isActive: parsed.isActive ?? true,
      sortOrder: parsed.sortOrder ?? 999,
      items: { create: parsed.items },
    },
    select: { id: true },
  });

  return NextResponse.json(combo, { status: 201 });
}