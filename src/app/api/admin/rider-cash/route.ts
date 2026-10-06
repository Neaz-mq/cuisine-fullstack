import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { cashRecordSchema } from "@/lib/validations/delivery";
import { getRestaurantSettings } from "@/lib/get-settings";
import { getRiderCash } from "@/lib/rider-cash";
import { roundMoney } from "@/lib/rider-stats";

/**
 * POST /api/admin/rider-cash — Admin → Rider Cash → "Record Cash".
 *
 * The owner received cash from a rider and records it straight away: a
 * CONFIRMED row, source ADMIN. Capped at what the rider still holds and has
 * not already reported — if they reported it, the owner confirms that
 * report instead, so the same cash is never counted twice.
 *
 * OWNER only ("finance" — the restaurant's money).
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("finance");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, cashRecordSchema);
  if (parsed instanceof NextResponse) return parsed;

  const rider = await prisma.user.findFirst({
    where: { id: parsed.riderId, role: "DELIVERY" },
    select: { id: true },
  });
  if (!rider) return NextResponse.json({ error: "That rider doesn't exist." }, { status: 404 });

  const settings = await getRestaurantSettings();
  const amount = roundMoney(parsed.amount);
  if (amount <= 0) return NextResponse.json({ error: "Enter an amount above zero." }, { status: 400 });

  try {
    const row = await prisma.$transaction(
      async (tx) => {
        const cash = await getRiderCash(rider.id, tx);
        if (amount > cash.inHand + 0.001) {
          throw new CashError(
            cash.pending > 0 && amount <= cash.owed + 0.001
              ? `This rider already reported ${cash.pending.toFixed(2)} as handed in — confirm that request instead.`
              : cash.inHand <= 0
                ? "This rider holds no unrecorded cash."
                : `This rider holds ${cash.inHand.toFixed(2)} — you can't record more than that.`
          );
        }
        return tx.cashRemittance.create({
          data: {
            riderId: rider.id,
            amount,
            currency: settings.currency,
            source: "ADMIN",
            status: "CONFIRMED",
            adminNote: parsed.note || null,
            decidedAt: new Date(),
            decidedById: authResult.user.id!,
          },
          select: { id: true },
        });
      },
      { isolationLevel: "Serializable" }
    );
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CashError) return NextResponse.json({ error: error.message }, { status: 409 });
    if ((error as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Another change was being saved at the same time. Please try again." }, { status: 409 });
    }
    console.error("[admin/rider-cash] record failed:", error);
    return NextResponse.json({ error: "Couldn't record the cash. Please try again." }, { status: 500 });
  }
}

class CashError extends Error {}
