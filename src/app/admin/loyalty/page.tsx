import { Calendar, Gift, Users, UserCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/lib/require-admin";
import { hasPermission } from "@/lib/permissions";
import { getRestaurantSettings } from "@/lib/get-settings";
import {
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  isDashboardPeriod,
  periodStart,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import { getEarnRules, getLoyaltyTiers } from "@/lib/loyalty-config";
import { getTierForPoints, tierRangeLabel } from "@/lib/loyalty-tiers";
import { pointsRangeFor } from "@/lib/customer-category";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import UserAvatar from "@/components/admin/UserAvatar";
import Pagination from "../orders/Pagination";
import UrlFilterMenu from "../offers/UrlFilterMenu";
import LoyaltyToolbar from "./LoyaltyToolbar";
import AdjustPointsButton from "./AdjustPointsButton";
import TargetPointSection, { type EarnRuleView } from "./TargetPointSection";
import RankingSection, { type TierView } from "./RankingSection";

export const metadata = { title: "Loyalty" };

/**
 * /admin/loyalty — built to the Figma "Loyalty" frame (1059 wide, column,
 * gap 24):
 *
 *   Welcome header · date pill · Export Report
 *   Search + All Statuses (filter by ranking)
 *   Overview — Total Members / Active Members / Points Earned (?overview=)
 *   Loyalty — members by points, 5 per page (?page=), each with Adjust
 *   Target Point — how points are earned (one applied at a time)
 *   Customer Ranking — the tiers
 *
 * Every registered customer is a member (accounts join automatically);
 * guests don't earn points. Tiers come from the points balance, so a
 * ranking change applies to everyone at once.
 *
 * Cashiers ("loyalty" scope) can see the page and adjust a customer's
 * points; changing targets or rankings needs the "settings" scope
 * (owner/manager) — the API routes check the same thing.
 */

const PAGE_SIZE = 5;

const CARD = "flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";

const PERIOD_OPTIONS = DASHBOARD_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }));

type SearchParams = { q?: string; tier?: string; overview?: string; page?: string };

