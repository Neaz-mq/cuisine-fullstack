import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Orders that moved to OUT_FOR_DELIVERY within this window still show in the
// "Ready" column, so kitchen staff can see recent hand-offs before they
// scroll off. After this window they're assumed dispatched and drop off.
const READY_COLUMN_WINDOW_MS = 15 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const readySince = new Date(Date.now() - READY_COLUMN_WINDOW_MS);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: { in: ["PLACED", "PREPARING"] } },
        { status: "OUT_FOR_DELIVERY", updatedAt: { gte: readySince } },
      ],
    },
    include: {
      items: {
        include: {
          menuItem: { select: { title: true } },
        },
      },
      table: { select: { label: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ orders });
}
