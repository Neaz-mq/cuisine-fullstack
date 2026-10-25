import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Scope } from "@/lib/permissions";
import { parseBody } from "@/lib/validations/parse";
import { createInventoryItemSchema, orderRestockSchema } from "@/lib/validations/inventory";
import {
  checkSupplierCanReceiveOrders,
  placeSupplierOrder,
} from "@/lib/supplier-order";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import {
  STOCK_STATE_STYLE,
  isInventoryStatusFilter,
  stockStateOf,
} from "@/lib/inventory-status";

/**
 * src/lib/inventory-api.ts
 *
 * The inventory write/export handlers, parameterised by the scope that is
 * allowed to call them.
 *
 * Two panels use the exact same logic:
 *   - /api/admin/inventory/...          scope "inventory" (Owner)
 *   - /api/admin/kitchen/inventory/...  scope "kitchen"   (Kitchen panel)
 *
 * The routes are thin wrappers that only pick the scope, so there is ONE copy
 * of the validation, the "supplier must have an email" check and the
 * order-placing code. Two copies is how the panels would drift apart.
 */

/** POST — create an ingredient (optionally ordering it from the supplier right away). */
export async function createInventoryItemHandler(req: NextRequest, scope: Scope) {
  const authResult = await requireApiScope(scope);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createInventoryItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Empty string -> null (forms send empty strings; the DB means "not set" as null).
  // `orderQuantity` isn't a column: it's "also order this from the supplier now",
  // handled after the item exists, so it must never reach prisma.create.
  const { category, supplierId, image, orderQuantity, ...rest } = parsed;

  // Check the supplier BEFORE creating anything, so a supplier with no email
  // doesn't leave a half-done result (item created, order refused).
  if (orderQuantity !== undefined) {
    if (!supplierId) {
      return NextResponse.json(
        { error: "Pick a supplier to order this ingredient from." },
        { status: 400 }
      );
    }
    const supplierCheck = await checkSupplierCanReceiveOrders(supplierId);
    if (!supplierCheck.ok) {
      return NextResponse.json({ error: supplierCheck.error }, { status: supplierCheck.status });
    }
  }

  let item;
  try {
    item = await prisma.inventoryItem.create({
      data: {
        ...rest,
        category: category || null,
        supplierId: supplierId || null,
        image: image || null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "An inventory item with this name already exists." },
      { status: 409 }
    );
  }

  // "Order from the supplier now" — a Pending order + email, same as Restock.
  // The item is already saved, so a problem here is reported in the response
  // instead of failing the whole request.
  if (orderQuantity !== undefined && supplierId) {
    const placed = await placeSupplierOrder({
      inventoryItemId: item.id,
      supplierId,
      quantity: orderQuantity,
      costPerUnit: rest.costPerUnit,
      createdById: authResult.user.id,
    });
    const supplierOrder = placed.ok
      ? {
          placed: true as const,
          supplierName: placed.supplierName,
          emailed: placed.emailed,
          ...(placed.emailError ? { emailError: placed.emailError } : {}),
        }
      : { placed: false as const, error: placed.error };
    return NextResponse.json({ ...item, supplierOrder }, { status: 201 });
  }

  return NextResponse.json(item, { status: 201 });
}

/**
 * POST — the Restock modal's "Confirm Restock": order more of an ingredient
 * from a supplier. Creates a Pending purchase order and emails the supplier.
 * It does NOT touch stock (stock only rises when the delivery is confirmed).
 */
export async function orderRestockHandler(
  req: NextRequest,
  params: Promise<{ id: string }>,
  scope: Scope
) {
  const authResult = await requireApiScope(scope);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, orderRestockSchema);
  if (parsed instanceof NextResponse) return parsed;

  const result = await placeSupplierOrder({
    inventoryItemId: id,
    supplierId: parsed.supplierId,
    quantity: parsed.quantity,
    costPerUnit: parsed.costPerUnit,
    note: parsed.note,
    createdById: authResult.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      purchaseOrder: result.purchaseOrder,
      supplierName: result.supplierName,
      emailed: result.emailed,
      ...(result.emailError ? { emailError: result.emailError } : {}),
    },
    { status: 201 }
  );
}

/**
 * GET ?q=&status= — CSV of the list as it is on screen (same search, same
 * status filter). `includeCost: false` drops the Cost Per Unit column: the
 * kitchen panel must not hand out purchase prices.
 *
 * The filtering happens in memory, not in the DB: "currentStock <=
 * reorderThreshold" is a column-vs-column comparison Postgres can't do in an
 * indexed WHERE. The inventory pages do the same, so screen and file agree.
 */
export async function exportInventoryHandler(
  request: Request,
  opts: { scope: Scope; rateKey: string; includeCost: boolean }
) {
  const authResult = await requireApiScope(opts.scope);
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, opts.rateKey, {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const rawStatus = searchParams.get("status");
  const status = isInventoryStatusFilter(rawStatus) ? rawStatus : "all";

  const rows = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      name: true,
      category: true,
      unit: true,
      currentStock: true,
      maxCapacity: true,
      reorderThreshold: true,
      emergencyThreshold: true,
      costPerUnit: true,
      supplier: { select: { name: true } },
      _count: { select: { usedInRecipes: true } },
    },
  });

  const visible = rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (status !== "all" && stockStateOf(row) !== status) return false;
    return true;
  });

  const header = [
    "Name",
    "Category",
    "Unit",
    "Current Stock",
    "Max Capacity",
    "Low Stock Threshold",
    "Emergency Threshold",
    "Status",
    ...(opts.includeCost ? ["Cost Per Unit"] : []),
    "Supplier",
    "Used In Recipes",
  ];

  const rowsOut = visible.map((row) => [
    row.name,
    // Blank, not "—": that is for the screen; in a spreadsheet a dash is data.
    row.category ?? "",
    row.unit,
    // Raw numbers, not "12 Kg" — the unit has its own column.
    String(row.currentStock),
    String(row.maxCapacity),
    String(row.reorderThreshold),
    String(row.emergencyThreshold),
    STOCK_STATE_STYLE[stockStateOf(row)].label,
    ...(opts.includeCost ? [row.costPerUnit.toString()] : []),
    row.supplier?.name ?? "",
    String(row._count.usedInRecipes),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-inventory-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
