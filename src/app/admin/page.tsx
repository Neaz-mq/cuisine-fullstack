import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatOrderId(id: string) {
  return `#ORD-${id.slice(-6).toUpperCase()}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function AdminDashboardPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    pendingOrders,
    deliveredOrders,
    revenueResult,
    recentOrders,
    weekOrders,
    topItemsRaw,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"] } },
    }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: true },
    }),
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

  const totalRevenue = revenueResult._sum.totalAmount ?? 0;

  const stats = [
    { label: "Total Orders", value: totalOrders },
    { label: "Pending / In Progress", value: pendingOrders },
    { label: "Delivered", value: deliveredOrders },
    { label: "Total Revenue", value: `USD $${totalRevenue.toFixed(2)}` },
  ];

  // --- Daily revenue chart (last 7 days) ---
  const dayBuckets: { label: string; revenue: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    dayBuckets.push({ label: formatDate(d), revenue: 0 });
  }
  weekOrders.forEach((order) => {
    const dayIndex = Math.floor(
      (order.createdAt.setHours(0, 0, 0, 0) - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      dayBuckets[dayIndex].revenue += order.totalAmount;
    }
  });
  const maxRevenue = Math.max(...dayBuckets.map((d) => d.revenue), 1);
  const weekTotal = dayBuckets.reduce((sum, d) => sum + d.revenue, 0);

  // --- Top-selling items ---
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
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-gray-200 rounded-md p-4 bg-white">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-[#2C6252]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
        <Link href="/admin/orders" className="text-sm text-[#FF4C15] font-medium hover:underline">
          View all →
        </Link>
      </div>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white mb-8">
        {recentOrders.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No orders yet.</p>
        ) : (
          recentOrders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="text-sm font-mono">{formatOrderId(order.id)}</span>
              <span className="text-sm text-gray-600">
                {order.user?.name ?? `${order.firstName} ${order.lastName}`}
              </span>
              <span className="text-xs text-gray-400">
                {order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                {order.status.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-semibold text-[#2C6252]">${order.totalAmount.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>

      {/* --- Analytics section (merged from /admin/analytics) --- */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Analytics</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Revenue (last 7 days)</p>
          <p className="text-xl font-bold text-[#2C6252]">USD ${weekTotal.toFixed(2)}</p>
        </div>
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Orders (last 7 days)</p>
          <p className="text-xl font-bold text-[#2C6252]">{weekOrders.length}</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md p-5 bg-white mb-8">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Daily Revenue
        </h3>
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
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Top-Selling Items (all time)
        </h3>
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
                <span className="text-xs text-gray-500 w-16 text-right">{item.quantity} sold</span>
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