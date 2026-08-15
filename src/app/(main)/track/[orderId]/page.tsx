import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Container from "@/components/Container";
import OrderTrackingTimeline from "./OrderTrackingTimeline";
import { minorUnitsFor } from "@/lib/currency-format";

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

      // পূর্ণ চালান — প্রতিটাই order-এর নিজস্ব snapshot, আজকের settings
      // নয়। তাই হার বদলালেও পুরোনো চালান অবিকৃত থাকে।
      subtotal: true,
      discountAmount: true,
      tierDiscountAmount: true,
      serviceCharge: true,
      deliveryFee: true,
      taxAmount: true,
      taxName: true,
      taxMode: true,
      tipAmount: true,
      grandTotal: true,
      totalAmount: true,
      currency: true,
      giftCardAmount: true,
      pointsRedeemed: true,
      pointsRedeemedAmount: true,

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

  // Order-এর নিজের currency থেকে দশমিক, আজকের settings থেকে নয় — একটা
  // পুরোনো ইয়েন চালান আজ টাকার সেটিংয়ে দুই দশমিকে দেখানো ভুল হতো।
  const units = minorUnitsFor(order.currency);
  const money = (value: { toFixed(dp: number): string }) => value.toFixed(units);

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
            // Decimal -> string, currency-র নিজের দশমিক সংখ্যায়।
            //
            // number-এ নামানো হয় না, কারণ তাহলে ইয়েনে ১২০০ হয়ে যেতো
            // "1200.00" আর দিনারে ১২.৩৪৫ হারাতো তার শেষ অঙ্ক। string-এ
            // পাঠালে client শুধু দেখায়, হিসাব করে না।
            subtotal: money(order.subtotal),
            discountAmount: money(order.discountAmount),
            tierDiscountAmount: money(order.tierDiscountAmount),
            serviceCharge: money(order.serviceCharge),
            deliveryFee: money(order.deliveryFee),
            taxAmount: money(order.taxAmount),
            tipAmount: money(order.tipAmount),
            grandTotal: money(order.grandTotal),
            totalAmount: money(order.totalAmount),
            giftCardAmount: money(order.giftCardAmount),
            pointsRedeemedAmount: money(order.pointsRedeemedAmount),
            items: order.items.map((item) => ({
              ...item,
              // ⚠️ লাইন-মোট, একক দাম নয়।
              //
              // আগে এখানে শুধু item.price পাঠানো হতো, ফলে "Juicy Burger x3"
              // এর পাশে ৯.৪৯ লেখা থাকতো ২৮.৪৭ এর বদলে — গ্রাহক লাইনগুলো
              // যোগ করলে subtotal-এর সাথে মিলতো না। রসিদে সেটা সবচেয়ে
              // দ্রুত আস্থা নষ্ট করে।
              //
              // গুণটা server-এ Decimal-এ হয়, client-এ number-এ নয়।
              price: money(item.price.times(item.quantity)),
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
