import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({ data: { name: name.trim() } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A category with this name already exists." },
      { status: 409 }
    );
  }
}