import { prisma } from "@/lib/prisma";
import {
  calculateFoodCost,
  getFoodCostHealth,
  type FoodCostHealth,
} from "@/lib/menu-profitability";
import { periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import type { MenuStatusFilter } from "@/lib/menu-status-filter";

/**
 * src/lib/menu-insights.ts
 *
 * Everything the /admin/insights page and its CSV export calculate, in one
 * place — so the file you download always shows the same numbers as the
 * screen you downloaded it from.
 *
 * The page has several cards, and each card has its OWN period filter
 * (Top Selling "This Week" while Revenue by Category is "Today", say). So
 * order lines are loaded once, with their order date, and every card
 * filters that one list by its own start date in memory. That is one DB
 * round trip instead of one per card.
 */

/** A menu item with everything that does NOT depend on a period. */
export interface MenuItemBase {
  id: string;
  title: string;
  categoryName: string;
  isAvailable: boolean;
  price: number;
  avgRating: number | null;
  reviewCount: number;
  // From the item's recipe (see menu-profitability.ts). Independent of
  // sales, so these stay filled even for items that never sold.
  foodCost: number;
  foodCostPercent: number | null;
  grossMargin: number;
  hasRecipe: boolean;
  foodCostHealth: FoodCostHealth;
}

/** The same item, with its sales inside one period. */
export interface MenuItemSales extends MenuItemBase {
  quantity: number;
  /** Gross item sales: unit price × quantity, before order-level discounts. */
  revenue: number;
}

interface SalesLine {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  orderedAt: Date;
}

export interface MenuInsightSource {
  items: MenuItemBase[];
  lines: SalesLine[];
}

export async function loadMenuInsightSource(): Promise<MenuInsightSource> {
  const [menuItems, orderLines, reviewAgg] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        price: true,
        isAvailable: true,
        category: { select: { name: true } },
        // Recipe / bill of materials. An empty list means no recipe yet —
        // treated as hasRecipe=false, not as a misleading $0 food cost.
        ingredients: {
          select: {
            quantityRequired: true,
            inventoryItem: { select: { costPerUnit: true } },
          },
        },
      },
    }),
    // OrderItem.price is a UNIT price, not a line total. Prisma's groupBy
    // can't multiply price × quantity per row, so we fetch the raw lines
    // and add them up in JS.
    prisma.orderItem.findMany({
      where: { order: { status: { not: "CANCELLED" } } },
      select: {
        menuItemId: true,
        quantity: true,
        price: true,
        order: { select: { createdAt: true } },
      },
    }),
    prisma.review.groupBy({
      by: ["menuItemId"],
      _avg: { rating: true },
      _count: { rating: true },
      where: { status: "APPROVED" },
    }),
  ]);

  const reviewMap = new Map(reviewAgg.map((r) => [r.menuItemId, r]));

  const items: MenuItemBase[] = menuItems.map((item) => {
    const reviews = reviewMap.get(item.id);

    // Decimal → number boundary. These are management figures, not a
    // customer invoice, so float is fine here (menu-profitability.ts is
    // Prisma-free on purpose).
    const price = item.price.toNumber();
    const { foodCost, foodCostPercent, grossMargin, hasRecipe } = calculateFoodCost(
      item.ingredients.map((line) => ({
        quantityRequired: line.quantityRequired,
        costPerUnit: line.inventoryItem.costPerUnit.toNumber(),
      })),
      price
    );

    return {
      id: item.id,
      title: item.title,
      categoryName: item.category?.name ?? "Uncategorized",
      isAvailable: item.isAvailable,
      price,
      avgRating: reviews?._avg.rating ?? null,
      reviewCount: reviews?._count.rating ?? 0,
      foodCost,
      foodCostPercent,
      grossMargin,
      hasRecipe,
      foodCostHealth: getFoodCostHealth(foodCostPercent),
    };
  });

  const lines: SalesLine[] = orderLines.map((line) => ({
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    unitPrice: line.price.toNumber(),
    orderedAt: line.order.createdAt,
  }));

  return { items, lines };
}

