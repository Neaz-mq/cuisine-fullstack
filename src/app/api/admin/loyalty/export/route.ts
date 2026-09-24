import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getLoyaltyTiers } from "@/lib/loyalty-config";
import { getTierForPoints } from "@/lib/loyalty-tiers";
import { pointsRangeFor } from "@/lib/customer-category";

/**
 * GET /api/admin/loyalty/export?q=&tier=
 *
 * The members list on /admin/loyalty as CSV — same search, same ranking
 * filter, every page. "Points Earned" is the lifetime total from delivered
 * orders; "Points Balance" is what they can spend now.
 */
export async function GET(request: Request) {
  const auth = await requireApiScope("loyalty");
  if (auth instanceof NextResponse) return auth;

  const rate = checkRateLimit(request, "loyalty-export", { limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const tiers = await getLoyaltyTiers();
  const rawTier = searchParams.get("tier");
  const tierFilter = tiers.find((tier) => tier.id === rawTier) ?? null;

  const where: Prisma.UserWhereInput = {
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
    ...(tierFilter
      ? {
          loyaltyPoints: (() => {
            const { min, max } = pointsRangeFor(tierFilter.id, tiers);
            return max === null ? { gte: min } : { gte: min, lt: max };
          })(),
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ loyaltyPoints: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, loyaltyPoints: true, createdAt: true },
  });

  const earned = await prisma.loyaltyTransaction.groupBy({
    by: ["userId"],
    where: { reason: "ORDER_DELIVERED", userId: { in: users.map((user) => user.id) } },
    _sum: { points: true },
  });
  const earnedBy = new Map(earned.map((row) => [row.userId, row._sum.points ?? 0]));

  const header = ["Name", "Email", "Phone", "Ranking", "Points Balance", "Points Earned", "Member Since"];
  const rows = users.map((user) => [
    user.name ?? "",
    user.email,
    user.phone ?? "",
    getTierForPoints(user.loyaltyPoints, tiers).label,
    user.loyaltyPoints,
    earnedBy.get(user.id) ?? 0,
    user.createdAt.toISOString().slice(0, 10),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = tierFilter
    ? tierFilter.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ranking"
    : "all";

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-loyalty-${suffix}-${stamp}.csv"`,
    },
  });
}
