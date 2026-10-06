import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { cashHandInCancelSchema } from "@/lib/validations/delivery";

/**
 * PATCH /api/rider/cash-handovers/[id] — { action: "CANCEL" }
 *
 * A rider can take back a hand-in report that is still waiting for the
 * restaurant (wrong amount, tapped by mistake). Only their own, only
 * PENDING, only one the rider created — never one the owner recorded or
 * already decided. The row stays in the history as Cancelled.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await params;

  const parsed = await parseBody(req, cashHandInCancelSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { count } = await prisma.cashRemittance.updateMany({
    where: { id, riderId: authResult.user.id!, source: "RIDER", status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This report was already handled, or can't be cancelled." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
