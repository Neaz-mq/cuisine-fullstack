import { prisma } from "@/lib/prisma";
import Link from "next/link";
import GiftCardActions from "./GiftCardActions";

export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Gift Cards</h1>
        <Link
          href="/admin/gift-cards/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Issue Gift Card
        </Link>
      </div>

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by code, email, or recipient name…"
          className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </form>

      {giftCards.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          {q ? "No gift cards match your search." : "No gift cards yet. Issue one to get started."}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {giftCards.map((giftCard) => {
            const spent = giftCard.initialAmount - giftCard.balance;

            return (
              <div key={giftCard.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-[200px]">
                  <p className="text-sm font-mono font-semibold text-gray-800">{giftCard.code}</p>
                  <p className="text-xs text-gray-400">
                    ${giftCard.balance.toFixed(2)} remaining of ${giftCard.initialAmount.toFixed(2)}
                    {spent > 0 && ` (${((spent / giftCard.initialAmount) * 100).toFixed(0)}% used)`}
                  </p>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                    {giftCard.recipientEmail && <span>To: {giftCard.recipientEmail}</span>}
                    {giftCard.purchaserEmail && <span>From: {giftCard.purchaserEmail}</span>}
                    <span>{giftCard._count.transactions} transaction(s)</span>
                    {!giftCard.stripeSessionId && (
                      <span className="text-amber-600 font-medium">Manually issued</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {giftCard.balance <= 0 && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                      Fully redeemed
                    </span>
                  )}
                  <GiftCardActions
                    giftCardId={giftCard.id}
                    isActive={giftCard.isActive}
                    balance={giftCard.balance}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
