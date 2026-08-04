import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { createInventoryItemSchema } from "@/lib/validations/inventory";

export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  // ?lowStock=true — the admin dashboard's low-stock widget: active
  // items at or below their configured reorderThreshold. Excludes items
  // with reorderThreshold = 0 (the "no alert configured yet" default —
  // see InventoryItem.reorderThreshold's schema note), since including
  // those would flag every never-configured item as low stock from day
  // one. The threshold comparison itself is a column-to-column check
  // Postgres can't do in an indexed WHERE clause (see InventoryItem's
  // @@index([isActive]) comment) — filtered here in JS after narrowing
  // to active items, which is the same tradeoff the schema already
  // documents.
  const lowStockOnly = req.nextUrl.searchParams.get("lowStock") === "true";

  const items = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      ...(lowStockOnly ? { reorderThreshold: { gt: 0 } } : {}),
    },
    orderBy: { name: "asc" },
  });

  const result = lowStockOnly
    ? items.filter((item) => item.currentStock <= item.reorderThreshold)
    : items;

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createInventoryItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const item = await prisma.inventoryItem.create({ data: parsed });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "An inventory item with this name already exists." },
      { status: 409 }
    );
  }
}