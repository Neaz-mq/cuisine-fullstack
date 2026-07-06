import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const newOrdersCount = await prisma.order.count({
    where: {
      status: "PLACED",
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
  });

  const latestOrder = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json({
    newOrdersCount,
    latestOrderAt: latestOrder?.createdAt ?? null,
  });
}