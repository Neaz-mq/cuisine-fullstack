import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "./OrderStatusSelect";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { menuItem: true } }, user: true },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">All Orders</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="border border-gray-200 rounded-md p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-400">Order ID</p>
                <p className="text-sm font-mono">{formatOrderId(order.id)}</p>
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
    </div>
  );
}