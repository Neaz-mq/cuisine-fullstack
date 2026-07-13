import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/require-admin";

export async function GET(req: NextRequest) {
  const authResult = await requireApiStaff();
  if (authResult instanceof NextResponse) return authResult;

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
