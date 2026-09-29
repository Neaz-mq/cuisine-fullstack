import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, periodStart } from "@/lib/dashboard-period";
import { isPayoutStatusFilter, methodLabel } from "@/lib/payout-methods";
import { getRiderBalance, payoutWhere } from "@/lib/rider-payouts";

/**
 * GET /api/rider/payouts/export?list=&q=&status= — "Export Report" on the
 * rider Earnings and Cash Out pages: the balance summary plus the rider's
 * own payout requests (same filters as Payout History) as CSV.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const rate = checkRateLimit(request, "rider-payouts-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get("list");
  const range = isDashboardPeriod(rawRange) ? rawRange : "all";
  const rawStatus = searchParams.get("status");
  const status = isPayoutStatusFilter(rawStatus) ? rawStatus : "ALL";

  const settings = await getRestaurantSettings(); // also sets the time zone for "today"
  const [balance, payouts] = await Promise.all([
    getRiderBalance(riderId),
    prisma.riderPayout.findMany({
      where: payoutWhere(riderId, { q: searchParams.get("q") ?? undefined, status, from: periodStart(range) }),
      orderBy: { requestedAt: "desc" },
      take: 5000,
      select: { requestedAt: true, amount: true, currency: true, method: true, destination: true, status: true, processedAt: true, note: true },
    }),
  ]);

  const money = (value: number) => value.toFixed(2);
  // Balance summary under the list, so the first row stays the header.
  const summary = [
    ["", "", "", "", "", "", ""],
    ["Summary", "", "", "", "", "", ""],
    ["Total earned", money(balance.earned), settings.currency, "", "", "", ""],
    ["Paid out", money(balance.paidOut), settings.currency, "", "", "", ""],
    ["Waiting for approval", money(balance.pending), settings.currency, "", "", "", ""],
    ["Available to cash out", money(balance.available), settings.currency, "", "", "", ""],
  ];
  const rows = payouts.map((p) => [
    p.requestedAt.toISOString(),
    money(p.amount.toNumber()),
    p.currency,
    methodLabel(p.method),
    p.destination,
    p.status === "PAID" ? "Paid" : p.status === "PENDING" ? "Pending" : "Rejected",
    p.processedAt?.toISOString() ?? "",
    p.note ?? "",
  ]);

  const csv = toCsv(
    ["Requested at", "Amount", "Currency", "Method", "Account", "Status", "Processed at", "Note"],
    [...rows, ...summary.map((row) => [...row, ""])]
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-earnings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
