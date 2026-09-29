import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { payoutMethodSchema } from "@/lib/validations/delivery";
import { methodSummary, type PayoutAccounts } from "@/lib/payout-methods";
import { getPayoutAccounts } from "@/lib/rider-payouts";

/**
 * PATCH /api/rider/payout-method — Cash Out → Payout Method → Set up / Edit.
 *
 * Saves the rider's bank account or mobile wallet (and makes it the one
 * picked by default). Only the rider themselves; the owner sees the
 * details on the payout request they pay.
 */
export async function PATCH(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const parsed = await parseBody(request, payoutMethodSchema);
  if (parsed instanceof NextResponse) return parsed;

  const data =
    parsed.kind === "BANK"
      ? {
          payoutMethod: "BANK",
          payoutBankName: parsed.bankName,
          payoutBankAccountName: parsed.accountName,
          payoutBankAccountNumber: parsed.accountNumber,
        }
      : {
          payoutMethod: "WALLET",
          payoutWalletProvider: parsed.provider,
          payoutWalletNumber: parsed.number.replace(/^\+?88/, ""),
        };

  const { count } = await prisma.staffProfile.updateMany({ where: { userId: riderId }, data });
  if (count === 0) {
    return NextResponse.json(
      { error: "Your staff profile isn't set up yet — ask the restaurant to add it on the Staff page." },
      { status: 404 }
    );
  }

  const accounts: PayoutAccounts = await getPayoutAccounts(riderId);
  // Back to the browser without full numbers — only the masked labels.
  return NextResponse.json({
    preferred: accounts.preferred,
    bank: {
      bankName: accounts.bankName ?? "",
      accountName: accounts.bankAccountName ?? "",
      summary: methodSummary("BANK", accounts),
    },
    wallet: { provider: accounts.walletProvider ?? "", summary: methodSummary("WALLET", accounts) },
  });
}
