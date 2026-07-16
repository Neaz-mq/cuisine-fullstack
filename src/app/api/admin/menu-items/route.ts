import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { createMenuItemSchema } from "@/lib/validations/menu-item";

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createMenuItemSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { title, description, price, imageUrl, categoryId, isAvailable } = parsed;

  const item = await prisma.menuItem.create({
    data: { title, description, price, imageUrl: imageUrl || null, categoryId, isAvailable },
  });

  return NextResponse.json(item, { status: 201 });
}