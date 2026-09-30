import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { daysAgo, deliveredBetween, startOfToday } from "@/lib/rider-panel";
import { getRiderBalance } from "@/lib/rider-payouts";
import { roundMoney } from "@/lib/rider-stats";
import { sendEmail } from "@/lib/send-email";
import RiderEarningsSummaryEmail from "@/emails/RiderEarningsSummaryEmail";

/**
 * GET /api/cron/rider-earnings-summary — the rider "Earnings Summary"
 * email (Settings → Notifications). Vercel Cron calls it once a day just
 * after midnight (vercel.json) and it sums up YESTERDAY, restaurant time.
 *
 * Only riders who have it on, are active, and delivered something that
 * day. `riderSummarySentOn` makes a second call the same day send nothing
 * twice. Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export const maxDuration = 60;

const MAX_RIDERS_PER_RUN = 200;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/rider-earnings-summary] CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getRestaurantSettings(); // sets the restaurant time zone
  const dayEnd = startOfToday(new Date());
  const dayStart = daysAgo(dayEnd, 1);
  // The DATE column stores the calendar day as UTC midnight.
  const dayKey = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;
  const dayDate = new Date(`${dayKey}T00:00:00.000Z`);
  const dayLabel = dayStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const riders = await prisma.user.findMany({
    where: {
      role: "DELIVERY",
      staffProfile: {
        is: {
          isActive: true,
          riderEarningsSummary: true,
          OR: [{ riderSummarySentOn: null }, { riderSummarySentOn: { lt: dayDate } }],
        },
      },
    },
    select: { id: true, name: true, email: true },
    take: MAX_RIDERS_PER_RUN,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const rider of riders) {
    const rows = await deliveredBetween(rider.id, dayStart, dayEnd);
    if (rows.length === 0) {
      skipped += 1;
      continue;
    }
    const currency = rows[0].order.currency || settings.currency;
    const money = (value: number) => formatAmount(value, currency);
    const fees = roundMoney(rows.reduce((sum, row) => sum + row.order.deliveryFee.toNumber(), 0));
    const tips = roundMoney(rows.reduce((sum, row) => sum + row.order.tipAmount.toNumber(), 0));
    const cash = roundMoney(
      rows.filter((row) => row.order.paymentMethod === "COD").reduce((sum, row) => sum + row.order.totalAmount.toNumber(), 0)
    );
    const balance = await getRiderBalance(rider.id);

    const result = await sendEmail({
      tag: "rider-earnings-summary",
      to: rider.email,
      subject: `Your ${dayLabel} summary: ${money(roundMoney(fees + tips))} from ${rows.length} ${rows.length === 1 ? "delivery" : "deliveries"}`,
      idempotencyKey: `rider-summary/${rider.id}/${dayKey}`,
      react: RiderEarningsSummaryEmail({
        firstName: rider.name?.trim().split(/\s+/)[0] || "there",
        dayLabel,
        deliveries: rows.length,
        earned: money(roundMoney(fees + tips)),
        fees: money(fees),
        tips: money(tips),
        cashCollected: cash > 0 ? money(cash) : null,
        balance: money(balance.available),
        dashboardUrl: `${appUrl}/admin/my-deliveries/earnings`,
        settingsUrl: `${appUrl}/admin/my-deliveries/settings`,
      }),
    });

    if (result.ok) {
      sent += 1;
      await prisma.staffProfile.update({ where: { userId: rider.id }, data: { riderSummarySentOn: dayDate } });
    } else {
      failed += 1;
    }
  }

  console.info(`[cron/rider-earnings-summary] ${dayKey}: sent ${sent}, no deliveries ${skipped}, failed ${failed}`);
  return NextResponse.json({ day: dayKey, sent, skipped, failed });
}
