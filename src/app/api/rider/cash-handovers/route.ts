import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { cashHandInSchema } from "@/lib/validations/delivery";
import { getRestaurantSettings } from "@/lib/get-settings";
import { getRiderCash } from "@/lib/rider-cash";
import { roundMoney } from "@/lib/rider-stats";

/**
 * POST /api/rider/cash-handovers — Cash Collected → "Hand In Cash".
 *
 * The rider reports cash they handed to the restaurant. It is saved as a
 * PENDING, timestamped claim; the owner confirms or disputes it on Admin →
 * Rider Cash. Nothing the rider owes changes until the owner confirms —
 * but the claim exists, so a forgetful owner can't make it vanish.
 *
 * The cap check and the insert share one SERIALIZABLE transaction, so a
 * double tap (or two tabs) can't report the same cash twice.
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const rate = checkRateLimit(request, "rider-cash-handover", { limit: 10, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many hand-in reports — please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, cashHandInSchema);
  if (parsed instanceof NextResponse) return parsed;

  const settings = await getRestaurantSettings();
  const amount = roundMoney(parsed.amount);
  if (amount <= 0) {
    return NextResponse.json({ error: "Enter an amount above zero." }, { status: 400 });
  }

  try {
    const handover = await prisma.$transaction(
      async (tx) => {
        const cash = await getRiderCash(riderId, tx);
        if (amount > cash.inHand + 0.001) {
          throw new HandoverError(
            cash.inHand <= 0
              ? cash.pending > 0
                ? "All your cash is already reported — waiting for the restaurant to confirm."
                : "You have no cash to hand in."
              : `You can report up to ${cash.inHand.toFixed(2)} right now.`
          );
        }
        return tx.cashRemittance.create({
          data: {
            riderId,
            amount,
            currency: settings.currency,
            source: "RIDER",
            riderNote: parsed.note || null,
          },
          select: { id: true, amount: true, createdAt: true },
        });
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(
      { id: handover.id, amount: handover.amount.toNumber(), createdAt: handover.createdAt.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof HandoverError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // P2034 = serialization conflict (two requests at once) — ask to retry.
    if ((error as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Another hand-in was being saved at the same time. Please try again." }, { status: 409 });
    }
    console.error("[rider/cash-handovers] failed:", error);
    return NextResponse.json({ error: "Couldn't save your hand-in. Please try again." }, { status: 500 });
  }
}

class HandoverError extends Error {}
