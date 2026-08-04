import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createSupplierSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  // ?includeInactive=true — the supplier picker on a new PurchaseOrder
  // only ever wants active suppliers; the Suppliers admin list itself
  // wants to show everyone, including ones no longer in use.
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

  const suppliers = await prisma.supplier.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createSupplierSchema);
  if (parsed instanceof NextResponse) return parsed;

  const supplier = await prisma.supplier.create({
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}