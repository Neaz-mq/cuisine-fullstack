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
      deliveryTracking: {
        select: {
          riderLat: true,
          riderLng: true,
          riderLocationUpdatedAt: true,
          destLat: true,
          destLng: true,
          deliveredAt: true,
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
        {/*
          ⚠️ আগে এখানে JSON.parse(JSON.stringify(order)) ছিল।

          Date-গুলো serialize করাই ছিল উদ্দেশ্য, কিন্তু পার্শ্বপ্রতিক্রিয়া
          হিসেবে এটা পুরো object-টাকে `any` করে দিত — tsc-এর কাছে সব
          ধরনের তথ্য হারিয়ে যেতো।

          money model আসার পর সেটা আর নিরীহ নয়: JSON.stringify একটা
          Prisma Decimal-কে string বানায় ("1050"), তাই client-এ
          totalAmount.toFixed(2) crash করত আর price * quantity NaN দিত —
          অথচ tsc একটা শব্দও বলত না, কারণ সে `any` দেখছিল।

          তাই স্পষ্টভাবে map করা হচ্ছে। এখন client component-এর prop
          type-এর সাথে গরমিল হলে tsc সাথে সাথে ধরবে।
        */}
        <OrderTrackingTimeline
          initialOrder={{
            ...order,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map((item) => ({
              ...item,
              price: item.price.toNumber(),
            })),
            deliveryTracking: order.deliveryTracking
              ? {
                  ...order.deliveryTracking,
                  // non-null in the schema (@default(now())), so no ?? null
                  riderLocationUpdatedAt:
                    order.deliveryTracking.riderLocationUpdatedAt.toISOString(),
                  deliveredAt: order.deliveryTracking.deliveredAt?.toISOString() ?? null,
                }
              : null,
          }}
        />
      </div>
    </Container>
  );
}
