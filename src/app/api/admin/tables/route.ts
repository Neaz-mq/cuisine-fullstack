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
  // ⚠️ হাতে বেছে নেওয়া, `...parsed` নয় — PATCH route-এর comment-এ যে
  // mass-assignment-এর কথা আছে, POST-এ সেটা এভাবেই বন্ধ। নতুন field
  // যোগ করলে এখানেও যোগ করতে হবে, আর সেটাই উদ্দেশ্য।
  const { label, capacity, isActive, name, imageUrl } = parsed;

  try {
    const table = await prisma.restaurantTable.create({
      data: { label, capacity, isActive, name: name ?? null, imageUrl: imageUrl ?? null },
    });
    return NextResponse.json(table, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A table with this label already exists." },
      { status: 409 }
    );
  }
}
