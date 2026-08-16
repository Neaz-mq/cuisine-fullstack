import { prisma } from "@/lib/prisma";
import { calculateFoodCost, getFoodCostHealth, type FoodCostHealth } from "@/lib/menu-profitability";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount, minorUnitsFor } from "@/lib/currency-format";

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
  // Profitability fields — derived from the item's recipe (see
  // menu-profitability.ts). Independent of sales data above, so these
  // stay populated even for items that have never sold.
  price: number;
  foodCost: number;
  foodCostPercent: number | null;
  grossMargin: number;
  hasRecipe: boolean;
  foodCostHealth: FoodCostHealth;
  // Profit actually banked so far = grossMargin x units sold. Distinct
  // from `revenue` above (revenue is gross sales dollars, this is what's
  // left after ingredient cost) — the number an owner actually cares
  // about when deciding what to push or pull from the menu.
  totalProfitContribution: number;
};

export default async function AdminInsightsPage() {
  // Every figure on this page is money, and the food-cost percentages that
  // drive the whole margin analysis come from InventoryItem.costPerUnit —
  // so a hardcoded "$" here was mislabelling the very numbers an owner uses
  // to decide what stays on the menu.
  const settings = await getRestaurantSettings();
  const units = minorUnitsFor(settings.currency);
  const money = (value: number) => formatAmount(value.toFixed(units), settings.currency);
  const [menuItems, orderItemAgg, reviewAgg] = await Promise.all([
    prisma.menuItem.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        isAvailable: true,
        category: { select: { name: true } },
        // Recipe / Bill-of-Materials — empty array means no recipe has
        // been configured yet, handled as hasRecipe=false below rather
        // than a misleading $0 food cost.
        ingredients: {
          select: {
            quantityRequired: true,
            inventoryItem: { select: { costPerUnit: true } },
          },
        },
      },
    }),
    // OrderItem.price is a UNIT price, not a line total (confirmed by every
    // other place in the app that renders `item.price * item.quantity`).
    // Prisma's groupBy _sum can only sum a raw column, so it can't multiply
    // price by quantity per row — we fetch the raw lines and aggregate
    // revenue in JS instead.
    prisma.orderItem.findMany({
      where: { order: { status: { not: "CANCELLED" } } },
      select: { menuItemId: true, quantity: true, price: true },
    }),
    prisma.review.groupBy({
      by: ["menuItemId"],
      _avg: { rating: true },
      _count: { rating: true },
      where: { status: "APPROVED" },
    }),
  ]);

  const salesMap = new Map<string, { quantity: number; revenue: number }>();
  orderItemAgg.forEach((line) => {
    const existing = salesMap.get(line.menuItemId) ?? { quantity: 0, revenue: 0 };
    existing.quantity += line.quantity;
    // Decimal -> number, display/ranking-এর জন্য। এই সংখ্যা কেবল
    // "কোন পদ কত আয় করল" সাজাতে ব্যবহার হয়, কোনো চালানে যায় না।
    existing.revenue += line.price.toNumber() * line.quantity;
    salesMap.set(line.menuItemId, existing);
  });
  const reviewMap = new Map(reviewAgg.map((r) => [r.menuItemId, r]));

  const stats: ItemStat[] = menuItems.map((item) => {
    const sales = salesMap.get(item.id);
    const reviews = reviewMap.get(item.id);

    // Decimal -> number boundary. menu-profitability.ts ইচ্ছাকৃতভাবে
    // Prisma-মুক্ত (তার header-এর নোট দ্রষ্টব্য), আর এই সংখ্যাগুলো
    // ব্যবস্থাপনার রিপোর্ট — গ্রাহকের চালান নয়, তাই float নিরাপদ।
    const recipe = item.ingredients.map((line) => ({
      quantityRequired: line.quantityRequired,
      costPerUnit: line.inventoryItem.costPerUnit.toNumber(),
    }));
    const { foodCost, foodCostPercent, grossMargin, hasRecipe } = calculateFoodCost(
      recipe,
      item.price.toNumber()
    );

    return {
      id: item.id,
      title: item.title,
      categoryName: item.category?.name ?? "Uncategorized",
      isAvailable: item.isAvailable,
      quantity: sales?.quantity ?? 0,
      revenue: sales?.revenue ?? 0,
      avgRating: reviews?._avg.rating ?? null,
      reviewCount: reviews?._count.rating ?? 0,
      price: item.price.toNumber(),
      foodCost,
      foodCostPercent,
      grossMargin,
      hasRecipe,
      foodCostHealth: getFoodCostHealth(foodCostPercent),
      totalProfitContribution: grossMargin * (sales?.quantity ?? 0),
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

  // Worst food-cost-% first, so the items bleeding the most margin are
  // the first thing the owner sees — matches the "Slowest Movers" /
  // "Quality Risk" pattern above of surfacing what needs attention, not
  // what's already fine. Items without a computable percent (no recipe
  // configured) are kept separate rather than sorted arbitrarily among
  // items that DO have a real number.
  const itemsWithRecipe = stats
    .filter((s) => s.hasRecipe && s.foodCostPercent !== null)
    .sort((a, b) => (b.foodCostPercent ?? 0) - (a.foodCostPercent ?? 0));
  const itemsWithoutRecipe = stats.filter((s) => !s.hasRecipe);

  const foodCostHealthStyles: Record<FoodCostHealth, string> = {
    critical: "bg-red-50 text-red-600",
    watch: "bg-amber-50 text-amber-600",
    healthy: "bg-emerald-50 text-emerald-600",
    unknown: "bg-gray-100 text-gray-500",
  };

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
                  {money(item.revenue)}
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

      {/* Menu profitability */}
      <div className="border border-gray-200 rounded-md p-5 bg-white mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Menu Profitability
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Food cost as a % of price, per item — sorted worst first. Industry rule of thumb: aim for
          28-35%; above 45% usually means the item is losing you money the more it sells.
        </p>
        {itemsWithRecipe.length === 0 ? (
          <p className="text-sm text-gray-400">
            No menu item has a recipe configured yet — add ingredients under Inventory to see food
            cost and margin here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium text-right">Price</th>
                  <th className="py-2 px-3 font-medium text-right">Food Cost</th>
                  <th className="py-2 px-3 font-medium text-right">Food Cost %</th>
                  <th className="py-2 px-3 font-medium text-right">Margin/Unit</th>
                  <th className="py-2 px-3 font-medium text-right">Units Sold</th>
                  <th className="py-2 pl-3 font-medium text-right">Profit Contribution</th>
                </tr>
              </thead>
              <tbody>
                {itemsWithRecipe.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3 text-gray-700 truncate max-w-[160px]">{item.title}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{money(item.price)}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{money(item.foodCost)}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${foodCostHealthStyles[item.foodCostHealth]}`}
                      >
                        {item.foodCostPercent?.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">{money(item.grossMargin)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{item.quantity}</td>
                    <td className="py-2 pl-3 text-right font-semibold text-[#2C6252]">
                      {money(item.totalProfitContribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {itemsWithoutRecipe.length > 0 && (
          <p className="text-xs text-gray-400 mt-4">
            {itemsWithoutRecipe.length} item{itemsWithoutRecipe.length === 1 ? "" : "s"} without a
            recipe configured, so no food cost can be shown:{" "}
            {itemsWithoutRecipe
              .slice(0, 6)
              .map((i) => i.title)
              .join(", ")}
            {itemsWithoutRecipe.length > 6 ? `, +${itemsWithoutRecipe.length - 6} more` : ""}.
          </p>
        )}
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
                  {money(cat.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}