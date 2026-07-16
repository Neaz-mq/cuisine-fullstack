import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createTableSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("tables");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createTableSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { label, capacity, isActive } = parsed;

  try {
    const table = await prisma.restaurantTable.create({
      data: { label, capacity, isActive },
    });
    return NextResponse.json(table, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A table with this label already exists." },
      { status: 409 }
    );
  }
}
