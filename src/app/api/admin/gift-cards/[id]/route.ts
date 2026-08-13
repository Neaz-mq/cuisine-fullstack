import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import type { Prisma } from "@/generated/prisma/client";
import { adjustGiftCardSchema } from "@/lib/validations/coupon";
import { parseBody } from "@/lib/validations/parse";
import { toMoney } from "@/lib/money";

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

  const parsed = await parseBody(req, adjustGiftCardSchema);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  const data: Prisma.GiftCardUpdateInput = {};

  if (body.isActive !== undefined) {
    data.isActive = body.isActive;
  }

  const adjustment = body.adjustment !== undefined ? toMoney(body.adjustment) : null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (adjustment !== null) {
        const giftCard = await tx.giftCard.findUnique({ where: { id } });
        if (!giftCard) throw new Error("NOT_FOUND");

        // Decimal যোগ, `+` নয়। পুরোনো কোডে balance আর adjustment দুটোই
        // float ছিল, তাই একটা কার্ডকে ঠিক তার balance-এর সমান ঋণাত্মক
        // adjustment দিয়ে শূন্য করলে ফল হতো -1.8e-15 — অর্থাৎ
        // BALANCE_NEGATIVE, যদিও admin ঠিক কাজটাই করছিলেন।
        const newBalance = giftCard.balance.plus(adjustment);
        if (newBalance.isNegative()) throw new Error("BALANCE_NEGATIVE");

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
