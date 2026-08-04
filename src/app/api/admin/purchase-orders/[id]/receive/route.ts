import { NextRequest, NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { receivePurchaseOrder } from "@/lib/receive-purchase-order";
import { receivePurchaseOrderSchema } from "@/lib/validations/inventory";
import { parseBody } from "@/lib/validations/parse";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, receivePurchaseOrderSchema);
  if (parsed instanceof NextResponse) return parsed;

  const result = await receivePurchaseOrder(id, parsed.items, authResult.user.id);

  if (!result.ok) {
    const status = result.error === "Purchase order not found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.purchaseOrder);
}