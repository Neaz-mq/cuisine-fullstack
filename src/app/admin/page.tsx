import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatOrderId(id: string) {
  return `#ORD-${id.slice(-6).toUpperCase()}`;
}

export default async function AdminDashboardPage() {
  const [
    totalOrders,
    pendingOrders,
    deliveredOrders,
    revenueResult,
    recentOrders,
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
  ]);

  const totalRevenue = revenueResult._sum.totalAmount ?? 0;

  const stats = [
    { label: "Total Orders", value: totalOrders },
    { label: "Pending / In Progress", value: pendingOrders },
    { label: "Delivered", value: deliveredOrders },
    { label: "Total Revenue", value: `USD $${totalRevenue.toFixed(2)}` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-gray-200 rounded-md p-4 bg-white"
          >
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-[#2C6252]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
        <Link
          href="/admin/orders"
          className="text-sm text-[#FF4C15] font-medium hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
        {recentOrders.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No orders yet.</p>
        ) : (
          recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span className="text-sm font-mono">{formatOrderId(order.id)}</span>
              <span className="text-sm text-gray-600">
                {order.user?.name ?? `${order.firstName} ${order.lastName}`}
              </span>
              <span className="text-xs text-gray-400">
                {order.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {order.status.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-semibold text-[#2C6252]">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}