export default async function AdminLoyaltyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff("loyalty");
  const canManage = hasPermission((session.user as { role?: string }).role, "settings");
  const params = await searchParams;

  const [settings, tiers, earnRules] = await Promise.all([
    getRestaurantSettings(),
    getLoyaltyTiers(),
    getEarnRules(),
  ]);

  const q = params.q?.trim() || undefined;
  const tierFilter = tiers.some((tier) => tier.id === params.tier) ? (params.tier as string) : "all";
  const overviewPeriod: DashboardPeriod = isDashboardPeriod(params.overview) ? params.overview : "today";
  const requestedPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();
  const since = periodStart(overviewPeriod, now);
  const day = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: settings.timezone,
  });

  const pointsWhere = (tierId: string): Prisma.IntFilter => {
    const { min, max } = pointsRangeFor(tierId, tiers);
    return max === null ? { gte: min } : { gte: min, lt: max };
  };

  const memberWhere: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(tierFilter !== "all" ? { loyaltyPoints: pointsWhere(tierFilter) } : {}),
  };

  const [totalMembers, activeMembers, earned, listTotal, tierCounts] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    // "Recently engaged" = any points activity in the period: earned,
    // redeemed or adjusted.
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        loyaltyTransactions: { some: since ? { createdAt: { gte: since } } : {} },
      },
    }),
    // Earned from delivered orders only — redemptions and hand adjustments
    // aren't "earned".
    prisma.loyaltyTransaction.aggregate({
      _sum: { points: true },
      where: { reason: "ORDER_DELIVERED", ...(since ? { createdAt: { gte: since } } : {}) },
    }),
    prisma.user.count({ where: memberWhere }),
    Promise.all(
      tiers.map((tier) =>
        prisma.user.count({ where: { role: "CUSTOMER", loyaltyPoints: pointsWhere(tier.id) } })
      )
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const members = await prisma.user.findMany({
    where: memberWhere,
    orderBy: [{ loyaltyPoints: "desc" }, { name: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, name: true, email: true, image: true, loyaltyPoints: true },
  });

  const tiles = [
    { label: "Total Members", value: totalMembers, hint: "Loyalty Program Members", icon: Users },
    { label: "Active Members", value: activeMembers, hint: "Recently Engaged Members", icon: UserCheck },
    { label: "Points Earned", value: earned._sum.points ?? 0, hint: "Total Points Earned", icon: Gift },
  ];

  const tierOptions = [
    { value: "all", label: "All Statuses" },
    ...tiers.map((tier) => ({ value: tier.id, label: tier.label })),
  ];

  const ruleViews: EarnRuleView[] = earnRules.map((rule) => ({
    id: rule.id,
    spend: rule.spendAmount.toNumber(),
    points: rule.points,
    isActive: rule.isActive,
  }));

  const tierViews: TierView[] = tiers.map((tier, index) => ({
    id: tier.id,
    name: tier.label,
    minPoints: tier.minPoints,
    discountPercent: tier.discountPercent,
    bonusPercent: Math.round((tier.pointsMultiplier - 1) * 100),
    rangeLabel: tierRangeLabel(tier, tiers),
    members: tierCounts[index],
  }));

  const start = listTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, listTotal);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Welcome header — same markup as the dashboard ── */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user?.name ?? "there"}!
          </span>
        </h1>
        <div className="flex w-full shrink-0 flex-nowrap items-center gap-2.5 md:w-auto md:justify-start">
          <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black md:h-11 md:flex-none md:justify-start md:px-4 md:text-[14px]">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span>{day}</span>
          </span>
          <ExportReportButton
            endpoint="/api/admin/loyalty/export"
            forwardParams={["q", "tier"]}
            fallbackFilename="cuisine-loyalty-members.csv"
          />
        </div>
      </div>

      <LoyaltyToolbar tier={tierFilter} options={tierOptions} />

      {/* ── Overview ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Overview</h2>
          <UrlFilterMenu
            param="overview"
            value={overviewPeriod}
            defaultValue="today"
            options={PERIOD_OPTIONS}
            ariaLabel="Period"
          />
        </div>
        <div className="grid gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-5">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-tight text-black lg:text-[20px] lg:leading-none">
                  {tile.label}
                </h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <tile.icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {tile.value.toLocaleString("en-US")}
                </p>
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">{tile.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Loyalty — members by points ── */}
      <section className={CARD}>
        <h2 className={CARD_TITLE}>Loyalty</h2>

        {members.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.5] text-black/70">
            {q || tierFilter !== "all" ? "No members match your search or filter." : "No customers yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {members.map((member) => {
              const tier = getTierForPoints(member.loyaltyPoints, tiers);
              const displayName = member.name || member.email;
              return (
                <li
                  key={member.id}
                  className="flex min-w-0 flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar src={member.image} name={displayName} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="max-w-full truncate font-frank-ruhl text-[16px] font-semibold leading-tight text-black min-[480px]:text-[18px]">
                          {displayName}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-sora text-[10px] font-semibold leading-[1.4] ${tier.badgeClassName}`}
                        >
                          {tier.label}
                        </span>
                      </div>
                      <p className="truncate font-sora text-[12px] leading-[1.5] text-black/70">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 min-[480px]:ml-auto min-[480px]:justify-end">
                    <span className="whitespace-nowrap font-frank-ruhl text-[16px] font-semibold leading-none text-black min-[480px]:text-[18px]">
                      {member.loyaltyPoints.toLocaleString("en-US")} Points
                    </span>
                    <AdjustPointsButton userId={member.id} name={displayName} points={member.loyaltyPoints} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {listTotal > 0 && (
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <p className="flex items-center gap-2 font-sora text-[12px] leading-[15px] text-black/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" />
              <span>
                Showing{" "}
                <span className="font-semibold text-black">
                  {start}-{end}
                </span>{" "}
                of <span className="font-semibold text-black">{listTotal}</span>{" "}
                {listTotal === 1 ? "Member" : "Members"}
              </span>
            </p>
            <div className="min-w-0 max-[479px]:[&_nav>*]:h-7 max-[479px]:[&_nav>*]:w-7 max-[479px]:[&_nav]:gap-1">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                searchParams={{
                  q,
                  tier: tierFilter === "all" ? undefined : tierFilter,
                  overview: params.overview,
                }}
                basePath="/admin/loyalty"
              />
            </div>
          </div>
        )}
      </section>

      <TargetPointSection rules={ruleViews} currency={settings.currency} canManage={canManage} />

      <RankingSection tiers={tierViews} canManage={canManage} />
    </div>
  );
}
