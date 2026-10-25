import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { kitchenSettingsSchema } from "@/lib/validations/kitchen-settings";

/**
 * PATCH /api/admin/kitchen/settings — kitchen panel → Settings → "Save Change".
 *
 * Writes the restaurant's time zone, kitchen opening hours and the two stock
 * alert switches on the singleton RestaurantSettings row — the same columns
 * the owner edits in Admin → Settings, so the landing page, menu, reservation
 * form and the notification feeds pick the change up on their next read.
 *
 * ⚠️ Why this is a separate route and not /api/admin/settings: that one needs
 * the owner-only "settings" scope and takes the whole row — tax, currency,
 * delivery fees, tipping, deposits. A cook has only the "kitchen" scope, and
 * widening it would hand over the money settings. This route accepts exactly
 * five fields, and `data` below lists them by name, so nothing else in the
 * body can ever be written — even if the validation schema were loosened.
 */
export async function PATCH(request: Request) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, kitchenSettingsSchema);
  if (parsed instanceof NextResponse) return parsed;

  const data = {
    timezone: parsed.timezone,
    kitchenOpenHour: parsed.kitchenOpenHour,
    kitchenCloseHour: parsed.kitchenCloseHour,
    lowStockAlerts: parsed.lowStockAlerts,
    emergencyStockAlerts: parsed.emergencyStockAlerts,
  };

  // upsert, not update: a fresh database has no singleton row yet.
  const updated = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
    select: {
      timezone: true,
      kitchenOpenHour: true,
      kitchenCloseHour: true,
      lowStockAlerts: true,
      emergencyStockAlerts: true,
    },
  });

  return NextResponse.json({ ok: true, ...updated });
}
