import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateSettingsSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiScope("settings");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, updateSettingsSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { timezone, kitchenOpenHour, kitchenCloseHour } = parsed;

  const updated = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: { timezone, kitchenOpenHour, kitchenCloseHour },
    create: { id: "singleton", timezone, kitchenOpenHour, kitchenCloseHour },
  });

  return NextResponse.json(updated);
}
