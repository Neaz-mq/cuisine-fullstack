import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { payoutRequestSchema } from "@/lib/validations/delivery";
import { getRestaurantSettings } from "@/lib/get-settings";
import { bankIsSetUp, destinationLabel, payToDetails, walletIsSetUp } from "@/lib/payout-methods";
import { getPayoutAccounts, getRiderBalance } from "@/lib/rider-payouts";
import { roundMoney } from "@/lib/rider-stats";

/**
 * POST /api/rider/payouts — Cash Out → "Confirm Cash Out".
 *
 * Creates a PENDING payout request for up to the rider's available
 * balance. Nothing is transferred automatically: the owner pays it (bank /
 * mobile wallet) and marks it Paid on Admin → Rider Payouts.
 *
 * The balance check and the insert run in one SERIALIZABLE transaction,
 * so two quick taps (or two tabs) can't cash out the same money twice.
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const rate = checkRateLimit(request, "rider-payout", { limit: 5, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many cash-out requests — please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, payoutRequestSchema);
  if (parsed instanceof NextResponse) return parsed;

  const settings = await getRestaurantSettings();
  const amount = roundMoney(parsed.amount);
  const accounts = await getPayoutAccounts(riderId);
  const ready = parsed.method === "BANK" ? bankIsSetUp(accounts) : walletIsSetUp(accounts);
  if (!ready) {
    return NextResponse.json({ error: "Set up this payout method first." }, { status: 400 });
  }

  try {
    const payout = await prisma.$transaction(
      async (tx) => {
        const balance = await getRiderBalance(riderId, tx);
        if (amount > balance.available + 0.001) {
          throw new PayoutError(
            balance.available <= 0
              ? "You have no balance to cash out yet."
              : `You can cash out up to ${balance.available.toFixed(2)} right now.`
          );
        }
        return tx.riderPayout.create({
          data: {
            riderId,
            amount,
            currency: settings.currency,
            method: parsed.method,
            destination: destinationLabel(parsed.method, accounts),
            payTo: payToDetails(parsed.method, accounts),
          },
          select: { id: true, amount: true, destination: true, requestedAt: true },
        });
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(
      {
        id: payout.id,
        amount: payout.amount.toNumber(),
        destination: payout.destination,
        requestedAt: payout.requestedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PayoutError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // P2034 = serialization conflict (two requests at once) — ask to retry.
    if ((error as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Another cash-out was being made at the same time. Please try again." }, { status: 409 });
    }
    console.error("[rider/payouts] request failed:", error);
    return NextResponse.json({ error: "Couldn't send your cash-out request. Please try again." }, { status: 500 });
  }
}

class PayoutError extends Error {}
