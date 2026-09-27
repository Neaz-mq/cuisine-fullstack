import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, Check, Gift, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import { formatSpend, getTierProgress, tierPerks } from "@/lib/loyalty-tiers";
import { earnRuleSentence, getActiveEarnRule, getLoyaltyTiers } from "@/lib/loyalty-config";
import { getRestaurantSettings } from "@/lib/get-settings";
import { POINTS_TO_DOLLAR_RATE, MIN_REDEEMABLE_POINTS } from "@/lib/loyalty-redemption";
import { CARD, CARD_SUBTITLE, CARD_TITLE, PRIMARY_BUTTON } from "@/components/account/ui";

export const metadata: Metadata = { title: "Loyalty" };

/**
 * src/app/(main)/account/loyalty/page.tsx — customer panel → Loyalty.
 *
 * Figma look: white cards on the cream page, cream boxes inside.
 *
 * Current level and points, how far the next level is, what this level
 * gives, how points turn into money off, every level for context, and the
 * points history. Same rules as before — only the look moved into the
 * customer panel.
 */
export default async function LoyaltyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/loyalty");

  const [user, tiers, earnRule, settings, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { loyaltyPoints: true } }),
    getLoyaltyTiers(),
    getActiveEarnRule(),
    getRestaurantSettings(),
    prisma.loyaltyTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, points: true, reason: true, note: true, createdAt: true, orderId: true },
    }),
  ]);

  const points = user?.loyaltyPoints ?? 0;
  const progress = getTierProgress(points, tiers);
  const earnText = earnRule ? earnRuleSentence(earnRule, settings.currency) : null;
  const perks = tierPerks(progress.tier, earnText);
  const pointsPerUnit = Math.round(1 / POINTS_TO_DOLLAR_RATE);
  const worth = formatSpend(points * POINTS_TO_DOLLAR_RATE, settings.currency);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: settings.timezone,
  });

  return (
    <>
      {/* Standing */}
      <section aria-labelledby="loyalty-title" className={`${CARD} flex flex-col gap-6`}>
        <div>
          <h2 id="loyalty-title" className={CARD_TITLE}>
            Loyalty
          </h2>
          <p className={CARD_SUBTITLE}>Earn points on every order and unlock better perks as you go.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]">
              <Award className="h-6 w-6 text-white" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className={`inline-block rounded-full px-3 py-1 font-sora text-[11px] font-semibold ${progress.tier.badgeClassName}`}>
                {progress.tier.label}
              </span>
              <p className="mt-1 font-sora text-[12px] text-black/55">Your current level</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-frank-ruhl text-[32px] font-semibold leading-none text-black md:text-[36px]">{points.toLocaleString("en-US")}</p>
            <p className="mt-1.5 font-sora text-[13px] text-black/70">points · worth about {worth}</p>
          </div>
        </div>

        {progress.nextTier ? (
          <div>
            <div
              className="h-[26px] w-full overflow-hidden rounded-full bg-[repeating-linear-gradient(115deg,#F9F6F3_0px,#F9F6F3_10px,#FFFFFF_10px,#FFFFFF_12px)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.progressPercent)}
              aria-label={`Progress to ${progress.nextTier.label}`}
            >
              <div
                className="h-full rounded-full bg-[#FF9540]"
                style={{ width: `${Math.max(progress.progressPercent, 4)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 font-sora text-[13px] text-black/70 md:text-[14px]">
              <span>{progress.tier.label}</span>
              <span className="font-semibold text-black">
                {progress.pointsToNextTier.toLocaleString("en-US")} points to {progress.nextTier.label}
              </span>
              <span>{progress.nextTier.label}</span>
            </div>
          </div>
        ) : (
          <p className="font-sora text-[13px] font-semibold text-black">
            🎉 You&apos;ve reached our highest level — thank you for being a loyal customer!
          </p>
        )}
      </section>

      <div className="grid gap-6 md:gap-8 2xl:grid-cols-2">
        {/* Perks */}
        <section aria-labelledby="perks" className={CARD}>
          <h2 id="perks" className={CARD_TITLE}>
            Your {progress.tier.label} perks
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 rounded-[16px] bg-[#F9F6F3] px-4 py-3.5 font-sora text-[14px] text-black">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0E9F00]" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        </section>

        {/* How to use points */}
        <section aria-labelledby="redeem" className={`${CARD} flex flex-col gap-4`}>
          <div>
            <h2 id="redeem" className={CARD_TITLE}>
              Use your points
            </h2>
            <p className={CARD_SUBTITLE}>Turn points into money off any order.</p>
          </div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-3 rounded-[16px] bg-[#F9F6F3] px-4 py-3.5">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7100]" aria-hidden="true" />
              <span className="font-sora text-[14px] text-black">
                <strong className="font-semibold">{pointsPerUnit} points = {formatSpend(1, settings.currency)} off</strong>, from{" "}
                {MIN_REDEEMABLE_POINTS} points. Use the points slider on the cart page.
              </span>
            </li>
            {earnText && (
              <li className="flex items-start gap-3 rounded-[16px] bg-[#F9F6F3] px-4 py-3.5">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7100]" aria-hidden="true" />
                <span className="font-sora text-[14px] text-black">
                  {earnText}. Points arrive when your order is delivered.
                </span>
              </li>
            )}
          </ul>
          <Link href="/menu" className={`${PRIMARY_BUTTON} self-start`}>
            Order &amp; earn
          </Link>
        </section>
      </div>

      {/* Levels */}
      <section aria-labelledby="levels" className={CARD}>
        <h2 id="levels" className={CARD_TITLE}>
          All levels
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 2xl:grid-cols-4">
          {tiers.map((tier) => {
            const isCurrent = tier.id === progress.tier.id;
            return (
              <li
                key={tier.id}
                className={`flex flex-col gap-2 rounded-[16px] bg-[#F9F6F3] p-4 ${isCurrent ? "ring-2 ring-[#FF9540]" : ""}`}
              >
                <span className={`self-start rounded-full px-2.5 py-0.5 font-sora text-[11px] font-semibold ${tier.badgeClassName}`}>
                  {tier.label}
                </span>
                <p className="font-sora text-[12px] text-black/55">
                  {tier.minPoints === 0 ? "Starting level" : `${tier.minPoints.toLocaleString("en-US")}+ points`}
                </p>
                <p className="font-sora text-[12px] text-black">
                  {tier.pointsMultiplier === 1
                    ? "Standard points"
                    : `${Math.round((tier.pointsMultiplier - 1) * 100)}% bonus points`}
                </p>
                {tier.discountPercent > 0 && (
                  <p className="font-sora text-[12px] text-black">{tier.discountPercent}% off every order</p>
                )}
                {isCurrent && <p className="font-sora text-[11px] font-semibold text-[#FF7100]">You are here</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* History */}
      <section aria-labelledby="history" className={CARD}>
        <h2 id="history" className={CARD_TITLE}>
          Points history
        </h2>
        {transactions.length === 0 ? (
          <p className="mt-3 font-sora text-[14px] text-black/70">
            No points yet — they&apos;ll appear here after your first delivered order.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-black/5 rounded-[20px] bg-[#F9F6F3]">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-sora text-[14px] text-black">
                    {tx.reason === "ORDER_DELIVERED" ? "Points earned" : tx.note || "Points adjusted"}
                    {tx.orderId && <span className="ml-2 text-[11px] text-black/45">{formatOrderId(tx.orderId)}</span>}
                  </p>
                  <p className="font-sora text-[11px] text-black/45">{dateFmt.format(tx.createdAt)}</p>
                </div>
                <span className={`shrink-0 font-sora text-[13px] font-semibold ${tx.points >= 0 ? "text-[#0E9F00]" : "text-[#D72A37]"}`}>
                  {tx.points >= 0 ? "+" : ""}
                  {tx.points.toLocaleString("en-US")} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
