import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import RiderDashboard, { type Delivery } from "./RiderDashboard";

export default async function MyDeliveriesPage() {
  const session = await auth();
  const riderId = session!.user.id;

  const rows = await prisma.deliveryTracking.findMany({
    where: { riderId, deliveredAt: null },
    orderBy: { assignedAt: "asc" },
    select: {
      orderId: true,
      destLat: true,
      destLng: true,
      assignedAt: true,
      order: {
        select: {
          status: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          apartment: true,
          city: true,
          state: true,
          zip: true,
          totalAmount: true,
          paymentMethod: true,
        },
      },
    },
  });

  const initialDeliveries: Delivery[] = rows
    .filter((d) => d.order.status !== "CANCELLED")
    .map((d) => ({
      orderId: d.orderId,
      status: d.order.status,
      customerName: `${d.order.firstName} ${d.order.lastName}`,
      phone: d.order.phone,
      address: [d.order.address, d.order.apartment, d.order.city, d.order.state, d.order.zip]
        .filter(Boolean)
        .join(", "),
      totalAmount: d.order.totalAmount,
      paymentMethod: d.order.paymentMethod,
      destLat: d.destLat,
      destLng: d.destLng,
      assignedAt: d.assignedAt.toISOString(),
    }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">My Deliveries</h1>
      <p className="text-sm text-gray-500 mb-6">
        Keep this page open while you&apos;re on the road — your location is shared
        with the customer automatically.
      </p>
      <RiderDashboard initialDeliveries={initialDeliveries} />
    </div>
  );
}
