import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createPurchaseOrderSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  // ?status=ORDERED — the Purchase Orders tab's status filter. Matches
  // PurchaseOrder's @@index([status]) for the no-supplier-filter case.
  const statusParam = req.nextUrl.searchParams.get("status");
  const validStatuses = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
  if (statusParam && !validStatuses.includes(statusParam as (typeof validStatuses)[number])) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  const status = statusParam as (typeof validStatuses)[number] | null;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(purchaseOrders);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createPurchaseOrderSchema);
  if (parsed instanceof NextResponse) return parsed;

  const totalCost = parsed.items.reduce(
    (sum, line) => sum + line.quantityOrdered * line.costPerUnit,
    0
  );

  try {
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        supplierId: parsed.supplierId,
        note: parsed.note || null,
        totalCost: Math.round(totalCost * 100) / 100,
        createdById: authResult.user.id,
        items: {
          create: parsed.items.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantityOrdered: line.quantityOrdered,
            costPerUnit: line.costPerUnit,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(purchaseOrder, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Couldn't create purchase order — check the supplier and item ids." },
      { status: 400 }
    );
  }
}