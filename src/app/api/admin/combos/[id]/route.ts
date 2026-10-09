import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateComboSchema } from "@/lib/validations/combo";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiScope("menu");
  if (result instanceof NextResponse) return result;

  const { id } = await params;

  const parsed = await parseBody(req, updateComboSchema);
  if (parsed instanceof NextResponse) return parsed;

  const existing = await prisma.combo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "This combo no longer exists." }, { status: 404 });
  }

  if (parsed.items) {
    const ids = parsed.items.map((i) => i.menuItemId);
    const found = await prisma.menuItem.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      return NextResponse.json(
        { error: "One of the selected menu items no longer exists. Refresh and try again." },
        { status: 400 }
      );
    }
  }

  // Items are replaced as a set, in the same transaction as the update, so a
  // failure never leaves a combo with its items half-removed.
  await prisma.$transaction(async (tx) => {
    if (parsed.items) await tx.comboItem.deleteMany({ where: { comboId: id } });
    await tx.combo.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        isActive: parsed.isActive,
        sortOrder: parsed.sortOrder,
        ...(parsed.items ? { items: { create: parsed.items } } : {}),
      },
    });
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiScope("menu");
  if (result instanceof NextResponse) return result;

  const { id } = await params;

  // ComboItem rows go with it (onDelete: Cascade); menu items are untouched.
  const { count } = await prisma.combo.deleteMany({ where: { id } });
  if (count === 0) {
    return NextResponse.json({ error: "This combo no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}