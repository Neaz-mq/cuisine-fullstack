import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("tables");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { label, capacity, isActive } = body;

  if (!label || typeof capacity !== "number" || capacity < 1) {
    return NextResponse.json({ error: "Invalid label or capacity" }, { status: 400 });
  }

  try {
    const table = await prisma.restaurantTable.create({
      data: { label, capacity, isActive: isActive ?? true },
    });
    return NextResponse.json(table, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A table with this label already exists." },
      { status: 409 }
    );
  }
}
