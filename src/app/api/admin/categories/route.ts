import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createCategorySchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function POST(req: NextRequest) {
  const result = await requireApiScope("categories");
  if (result instanceof NextResponse) return result;

  const parsed = await parseBody(req, createCategorySchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const category = await prisma.category.create({ data: { name: parsed.name } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A category with this name already exists." },
      { status: 409 }
    );
  }
}
