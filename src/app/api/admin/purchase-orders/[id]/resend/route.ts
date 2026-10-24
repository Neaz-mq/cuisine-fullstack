import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { emailSupplierAboutOrder } from "@/lib/supplier-order";

/**
 * POST /api/admin/purchase-orders/[id]/resend
 *
 * Emails the supplier about a Pending order again — the first email failed, got
 * lost, or the supplier hasn't answered. Only a Pending (ORDERED) order: once
 * the supplier has accepted there's nothing left to ask them.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!po) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }
  if (po.status !== "ORDERED") {
    return NextResponse.json(
      { error: "Only a pending order can be sent to the supplier again" },
      { status: 409 }
    );
  }

  const result = await emailSupplierAboutOrder(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Couldn't email the supplier — ${result.reason}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
