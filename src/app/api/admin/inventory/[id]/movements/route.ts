import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { recordStockMovement } from "@/lib/record-stock-movement";
import { recordStockMovementSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // The item's detail page's history tab —
  // `WHERE inventoryItemId = ? ORDER BY createdAt DESC` — matches
  // StockMovement's @@index([inventoryItemId, createdAt]) exactly.
  const movements = await prisma.stockMovement.findMany({
    where: { inventoryItemId: id },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { id: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(movements);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, recordStockMovementSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { type, quantity, direction, note } = parsed;

  // WASTAGE always removes stock, RETURN always adds it back — only
  // ADJUSTMENT's sign actually depends on the submitted `direction` (a
  // physical count can come in either higher or lower than expected).
  const signedQuantity =
    type === "RETURN" || (type === "ADJUSTMENT" && direction === "INCREASE")
      ? quantity
      : -quantity;

  const result = await recordStockMovement({
    inventoryItemId: id,
    type,
    signedQuantity,
    note,
    createdById: authResult.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.movement, { status: 201 });
}