import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "../OrderStatusSelect";
import PaymentStatusBadge from "../PaymentStatusBadge";
import AssignRiderPanel from "./AssignRiderPanel";
import { formatAmount, minorUnitsFor } from "@/lib/currency-format";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { menuItem: true } },
      user: true,
      table: true,
      deliveryTracking: { select: { riderId: true } },
    },
  });

  if (!order) notFound();

  const isDineIn = order.orderType === "DINE_IN";

  // This order's own currency, not today's settings.
  const units = minorUnitsFor(order.currency);
  const money = (value: { toFixed(dp: number): string }) =>
    formatAmount(value.toFixed(units), order.currency);
  const positive = (value: { greaterThan(n: number): boolean }) => value.greaterThan(0);

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

      {!isDineIn && (
        <div className="mb-6">
          <AssignRiderPanel orderId={order.id} currentRiderId={order.deliveryTracking?.riderId ?? null} />
        </div>
      )}

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
              <span>{money(item.price.times(item.quantity))}</span>
            </div>
          ))}
        </div>
        {/* ── The bill ────────────────────────────────────────────────
            Staff need this as much as the customer does: a refund, a
            dispute or a cash reconciliation all turn on knowing how much of
            the total was tax (the government's) and how much was tip (the
            staff's) — neither of which is the restaurant's revenue. */}
        <div className="space-y-1.5 pt-3 mt-3 border-t border-dashed border-gray-200 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>

          {positive(order.discountAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
              <span className="text-[#2C6252]">-{money(order.discountAmount)}</span>
            </div>
          )}

          {positive(order.tierDiscountAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Tier discount</span>
              <span className="text-[#2C6252]">-{money(order.tierDiscountAmount)}</span>
            </div>
          )}

          {positive(order.serviceCharge) && (
            <div className="flex justify-between text-gray-600">
              <span>Service charge</span>
              <span>{money(order.serviceCharge)}</span>
            </div>
          )}

          {positive(order.deliveryFee) && (
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span>{money(order.deliveryFee)}</span>
            </div>
          )}

          {positive(order.taxAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>
                {order.taxName}
                {/* The rate is shown because it is snapshotted per order —
                    an old invoice charged at 5% must still read 5% after
                    the restaurant moves to 10%. */}
                <span className="text-gray-400">
                  {" @ "}
                  {Number(order.taxRate) * 100}%
                  {order.taxMode === "INCLUSIVE" ? ", included" : ""}
                </span>
              </span>
              <span>{money(order.taxAmount)}</span>
            </div>
          )}

          {positive(order.giftCardAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Gift card{order.giftCardCode ? ` (${order.giftCardCode})` : ""}</span>
              <span className="text-[#2C6252]">-{money(order.giftCardAmount)}</span>
            </div>
          )}

          {positive(order.pointsRedeemedAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>Points redeemed ({order.pointsRedeemed} pts)</span>
              <span className="text-[#2C6252]">-{money(order.pointsRedeemedAmount)}</span>
            </div>
          )}

          {positive(order.tipAmount) && (
            <div className="flex justify-between text-gray-600">
              <span>
                Tip <span className="text-gray-400">(staff, not revenue)</span>
              </span>
              <span>{money(order.tipAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-3 mt-3 border-t border-dashed border-gray-200 text-sm">
          <span className="text-gray-500 flex items-center gap-2">
            {isDineIn
              ? `Table ${order.table?.label ?? "—"}`
              : order.shippingMethod === "UBER_EATS"
              ? "Uber Eats"
              : order.shippingMethod === "FOOD_PANDA"
              ? "Food Panda"
              : order.shippingMethod === "OWN_DELIVERY"
              ? "Our Own Delivery"
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
          <span className="font-bold text-[#2C6252]">{money(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}