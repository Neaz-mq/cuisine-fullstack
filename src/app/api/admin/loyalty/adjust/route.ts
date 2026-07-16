import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { loyaltyAdjustSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function POST(request: Request) {
  const authResult = await requireApiScope("loyalty");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, loyaltyAdjustSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { userId, points, note } = parsed;

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
          note: note || null,
          userId,
        },
      }),
    ]);

    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
