import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateSupplierSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

/**
 * GET /api/admin/suppliers/[id]
 *
 * "View" modal-এর জন্য — সরবরাহকারীর নিজের ঘরগুলো **আর** কয়েকটা
 * হিসাব যা সারিতে নেই।
 *
 * ⚠️ হিসাবগুলো ছাড়া এই route-টার (আর modal-টারও) কোনো মানে হতো না:
 * নাম, ইমেইল, ঠিকানা, ফোন, শ্রেণি, পণ্য, status — সবই তালিকার
 * সারিতেই দেখা যায়। "কতগুলো অর্ডার দেওয়া হয়েছে", "শেষ মাল কবে
 * এসেছে", "কতগুলো আলাদা পণ্য এসেছে" — এগুলোই নতুন তথ্য, আর এগুলোর
 * জন্যই একটা modal খোলার মানে আছে।
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      category: true,
      products: true,
      isActive: true,
      createdAt: true,
      _count: { select: { purchaseOrders: true } },
    },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const [lastReceived, itemGroups] = await Promise.all([
    // শেষ কবে সত্যিই মাল এসেছে — `receivedAt`, `createdAt` নয়। একটা
    // PO বানানো আর মাল পৌঁছনো এক জিনিস নয়, আর এখানে প্রশ্নটা
    // দ্বিতীয়টা।
    prisma.purchaseOrder.findFirst({
      where: { supplierId: id, receivedAt: { not: null } },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
    // কতগুলো **আলাদা** পণ্য এসেছে — count নয়, groupBy, নাহলে একই
    // পণ্য দশবার কিনলে দশবারই গুনত।
    prisma.purchaseOrderItem.groupBy({
      by: ["inventoryItemId"],
      where: { purchaseOrder: { supplierId: id } },
      orderBy: { inventoryItemId: "asc" },
    }),
  ]);

  return NextResponse.json({
    ...supplier,
    purchaseOrderCount: supplier._count.purchaseOrders,
    lastReceivedAt: lastReceived?.receivedAt ?? null,
    distinctItemsSupplied: itemGroups.length,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, updateSupplierSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { phone, email, address, category, ...rest } = parsed;

  try {
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...rest,
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
        // ⚠️ ফাঁকা string মানে "মুছে দাও", তাই `|| null` — বাকি
        // ঐচ্ছিক ঘরগুলোর একই আচরণ। `products` এই নিয়মের বাইরে:
        // ওটা array, আর খালি array নিজেই একটা বৈধ মান ("কোনো পণ্য
        // লেখা নেই"), তাই `rest`-এর মধ্য দিয়ে অবিকৃত যায়।
        ...(category !== undefined ? { category: category || null } : {}),
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