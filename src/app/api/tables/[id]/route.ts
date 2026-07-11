import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * src/app/api/tables/[id]/route.ts
 *
 * GET /api/tables/[id] -> single table lookup, public/unauthenticated.
 *
 * Needed by the /dine-in QR-scan landing page to validate a scanned table
 * id BEFORE the customer has any session (guest, first thing they do).
 * Deliberately returns only id/label/isActive — nothing else about the
 * table is exposed on this no-auth endpoint.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const table = await prisma.restaurantTable.findUnique({
    where: { id },
    select: { id: true, label: true, isActive: true },
  });

  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  return NextResponse.json(table);
}
