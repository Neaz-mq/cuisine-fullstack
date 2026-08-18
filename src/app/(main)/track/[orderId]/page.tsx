import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Container from "@/components/Container";
import OrderTrackingTimeline from "./OrderTrackingTimeline";
import { minorUnitsFor } from "@/lib/currency-format";
import { resolveOrderAccess, canSeeRiderLocation } from "@/lib/order-access";

/**
 * /track/[orderId]
 *
 * ⚠️ এই পাতাটাই ছিল আসল ফাঁকটা।
 *
 * GET /api/orders/[id]-এ auth বসানোর পরেও এই পাতা একা হাতে সব ফাঁস
 * করে দিতো — এটা একটা server component, নিজেই Prisma থেকে পড়ে, নিজেই
 * render করে, poll endpoint-টাকে ছোঁয়ও না প্রথম বার। শুধু API বন্ধ
 * করলে দরজায় তালা লাগিয়ে জানালা খোলা রাখা হতো।
 *
 * তাই দুটোই এখন এক নিয়মে চলে — lib/order-access.ts।
 *
 * ── 404 নয়, login redirect কেন ────────────────────────────────────────
 *
 * API route denial-এ 404 দেয় (enumeration আটকাতে)। কিন্তু পাতায় 404
 * ভুল উত্তর: এখানে সবচেয়ে সম্ভাব্য দৃশ্যটা কোনো আক্রমণ নয় — গ্রাহক
 * নিজেই, confirmation email-এর link ফোনে খুলেছে যেখানে সে logged out।
 * তাকে "Order not found" দেখানো মানে একটা dead end।
 *
 * তাই callbackUrl সহ /login-এ পাঠানো হয়: log in করলে সে ঠিক এই
 * পাতাতেই ফিরে আসবে। Guest order কখনো এই শাখায় পৌঁছায় না, কারণ
 * মালিকহীন order-এ bearer access সবসময় পাশ করে।
 */

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

      // Access সিদ্ধান্তের জন্য — client component-এ কখনো যায় না।
      userId: true,

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

  const access = await resolveOrderAccess(order);
  if (!access) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/track/${orderId}`)}`);
  }

  // Rider-এর স্থানাঙ্ক কেবল ডেলিভারির জানালাটুকুতেই। বাইরে গেলে
  // object টা থাকে (chat panel-এর "চ্যাট বন্ধ" বার্তার জন্য) কিন্তু
  // coordinate গুলো null — কারণ শেষ হয়ে যাওয়া ডেলিভারির rider কোথায়
  // আছে, সেটা আর tracking নয়।
  const showRiderLocation = canSeeRiderLocation(order);

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
            // ⚠️ `...order` spread নয়, প্রতিটা field হাতে লেখা।
            //
            // client component-এ যা পাঠানো হয় তা RSC payload-এ চলে
            // যায়, অর্থাৎ browser-এ পড়া যায়। spread করলে উপরের
            // select-এ যোগ হওয়া যেকোনো নতুন field নীরবে সেখানে পৌঁছে
            // যেতো — `userId` সহ, যেটা কেবল resolveOrderAccess-এর
            // জন্য পড়া হয়েছে, দেখানোর জন্য নয়।
            id: order.id,
            status: order.status,
            firstName: order.firstName,
            city: order.city,
            orderType: order.orderType,
            shippingMethod: order.shippingMethod,
            table: order.table,
            currency: order.currency,
            taxName: order.taxName,
            taxMode: order.taxMode,
            pointsRedeemed: order.pointsRedeemed,

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
                  riderLat: showRiderLocation ? order.deliveryTracking.riderLat : null,
                  riderLng: showRiderLocation ? order.deliveryTracking.riderLng : null,
                  destLat: showRiderLocation ? order.deliveryTracking.destLat : null,
                  destLng: showRiderLocation ? order.deliveryTracking.destLng : null,
                  riderLocationUpdatedAt: showRiderLocation
                    ? order.deliveryTracking.riderLocationUpdatedAt.toISOString()
                    : null,
                  deliveredAt: order.deliveryTracking.deliveredAt?.toISOString() ?? null,
                }
              : null,
          }}
        />
      </div>
    </Container>
  );
}
