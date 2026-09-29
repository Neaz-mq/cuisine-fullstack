import { requireStaff } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { daysAgo, startOfToday } from "@/lib/rider-panel";
import { getPayoutAccounts, getRiderBalance } from "@/lib/rider-payouts";
import { bankIsSetUp, methodSummary, walletIsSetUp } from "@/lib/payout-methods";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import { RiderPageHeader } from "../rider-ui";
import CashOutForm from "./CashOutForm";

export const metadata = { title: "Cash Out" };

/**
 * Rider panel → Payout → Cash Out (Figma "Payout"):
 *
 *   Available to withdraw  $412.80  (eye)   "From 58 deliveries this week"
 *   Withdrawal Amount      Full Balance | Custom Amount · Maximum $412.80
 *   Payout Method          Bank Transfer / Mobile Wallet  (set up / edit)
 *   Summary                amount · fee $0.00 · you'll receive · Confirm
 *
 * "Confirm Cash Out" sends a request; the owner pays it (bank or mobile
 * wallet — the restaurant has no payment API to send money itself) and
 * marks it Paid on Admin → Rider Payouts. The page never gets the full
 * account numbers — only the masked "•••• 4821".
 */
export default async function CashOutPage() {
  const session = await requireStaff("myDeliveries");
  const riderId = session.user.id!;
  const settings = await getRestaurantSettings(); // restaurant time zone
  const now = new Date();

  const [balance, accounts, weekDeliveries] = await Promise.all([
    getRiderBalance(riderId),
    getPayoutAccounts(riderId),
    prisma.deliveryTracking.count({
      where: { riderId, deliveredAt: { gte: daysAgo(startOfToday(now), 6) }, order: { status: "DELIVERED" } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={now}
        actions={<ExportReportButton endpoint="/api/rider/payouts/export" forwardParams={[]} fallbackFilename="my-earnings.csv" />}
      />
      <CashOutForm
        available={balance.available}
        pending={balance.pending}
        currency={settings.currency}
        minorUnits={settings.currencyMinorUnits}
        weekDeliveries={weekDeliveries}
        preferred={accounts.preferred}
        bank={{
          setUp: bankIsSetUp(accounts),
          summary: methodSummary("BANK", accounts),
          bankName: accounts.bankName ?? "",
          accountName: accounts.bankAccountName ?? session.user.name ?? "",
        }}
        wallet={{
          setUp: walletIsSetUp(accounts),
          summary: methodSummary("WALLET", accounts),
          provider: accounts.walletProvider ?? "",
        }}
      />
    </div>
  );
}
