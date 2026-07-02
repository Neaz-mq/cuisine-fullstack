import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Container from "@/components/Container";
import { redirect } from "next/navigation";

/**
 * src/app/(main)/account/orders/page.tsx
 *
 * "My Orders" page — protected by middleware.ts (authConfig.callbacks.authorized
 * already blocks unauthenticated access to anything under /account), but we
 * also redirect defensively here in case this page is ever reached directly
 * during a session edge-case (e.g. token just expired).
 *
 * Fetches directly via Prisma instead of calling GET /api/orders/mine over
 * HTTP — this is a Server Component, so there's no benefit to a network
 * round-trip to our own API; the /mine route stays available for any future
 * client-side (e.g. mobile app, polling) use case.
 */

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PLACED: "Placed",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Turns a full cuid (e.g. "cmr38wefz00014ulgwq2ynzne") into a short,
 * trendy display code (e.g. "#ORD-2YNZNE") using the last 6 characters.
 */
function formatOrderId(id: string) {
  const shortCode = id.slice(-6).toUpperCase();
  return `#ORD-${shortCode}`;
}

export default async function MyOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { menuItem: true } } },
  });

  return (
    <Container>
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8">
          My Orders
        </h1>

        {orders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-md">
            <p className="text-gray-500 mb-4">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/order"
              className="inline-block bg-[#FF4C15] text-white font-semibold px-5 py-2 rounded-sm hover:bg-orange-600 transition-colors"
            >
              Browse the menu
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-md p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">Order ID</p>
                    <p className="text-sm font-mono text-gray-700">{formatOrderId(order.id)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Placed on</p>
                    <p className="text-sm text-gray-700">
                      {order.createdAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm text-gray-700"
                    >
                      <span>
                        {item.menuItem.title}{" "}
                        <span className="text-gray-400">x{item.quantity}</span>
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-200">
                  <span className="text-sm text-gray-500">
                    {order.shippingMethod === "UBER_EATS" ? "Uber Eats" : "Food Panda"}
                    {" · "}
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
      </div>
    </Container>
  );
}