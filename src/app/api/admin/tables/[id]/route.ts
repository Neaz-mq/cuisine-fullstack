import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("tables");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await req.json();

  try {
    const updated = await prisma.restaurantTable.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "A table with this label already exists." },
      { status: 409 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("tables");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    await prisma.restaurantTable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Can't delete — this table has existing reservations. Mark it inactive instead." },
      { status: 409 }
    );
  }
}
