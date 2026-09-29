import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { payoutDecisionSchema } from "@/lib/validations/delivery";

/**
 * PATCH /api/admin/rider-payouts/[id] — Admin → Rider Payouts.
 *
 * { action: "PAID" }      after the owner has sent the money
 * { action: "REJECTED" }  the money goes back to the rider's balance
 *
 * OWNER only ("finance" — the restaurant's money). Only a PENDING request
 * can be decided, once.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("finance");
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await params;

  const parsed = await parseBody(req, payoutDecisionSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { count } = await prisma.riderPayout.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: parsed.action,
      processedAt: new Date(),
      processedById: authResult.user.id!,
      note: parsed.note || null,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This request was already handled, or doesn't exist." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, status: parsed.action });
}
