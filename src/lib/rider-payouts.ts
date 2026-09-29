/**
 * src/lib/rider-payouts.ts
 *
 * A rider's money, for Earnings and Cash Out:
 *
 *   earned     = delivery fee + tip of every order they delivered
 *   paid out   = payout requests the owner marked PAID
 *   pending    = payout requests still waiting for the owner
 *   available  = earned − paid out − pending      (what they can cash out)
 *
 * A REJECTED request doesn't count, so its money is available again.
 * Cash from cash-on-delivery orders is separate (Cash Collected): it is
 * the restaurant's money the rider hands in, not part of their earnings.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/rider-stats";
import type { PayoutAccounts, PayoutMethodKind, PayoutStatusFilter } from "@/lib/payout-methods";

type Db = typeof prisma | Prisma.TransactionClient;

export type RiderBalance = {
  earned: number;
  paidOut: number;
  pending: number;
  available: number;
  deliveries: number;
};

export async function getRiderBalance(riderId: string, db: Db = prisma): Promise<RiderBalance> {
  const [earnings, payouts] = await Promise.all([
    db.order.aggregate({
      where: { status: "DELIVERED", deliveryTracking: { is: { riderId, deliveredAt: { not: null } } } },
      _sum: { deliveryFee: true, tipAmount: true },
      _count: { _all: true },
    }),
    db.riderPayout.groupBy({
      by: ["status"],
      where: { riderId, status: { in: ["PENDING", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);

  const earned = roundMoney(
    (earnings._sum.deliveryFee?.toNumber() ?? 0) + (earnings._sum.tipAmount?.toNumber() ?? 0)
  );
  const sumOf = (status: "PENDING" | "PAID") =>
    roundMoney(payouts.find((row) => row.status === status)?._sum.amount?.toNumber() ?? 0);
  const paidOut = sumOf("PAID");
  const pending = sumOf("PENDING");

  return {
    earned,
    paidOut,
    pending,
    available: Math.max(0, roundMoney(earned - paidOut - pending)),
    deliveries: earnings._count._all,
  };
}

export async function getPayoutAccounts(riderId: string): Promise<PayoutAccounts> {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: riderId },
    select: {
      payoutMethod: true,
      payoutBankName: true,
      payoutBankAccountName: true,
      payoutBankAccountNumber: true,
      payoutWalletProvider: true,
      payoutWalletNumber: true,
    },
  });
  return {
    preferred: profile?.payoutMethod === "BANK" || profile?.payoutMethod === "WALLET" ? (profile.payoutMethod as PayoutMethodKind) : null,
    bankName: profile?.payoutBankName ?? null,
    bankAccountName: profile?.payoutBankAccountName ?? null,
    bankAccountNumber: profile?.payoutBankAccountNumber ?? null,
    walletProvider: profile?.payoutWalletProvider ?? null,
    walletNumber: profile?.payoutWalletNumber ?? null,
  };
}

/**
 * Payout History filters (Earnings page and its CSV): status, the period
 * the request was made in, and a search over the account, method and
 * amount ("bkash", "4821", "412.80").
 */
export function payoutWhere(
  riderId: string,
  { q, status, from }: { q?: string; status: PayoutStatusFilter; from: Date | null }
): Prisma.RiderPayoutWhereInput {
  const text = q?.trim();
  const amount = text ? Number(text.replace(/[^\d.]/g, "")) : NaN;
  const lower = text?.toLowerCase() ?? "";
  const search: Prisma.RiderPayoutWhereInput[] = text
    ? [
        { destination: { contains: text, mode: "insensitive" } },
        ...(Number.isFinite(amount) && amount > 0 ? [{ amount: { equals: amount } }] : []),
        ...("bank transfer".includes(lower) ? [{ method: "BANK" }] : []),
        ...("mobile wallet".includes(lower) ? [{ method: "WALLET" }] : []),
      ]
    : [];
  return {
    riderId,
    ...(status !== "ALL" ? { status } : {}),
    ...(from ? { requestedAt: { gte: from } } : {}),
    ...(search.length ? { OR: search } : {}),
  };
}
