import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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