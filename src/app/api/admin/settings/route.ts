import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiScope("settings");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { timezone, kitchenOpenHour, kitchenCloseHour } = body;

  if (
    typeof timezone !== "string" ||
    typeof kitchenOpenHour !== "number" ||
    typeof kitchenCloseHour !== "number" ||
    kitchenOpenHour < 0 ||
    kitchenOpenHour > 23 ||
    kitchenCloseHour < 0 ||
    kitchenCloseHour > 23 ||
    kitchenOpenHour === kitchenCloseHour
  ) {
    return NextResponse.json({ error: "Invalid settings values" }, { status: 400 });
  }

  const updated = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: { timezone, kitchenOpenHour, kitchenCloseHour },
    create: { id: "singleton", timezone, kitchenOpenHour, kitchenCloseHour },
  });

  return NextResponse.json(updated);
}
