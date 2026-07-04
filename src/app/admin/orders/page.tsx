import Link from "next/link";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "./OrderStatusSelect";
import OrdersToolbar from "./OrdersToolbar";
import Pagination from "./Pagination";

const PAGE_SIZE = 10;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const status = params.status;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status && status !== "ALL" ? { status: status as Prisma.OrderWhereInput["status"] } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { menuItem: true } }, user: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">All Orders</h1>

      <OrdersToolbar />

      {orders.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No orders match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border border-gray-200 rounded-md p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Order ID</p>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-mono text-[#2C6252] hover:underline"
                  >
                    {formatOrderId(order.id)}
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Customer</p>
                  <p className="text-sm">
                    {order.user?.name ?? `${order.firstName} ${order.lastName}`}{" "}
                    {!order.userId && (
                      <span className="text-gray-400 text-xs">(Guest)</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Placed</p>
                  <p className="text-sm">
                    {order.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-700">
                    <span>
                      {item.menuItem.title}{" "}
                      <span className="text-gray-400">x{item.quantity}</span>
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2 border-t border-dashed border-gray-200 text-sm">
                <span className="text-gray-500">
                  {order.shippingMethod === "UBER_EATS" ? "Uber Eats" : "Food Panda"} ·{" "}
                  {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}
                </span>
                <span className="font-bold text-[#2C6252]">
                  USD ${order.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}