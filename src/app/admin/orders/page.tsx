import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "./OrderStatusSelect";
import OrdersToolbar from "./OrdersToolbar";
import Pagination from "./Pagination";
import PaymentStatusBadge from "./PaymentStatusBadge";

const PAGE_SIZE = 10;

// order.shippingMethod is optional now (dine-in orders have none), so this
// can no longer assume "not Uber Eats therefore Food Panda" — that used to
// be a safe two-way split, but now a null value would incorrectly render
// as "Food Panda". Dine-in orders show their table instead of a shipping
// method at all.
function fulfillmentLabel(order: {
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: string | null;
  table: { label: string } | null;
}) {
  if (order.orderType === "DINE_IN") {
    return `Table ${order.table?.label ?? "—"}`;
  }
  if (order.shippingMethod === "UBER_EATS") return "Uber Eats";
  if (order.shippingMethod === "FOOD_PANDA") return "Food Panda";
  if (order.shippingMethod === "OWN_DELIVERY") return "Our Own Delivery";
  return "—";
}

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
      include: { items: { include: { menuItem: true } }, user: true, table: true },
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
                <OrderStatusSelect
                  orderId={order.id}
                  currentStatus={order.status}
                  orderType={order.orderType}
                />
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

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 text-sm">
                <span className="text-gray-500 flex items-center gap-2">
                  {fulfillmentLabel(order)} ·{" "}
                  {order.paymentMethod === "COD"
                    ? order.orderType === "DINE_IN"
                      ? "Pay at Table"
                      : "Cash on Delivery"
                    : "Online Payment"}
                  {/* Payment status only means anything for online orders —
                      COD/Pay-at-Table is settled in person, not via
                      Order.paymentStatus, so a badge there would just be
                      noise (it sits at its PENDING default forever). */}
                  {order.paymentMethod === "ONLINE" && (
                    <PaymentStatusBadge status={order.paymentStatus} />
                  )}
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