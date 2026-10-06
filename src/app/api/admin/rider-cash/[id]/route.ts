import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { cashDecisionSchema } from "@/lib/validations/delivery";
import { getRiderCash } from "@/lib/rider-cash";

/**
 * PATCH /api/admin/rider-cash/[id] — Admin → Rider Cash.
 *
 * { action: "CONFIRM" }   the owner really received this cash
 * { action: "DISPUTE" }   it didn't arrive / wrong amount (reason required,
 *                         the rider sees it) — the cash stays owed
 *
 * OWNER only. A report can be decided once, while it is PENDING. Confirming
 * re-checks, inside the same SERIALIZABLE transaction, that it doesn't push
 * the confirmed total above what the rider actually collected.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("finance");
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await params;

  const parsed = await parseBody(req, cashDecisionSchema);
  if (parsed instanceof NextResponse) return parsed;

  const decision = {
    status: parsed.action === "CONFIRM" ? ("CONFIRMED" as const) : ("DISPUTED" as const),
    decidedAt: new Date(),
    decidedById: authResult.user.id!,
    adminNote: parsed.note || null,
  };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const row = await tx.cashRemittance.findFirst({
          where: { id, status: "PENDING" },
          select: { riderId: true, amount: true },
        });
        if (!row) return "HANDLED" as const;

        if (parsed.action === "CONFIRM") {
          const cash = await getRiderCash(row.riderId, tx);
          // `owed` already excludes confirmed hand-ins; this one is still
          // pending, so it is inside `pending`, not `confirmed`.
          if (row.amount.toNumber() > cash.owed + 0.001) {
            return "TOO_MUCH" as const;
          }
        }

        const { count } = await tx.cashRemittance.updateMany({ where: { id, status: "PENDING" }, data: decision });
        return count === 0 ? ("HANDLED" as const) : ("OK" as const);
      },
      { isolationLevel: "Serializable" }
    );

    if (result === "HANDLED") {
      return NextResponse.json({ error: "This report was already handled, or doesn't exist." }, { status: 409 });
    }
    if (result === "TOO_MUCH") {
      return NextResponse.json(
        { error: "That is more than this rider collected in cash. Dispute it, or record the real amount instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, status: decision.status });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Another change was being saved at the same time. Please try again." }, { status: 409 });
    }
    console.error("[admin/rider-cash] decision failed:", error);
    return NextResponse.json({ error: "Couldn't update this report. Please try again." }, { status: 500 });
  }
}
