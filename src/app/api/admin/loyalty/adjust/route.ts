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

  // ⚠️ Balance can't go below 0. The check is part of the UPDATE itself
  // (updateMany with a condition), so two adjustments at the same moment
  // can't both pass a stale check and overdraw the balance together.
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, ...(points < 0 ? { loyaltyPoints: { gte: -points } } : {}) },
      data: { loyaltyPoints: { increment: points } },
    });
    if (updated.count === 0) return null;

    const transaction = await tx.loyaltyTransaction.create({
      data: { points, reason: "MANUAL_ADJUSTMENT", note: note || null, userId },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });
    return { transaction, balance: user.loyaltyPoints };
  });

  if (!result) {
    const exists = await prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });
    if (!exists) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json(
      {
        error: `Can't deduct ${Math.abs(points)} points — this customer has ${exists.loyaltyPoints}.`,
      },
      { status: 409 }
    );
  }

  return NextResponse.json(result);
}
