import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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