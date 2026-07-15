import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Prisma } from "@/generated/prisma";

/**
 * PATCH /api/admin/gift-cards/[id]
 *
 * Two independent, optional operations in one request:
 *  - `isActive: boolean` — the admin kill-switch (pull a card immediately).
 *  - `adjustment: number` — a signed balance correction (positive = top-up,
 *    negative = deduction), recorded as an ADJUSTMENT GiftCardTransaction
 *    and applied atomically alongside the balance update, same ledger +
 *    cached-balance pattern as the loyalty points adjust route.
 *
 * `code`, `initialAmount`, and purchaser/recipient details are
 * permanently locked once a card exists — same rationale as a coupon's
 * locked discount fields, see admin/coupons/[id]/route.ts.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("giftCards");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await req.json();

  const data: Prisma.GiftCardUpdateInput = {};

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  let adjustment: number | null = null;
  if (body.adjustment !== undefined) {
    if (typeof body.adjustment !== "number" || !Number.isFinite(body.adjustment) || body.adjustment === 0) {
      return NextResponse.json({ error: "Adjustment must be a non-zero number" }, { status: 400 });
    }
    adjustment = Math.round(body.adjustment * 100) / 100;
  }

  if (Object.keys(data).length === 0 && adjustment === null) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (adjustment !== null) {
        const giftCard = await tx.giftCard.findUnique({ where: { id } });
        if (!giftCard) throw new Error("NOT_FOUND");

        const newBalance = giftCard.balance + adjustment;
        if (newBalance < 0) throw new Error("BALANCE_NEGATIVE");

        await tx.giftCardTransaction.create({
          data: {
            giftCardId: id,
            amount: adjustment,
            type: "ADJUSTMENT",
            note: body.note?.trim() || "Manual admin adjustment",
          },
        });

        data.balance = newBalance;
      }

      return tx.giftCard.update({ where: { id }, data });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "BALANCE_NEGATIVE") {
      return NextResponse.json(
        { error: "This adjustment would take the balance below zero" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
  }
}
