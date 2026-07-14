import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "../OrderStatusSelect";
import PaymentStatusBadge from "../PaymentStatusBadge";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { menuItem: true } }, user: true, table: true },
  });

  if (!order) notFound();

  const isDineIn = order.orderType === "DINE_IN";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin/orders"
        className="text-sm text-gray-500 hover:text-gray-800 mb-4 inline-block"
      >
        ← Back to all orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {formatOrderId(order.id)}
          </h1>
          <p className="text-sm text-gray-400">
            Placed{" "}
            {order.createdAt.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <OrderStatusSelect
          orderId={order.id}
          currentStatus={order.status}
          orderType={order.orderType}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Customer & Contact */}
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Customer
          </h2>
          <p className="text-sm text-gray-800 font-medium">
            {order.firstName} {order.lastName}
          </p>
          {order.user ? (
            <p className="text-xs text-gray-400 mt-1">Registered account</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Guest checkout</p>
          )}
          {order.email && <p className="text-sm text-gray-600 mt-2">{order.email}</p>}
          <p className="text-sm text-gray-600">{order.phone}</p>
        </div>

        {/* Delivery Address (DELIVERY) / Table (DINE_IN) */}
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {isDineIn ? "Table" : "Delivery Address"}
          </h2>
          {isDineIn ? (
            <p className="text-sm text-gray-700">
              Table <span className="font-semibold">{order.table?.label ?? "—"}</span>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700">{order.address}</p>
              {order.apartment && (
                <p className="text-sm text-gray-700">{order.apartment}</p>
              )}
              <p className="text-sm text-gray-700">
                {order.city}, {order.state} {order.zip}
              </p>
              <p className="text-sm text-gray-700">{order.country}</p>
            </>
          )}
        </div>
      </div>

      {/* Order Items */}
      <div className="border border-gray-200 rounded-md p-4 bg-white mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Items
        </h2>
        <div className="space-y-2">
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
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-dashed border-gray-200 text-sm">
          <span className="text-gray-500 flex items-center gap-2">
            {isDineIn
              ? `Table ${order.table?.label ?? "—"}`
              : order.shippingMethod === "UBER_EATS"
              ? "Uber Eats"
              : order.shippingMethod === "FOOD_PANDA"
              ? "Food Panda"
              : "—"}{" "}
            ·{" "}
            {order.paymentMethod === "COD"
              ? isDineIn
                ? "Pay at Table"
                : "Cash on Delivery"
              : "Online Payment"}
            {order.paymentMethod === "ONLINE" && (
              <PaymentStatusBadge status={order.paymentStatus} />
            )}
          </span>
          <span className="font-bold text-[#2C6252]">
            USD ${order.totalAmount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}