import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateCategorySchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiScope("categories");
  if (result instanceof NextResponse) return result;

  const { id } = await params;

  const parsed = await parseBody(req, updateCategorySchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: parsed.name },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "A category with this name already exists." },
      { status: 409 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiScope("categories");
  if (result instanceof NextResponse) return result;

  const { id } = await params;

  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Can't delete — this category still has menu items. Move or delete them first." },
      { status: 409 }
    );
  }
}
