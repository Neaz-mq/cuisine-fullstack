import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { title, description, price, imageUrl, categoryId, isAvailable } = body;

  if (!title || !description || typeof price !== "number" || !categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: { title, description, price, imageUrl, categoryId, isAvailable: isAvailable ?? true },
  });

  return NextResponse.json(item, { status: 201 });
}
