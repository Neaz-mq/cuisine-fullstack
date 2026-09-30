import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { riderPreferencesSchema } from "@/lib/validations/delivery";

/**
 * PATCH /api/rider/preferences — Rider panel → Settings → "Save Change".
 *
 * Takes effect straight away: Available Orders, the dashboard count and
 * the notification list all read these (lib/rider-preferences.ts), and the
 * nightly job reads earningsSummary (/api/cron/rider-earnings-summary).
 */
export async function PATCH(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, riderPreferencesSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { count } = await prisma.staffProfile.updateMany({
    where: { userId: authResult.user.id! },
    data: {
      riderMaxRadiusKm: parsed.maxRadiusKm,
      riderAcceptsCash: parsed.acceptsCash,
      riderNewOrderAlerts: parsed.newOrderAlerts,
      riderEarningsSummary: parsed.earningsSummary,
    },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: "Your staff profile isn't set up yet — ask the restaurant to add it on the Staff page." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, ...parsed });
}
