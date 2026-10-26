import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

/**
 * POST /api/admin/kitchen/orders/[id]/start
 *
 * The kitchen's "Start Preparing" button. The order is already PREPARING in
 * the database from the moment the admin pressed "Move to Kitchen" (that is
 * where stock is deducted), so this does NOT change `status`. It only stamps
 * `kitchenStartedAt`, which moves the card from "Recent Order" to "Preparing".
 *
 * Safe to call twice: a second call (double click, two cooks) is a no-op.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, kitchenStartedAt: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Already past this step (READY) or already started: nothing to do.
  if (order.status === "READY" || order.kitchenStartedAt) {
    return NextResponse.json({ ok: true });
  }

  if (order.status !== "PREPARING") {
    return NextResponse.json(
      { error: "This order has not been moved to the kitchen yet" },
      { status: 409 }
    );
  }

  // Conditions in WHERE = atomic claim, so two requests cannot both win.
  await prisma.order.updateMany({
    where: { id, status: "PREPARING", kitchenStartedAt: null },
    data: { kitchenStartedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}