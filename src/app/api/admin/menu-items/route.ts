import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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