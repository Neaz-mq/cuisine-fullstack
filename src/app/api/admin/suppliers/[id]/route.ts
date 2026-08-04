import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateSupplierSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, updateSupplierSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { phone, email, address, ...rest } = parsed;

  try {
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...rest,
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // Soft-disable — a supplier with PurchaseOrder history has to stay
  // queryable (see Supplier.isActive's schema note).
  try {
    const updated = await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
}