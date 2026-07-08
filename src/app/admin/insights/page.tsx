import { prisma } from "@/lib/prisma";

// Minimum approved reviews before we trust a menu item's average rating
// enough to base an insight on it — a single 5-star review shouldn't label
// something a "Hidden Gem".
const MIN_REVIEWS_FOR_RATING_INSIGHT = 2;
const HIDDEN_GEM_MIN_RATING = 4.0;
const QUALITY_RISK_MAX_RATING = 3.0;

type ItemStat = {
  id: string;
  title: string;
  categoryName: string;
  isAvailable: boolean;
  quantity: number;
  revenue: number;
  avgRating: number | null;
  reviewCount: number;
};

export default async function AdminInsightsPage() {
  const [menuItems, orderItemAgg, reviewAgg] = await Promise.all([
    prisma.menuItem.findMany({
      select: {
        id: true,
        title: true,
        isAvailable: true,
        category: { select: { name: true } },
      },
    }),
    // Same "exclude CANCELLED orders" convention as the Dashboard's
    // top-selling-items query.
    prisma.orderItem.groupBy({
      by: ["menuItemId"],
      _sum: { quantity: true, price: true },
      where: { order: { status: { not: "CANCELLED" } } },
    }),
    prisma.review.groupBy({
      by: ["menuItemId"],
      _avg: { rating: true },
      _count: { rating: true },
      where: { status: "APPROVED" },
    }),
  ]);

  const salesMap = new Map(orderItemAgg.map((o) => [o.menuItemId, o]));
  const reviewMap = new Map(reviewAgg.map((r) => [r.menuItemId, r]));

  const stats: ItemStat[] = menuItems.map((item) => {
    const sales = salesMap.get(item.id);
    const reviews = reviewMap.get(item.id);
    return {
      id: item.id,
      title: item.title,
      categoryName: item.category?.name ?? "Uncategorized",
      isAvailable: item.isAvailable,
      quantity: sales?._sum.quantity ?? 0,
      revenue: sales?._sum.price ?? 0,
      avgRating: reviews?._avg.rating ?? null,
      reviewCount: reviews?._count.rating ?? 0,
    };
  });

  const soldItems = stats.filter((s) => s.quantity > 0);
  const avgQuantityAcrossSoldItems =
    soldItems.length > 0
      ? soldItems.reduce((sum, s) => sum + s.quantity, 0) / soldItems.length
      : 0;

  const topSellers = [...soldItems].sort((a, b) => b.quantity - a.quantity).slice(0, 8);

  const bottomSellers = [...soldItems].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

  const neverOrdered = stats.filter((s) => s.quantity === 0);

  const hiddenGems = stats
    .filter(
      (s) =>
        s.reviewCount >= MIN_REVIEWS_FOR_RATING_INSIGHT &&
        (s.avgRating ?? 0) >= HIDDEN_GEM_MIN_RATING &&
        s.quantity < avgQuantityAcrossSoldItems
    )
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, 5);

  const qualityRisks = stats
    .filter(
      (s) =>
        s.reviewCount >= MIN_REVIEWS_FOR_RATING_INSIGHT &&
        (s.avgRating ?? 5) <= QUALITY_RISK_MAX_RATING
    )
    .sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0))
    .slice(0, 5);

  const categoryRevenueMap = new Map<string, number>();
  stats.forEach((s) => {
    categoryRevenueMap.set(s.categoryName, (categoryRevenueMap.get(s.categoryName) ?? 0) + s.revenue);
  });
  const categoryRevenue = [...categoryRevenueMap.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxCategoryRevenue = Math.max(...categoryRevenue.map((c) => c.revenue), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">Menu Insights</h1>
      <p className="text-sm text-gray-400 mb-6">
        Data-driven analysis of sales and ratings across your menu.
      </p>

      {/* Top sellers */}
      <div className="border border-gray-200 rounded-md p-5 bg-white mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Top-Selling Items
        </h3>
        {topSellers.length === 0 ? (
          <p className="text-sm text-gray-400">No order data yet.</p>
        ) : (
          <div className="space-y-3">
            {topSellers.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-44 truncate">{item.title}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-[#FF4C15] h-2 rounded-full"
                    style={{ width: `${(item.quantity / topSellers[0].quantity) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{item.quantity} sold</span>
                <span className="text-xs font-semibold text-[#2C6252] w-20 text-right">
                  ${item.revenue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Hidden gems */}
        <div className="border border-gray-200 rounded-md p-5 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Hidden Gems
          </h3>
          <p className="text-xs text-gray-400 mb-4">Highly rated, but underselling — worth promoting.</p>
          {hiddenGems.length === 0 ? (
            <p className="text-sm text-gray-400">None right now.</p>
          ) : (
            <div className="space-y-3">
              {hiddenGems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} sold &middot; {item.reviewCount} reviews
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full shrink-0">
                    ★ {item.avgRating?.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quality risk */}
        <div className="border border-gray-200 rounded-md p-5 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Quality Risk
          </h3>
          <p className="text-xs text-gray-400 mb-4">Low rated items — review the recipe or listing.</p>
          {qualityRisks.length === 0 ? (
            <p className="text-sm text-gray-400">None right now.</p>
          ) : (
            <div className="space-y-3">
              {qualityRisks.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} sold &middot; {item.reviewCount} reviews
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full shrink-0">
                    ★ {item.avgRating?.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Bottom sellers */}
        <div className="border border-gray-200 rounded-md p-5 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Slowest Movers
          </h3>
          {bottomSellers.length === 0 ? (
            <p className="text-sm text-gray-400">Not enough order data yet.</p>
          ) : (
            <div className="space-y-2">
              {bottomSellers.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{item.title}</span>
                  <span className="text-gray-400 text-xs shrink-0 ml-2">{item.quantity} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Never ordered */}
        <div className="border border-gray-200 rounded-md p-5 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Never Ordered
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            On the menu, zero orders so far — consider removing or featuring these.
          </p>
          {neverOrdered.length === 0 ? (
            <p className="text-sm text-gray-400">Every menu item has sold at least once. 🎉</p>
          ) : (
            <div className="space-y-2">
              {neverOrdered.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{item.title}</span>
                  {!item.isAvailable && (
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2">unavailable</span>
                  )}
                </div>
              ))}
              {neverOrdered.length > 10 && (
                <p className="text-xs text-gray-400 pt-1">+{neverOrdered.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Category revenue */}
      <div className="border border-gray-200 rounded-md p-5 bg-white">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Revenue by Category
        </h3>
        {categoryRevenue.every((c) => c.revenue === 0) ? (
          <p className="text-sm text-gray-400">No order data yet.</p>
        ) : (
          <div className="space-y-3">
            {categoryRevenue.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-32 truncate">{cat.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-[#2C6252] h-2 rounded-full"
                    style={{ width: `${(cat.revenue / maxCategoryRevenue) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#2C6252] w-20 text-right">
                  ${cat.revenue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}