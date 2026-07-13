import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiScope("categories");
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: body.name.trim() },
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
