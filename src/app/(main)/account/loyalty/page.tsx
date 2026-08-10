import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, Check } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Container from "@/components/Container";
import { formatOrderId } from "@/lib/format-order-id";
import { LOYALTY_TIERS, getTierProgress } from "@/lib/loyalty-tiers";

/**
 * src/app/(main)/account/loyalty/page.tsx
 *
 * Customer-facing loyalty page: current tier + progress bar toward the
 * next one, that tier's perks, a ladder of every tier for context, and
 * a recent ledger of point-earning/adjustment activity.
 *
 * Server Component, same pattern as account/orders/page.tsx — direct
 * Prisma reads, defensive redirect (middleware.ts already blocks
 * unauthenticated /account/* access, this just covers the edge case of
 * a token expiring mid-session).
 */
export default async function LoyaltyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loyaltyPoints: true },
  });

  // User row missing (deleted account edge case) — treat as 0 rather than
  // crashing the page.
  const points = user?.loyaltyPoints ?? 0;
  const progress = getTierProgress(points);

  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      points: true,
      reason: true,
      note: true,
      createdAt: true,
      orderId: true,
    },
  });

  return (
    <Container>
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">Loyalty Rewards</h1>
        <p className="text-sm text-gray-500 mb-8">
          Earn points on every order and unlock better perks as you go.
        </p>

        {/* Current standing */}
        <div className="border border-gray-200 rounded-lg p-6 mb-8 bg-gradient-to-br from-white to-gray-50">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2C6252] flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${progress.tier.badgeClassName}`}
                >
                  {progress.tier.label} Tier
                </span>
                <p className="text-xs text-gray-400 mt-1">Your current status</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#FF4C15]">{points}</p>
              <p className="text-xs text-gray-400">points balance</p>
            </div>
          </div>

          {progress.nextTier ? (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>{progress.tier.label}</span>
                <span>
                  {progress.pointsToNextTier} points to {progress.nextTier.label}
                </span>
                <span>{progress.nextTier.label}</span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF4C15] rounded-full transition-all"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#2C6252] font-medium">
              🎉 You&apos;ve reached our highest tier — thank you for being a loyal customer!
            </p>
          )}
        </div>

        {/* Current tier's perks */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Your {progress.tier.label} perks
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {progress.tier.perks.map((perk) => (
              <li
                key={perk}
                className="flex items-start gap-2 text-sm text-gray-700 border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
              >
                <Check className="w-4 h-4 text-[#2C6252] mt-0.5 flex-shrink-0" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        {/* Full tier ladder */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">All tiers</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOYALTY_TIERS.map((tier) => {
              const isCurrent = tier.id === progress.tier.id;
              return (
                <div
                  key={tier.id}
                  className={`border rounded-lg p-4 ${
                    isCurrent ? "border-[#FF4C15] ring-1 ring-[#FF4C15]/30" : "border-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${tier.badgeClassName}`}
                  >
                    {tier.label}
                  </span>
                  <p className="text-xs text-gray-500 mb-2">
                    {tier.minPoints === 0 ? "Starting tier" : `${tier.minPoints}+ points`}
                  </p>
                  <p className="text-xs font-medium text-gray-700">
                    {tier.pointsMultiplier === 1
                      ? "Base earning rate"
                      : `${Math.round((tier.pointsMultiplier - 1) * 100)}% bonus points`}
                  </p>
                  {isCurrent && (
                    <p className="text-[11px] font-semibold text-[#FF4C15] mt-2">You are here</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent activity</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-md">
              <p className="text-gray-500 mb-4">No points activity yet.</p>
              <Link
                href="/order"
                className="inline-block bg-[#FF4C15] text-white font-semibold px-5 py-2 rounded-sm hover:bg-orange-600 transition-colors"
              >
                Browse the menu
              </Link>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-800">
                      {tx.reason === "ORDER_DELIVERED"
                        ? "Points earned"
                        : tx.note || "Manual adjustment"}
                      {tx.orderId && (
                        <span className="text-xs text-gray-400 ml-2">
                          {formatOrderId(tx.orderId)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tx.createdAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      tx.points >= 0 ? "text-[#2C6252]" : "text-red-600"
                    }`}
                  >
                    {tx.points >= 0 ? "+" : ""}
                    {tx.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
