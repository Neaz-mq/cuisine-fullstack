import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Container from "@/components/Container";
import OrderTrackingTimeline from "./OrderTrackingTimeline";

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      totalAmount: true,
      firstName: true,
      city: true,
      orderType: true,
      shippingMethod: true,
      table: { select: { label: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          menuItem: { select: { title: true } },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <Container>
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 max-w-2xl mx-auto">
        <OrderTrackingTimeline initialOrder={JSON.parse(JSON.stringify(order))} />
      </div>
    </Container>
  );
}
