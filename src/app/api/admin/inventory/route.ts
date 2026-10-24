import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { createInventoryItemSchema } from "@/lib/validations/inventory";
import { checkSupplierCanReceiveOrders, placeSupplierOrder } from "@/lib/supplier-order";

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

  // ⚠️ ফাঁকা string → null। schema-গুলো `.or(z.literal(""))` গ্রহণ করে
  // (form ফাঁকা ঘর পাঠায়), কিন্তু DB-তে "কিছু দেওয়া হয়নি" মানে null —
  // ফাঁকা string বসালে পরে `category IS NULL` ছাঁকনি ওগুলো মিস করত।
  // `orderQuantity` isn't a column — it's "also order this from the supplier
  // now", handled after the item exists. Pulled out so it never reaches
  // `prisma.inventoryItem.create` (which would reject the unknown field).
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