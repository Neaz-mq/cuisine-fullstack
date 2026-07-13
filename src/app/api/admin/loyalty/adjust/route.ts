import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";

export async function POST(request: Request) {
  const authResult = await requireApiScope("loyalty");
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const points = Number(body?.points);
  const note = (body?.note as string | undefined)?.trim() || null;

  if (!userId || !Number.isInteger(points) || points === 0) {
    return NextResponse.json(
      { error: "userId and a non-zero integer 'points' are required" },
      { status: 400 }
    );
  }

  try {
    const [, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: points } },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          points,
          reason: "MANUAL_ADJUSTMENT",
          note,
          userId,
        },
      }),
    ]);

    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
