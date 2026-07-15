import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { createGiftCard } from "@/lib/gift-cards";
import { sendGiftCardEmail } from "@/lib/send-gift-card-email";

export async function GET(req: NextRequest) {
  const authResult = await requireApiScope("giftCards");
  if (authResult instanceof NextResponse) return authResult;

  // Optional ?q= search over code/purchaser/recipient — the admin list
  // page's search box. _count.transactions lets the list show "N
  // transactions" without a separate query per card.
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const giftCards = await prisma.giftCard.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { purchaserEmail: { contains: q, mode: "insensitive" } },
            { recipientEmail: { contains: q, mode: "insensitive" } },
            { recipientName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  });

  return NextResponse.json(giftCards);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("giftCards");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const {
    amount,
    recipientEmail,
    recipientName,
    purchaserName,
    message,
    note,
  }: {
    amount: number;
    recipientEmail: string;
    recipientName?: string;
    purchaserName?: string;
    message?: string;
    note?: string;
  } = body;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  if (!recipientEmail?.trim()) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  // Manually issued cards (comp/refund/goodwill) are credited immediately
  // — there's no Stripe payment involved, unlike a customer purchase via
  // /api/gift-cards/purchase.
  const giftCard = await createGiftCard({
    amount: Math.round(amount * 100) / 100,
    type: "ISSUE",
    recipientEmail: recipientEmail.trim(),
    recipientName: recipientName?.trim() || null,
    purchaserName: purchaserName?.trim() || "Cuisine",
    message: message?.trim() || null,
    note: note?.trim() || "Manually issued by admin",
  });

  await sendGiftCardEmail({
    code: giftCard.code,
    amount: giftCard.initialAmount,
    recipientEmail: giftCard.recipientEmail!,
    recipientName: giftCard.recipientName || "there",
    purchaserName: giftCard.purchaserName,
    message: giftCard.message,
  });

  return NextResponse.json(giftCard, { status: 201 });
}
