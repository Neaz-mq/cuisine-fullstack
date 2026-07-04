import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [orders, topItemsRaw] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: { not: "CANCELLED" },
      },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["menuItemId"],
      _sum: { quantity: true, price: true },
      where: {
        order: { status: { not: "CANCELLED" } },
      },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const dayBuckets: { date: Date; label: string; revenue: number; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    dayBuckets.push({ date: d, label: formatDate(d), revenue: 0, count: 0 });
  }

  orders.forEach((order) => {
    const dayIndex = Math.floor(
      (order.createdAt.setHours(0, 0, 0, 0) - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      dayBuckets[dayIndex].revenue += order.totalAmount;
      dayBuckets[dayIndex].count += 1;
    }
  });

  const maxRevenue = Math.max(...dayBuckets.map((d) => d.revenue), 1);
  const weekTotal = dayBuckets.reduce((sum, d) => sum + d.revenue, 0);
  const weekOrderCount = dayBuckets.reduce((sum, d) => sum + d.count, 0);

  const menuItemIds = topItemsRaw.map((t) => t.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, title: true },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m.title]));

  const topItems = topItemsRaw.map((t) => ({
    title: menuItemMap.get(t.menuItemId) ?? "Unknown item",
    quantity: t._sum.quantity ?? 0,
    revenue: t._sum.price ?? 0,
  }));
  const maxQuantity = Math.max(...topItems.map((t) => t.quantity), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Revenue (last 7 days)</p>
          <p className="text-xl font-bold text-[#2C6252]">USD ${weekTotal.toFixed(2)}</p>
        </div>
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Orders (last 7 days)</p>
          <p className="text-xl font-bold text-[#2C6252]">{weekOrderCount}</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md p-5 bg-white mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Daily Revenue
        </h2>
        <div className="flex items-end gap-3 h-40">
          {dayBuckets.map((day) => (
            <div key={day.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs text-gray-500 mb-1">
                {day.revenue > 0 ? `$${day.revenue.toFixed(0)}` : ""}
              </span>
              <div
                className="w-full bg-[#2C6252] rounded-t-sm transition-all"
                style={{
                  height: `${Math.max((day.revenue / maxRevenue) * 100, day.revenue > 0 ? 4 : 0)}%`,
                }}
              />
              <span className="text-xs text-gray-400 mt-2">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-md p-5 bg-white">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Top-Selling Items (all time)
        </h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-gray-400">No order data yet.</p>
        ) : (
          <div className="space-y-3">
            {topItems.map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-40 truncate">{item.title}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-[#FF4C15] h-2 rounded-full"
                    style={{ width: `${(item.quantity / maxQuantity) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {item.quantity} sold
                </span>
                <span className="text-xs font-semibold text-[#2C6252] w-20 text-right">
                  ${item.revenue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}