/** Search box + "All Statuses" menu, applied to every item card. */
export function filterMenuItems<T extends MenuItemBase>(
  items: T[],
  q: string | undefined,
  status: MenuStatusFilter
): T[] {
  const needle = q?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (status === "available" && !item.isAvailable) return false;
    if (status === "unavailable" && item.isAvailable) return false;
    return !needle || item.title.toLowerCase().includes(needle);
  });
}

/** Each item's quantity and revenue inside one period. */
export function withSales(
  source: MenuInsightSource,
  items: MenuItemBase[],
  period: DashboardPeriod,
  now: Date = new Date()
): MenuItemSales[] {
  const since = periodStart(period, now);
  const totals = new Map<string, { quantity: number; revenue: number }>();

  for (const line of source.lines) {
    if (since && line.orderedAt < since) continue;
    const entry = totals.get(line.menuItemId) ?? { quantity: 0, revenue: 0 };
    entry.quantity += line.quantity;
    entry.revenue += line.unitPrice * line.quantity;
    totals.set(line.menuItemId, entry);
  }

  return items.map((item) => ({
    ...item,
    quantity: totals.get(item.id)?.quantity ?? 0,
    revenue: totals.get(item.id)?.revenue ?? 0,
  }));
}

/** Most units first; revenue breaks a tie. */
export function topSelling(items: MenuItemSales[]): MenuItemSales[] {
  return items
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

/** Sold at least once in the period, fewest units first. */
export function slowestSelling(items: MenuItemSales[]): MenuItemSales[] {
  return items
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue);
}

/** On the menu, zero units in the period. Available items first. */
export function neverSelling(items: MenuItemSales[]): MenuItemSales[] {
  return items
    .filter((item) => item.quantity === 0)
    .sort(
      (a, b) =>
        Number(b.isAvailable) - Number(a.isAvailable) || a.title.localeCompare(b.title)
    );
}

export interface CategoryRevenue {
  name: string;
  revenue: number;
  quantity: number;
}

/** Every category that has a visible item, highest revenue first. */
export function revenueByCategory(items: MenuItemSales[]): CategoryRevenue[] {
  const map = new Map<string, CategoryRevenue>();
  for (const item of items) {
    const entry = map.get(item.categoryName) ?? {
      name: item.categoryName,
      revenue: 0,
      quantity: 0,
    };
    entry.revenue += item.revenue;
    entry.quantity += item.quantity;
    map.set(item.categoryName, entry);
  }
  return [...map.values()].sort(
    (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name)
  );
}

/**
 * Worst food-cost % first, so the items losing the most margin are the
 * first thing the owner sees. Items with no recipe have no real number, so
 * they are returned separately instead of being sorted in among the rest.
 */
export function profitability(items: MenuItemSales[]) {
  const withRecipe = items
    .filter((item) => item.hasRecipe && item.foodCostPercent !== null)
    .sort((a, b) => (b.foodCostPercent ?? 0) - (a.foodCostPercent ?? 0))
    .map((item) => ({ ...item, profitContribution: item.grossMargin * item.quantity }));
  const withoutRecipe = items.filter((item) => !item.hasRecipe);
  return { withRecipe, withoutRecipe };
}

/**
 * The window the "Customer Growth" tile compares against.
 *
 *   today → yesterday
 *   week  → the 7 days before the last 7
 *   month → the 30 days before the last 30
 *   all   → there is no "before all time", so it compares this calendar
 *           month with last calendar month
 */
export function growthWindows(
  period: DashboardPeriod,
  now: Date = new Date()
): { current: { gte: Date; lt: Date }; previous: { gte: Date; lt: Date }; label: string } {
  if (period === "all") {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      current: { gte: thisMonth, lt: now },
      previous: { gte: lastMonth, lt: thisMonth },
      label: "This month vs last month",
    };
  }

  const start = periodStart(period, now) as Date;
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - days);

  const label =
    period === "today"
      ? "Compared to Yesterday"
      : period === "week"
        ? "Compared to Last Week"
        : "Compared to Last Month";

  return {
    current: { gte: start, lt: now },
    previous: { gte: previousStart, lt: start },
    label,
  };
}
