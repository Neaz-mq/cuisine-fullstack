import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { assignRiderSchema } from "@/lib/validations/delivery";
import { geocodeAddress } from "@/lib/geocode";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { advanceOrderToPreparing } from "@/lib/advance-order-to-preparing";
import { canTransition, needsPreparingFirst } from "@/lib/order-state-machine";

/**
 * POST /api/admin/orders/[id]/assign-rider
 *
 * Role.DELIVERY staff member-কে একটা DELIVERY order-এ assign (বা
 * reassign) করে, order-এর address একবার geocode করে, DeliveryTracking
 * row তৈরি/আপডেট করে, আর order-কে OUT_FOR_DELIVERY-তে নিয়ে যায়। এরপর:
 *   - rider এই order-টা /admin/my-deliveries-এ দেখে এবং নিজের live
 *     position পাঠাতে শুরু করে (POST .../location)
 *   - customer-এর /track/[orderId] পেজে live map দেখা যায়
 *
 * Reassignment (একই order-এ ভিন্ন riderId দিয়ে আবার ডাকা) ইচ্ছাকৃতভাবে
 * অনুমোদিত — যেমন আগের rider অসুস্থ হয়ে পড়লে — এবং error না দিয়ে
 * বিদ্যমান DeliveryTracking row-টাই overwrite করে।
 *
 * দুটো জিনিস এখানে যোগ হয়েছে, দুটোই আসল bug ছিল:
 *
 * ১. PREPARING বাধ্যতামূলক — আগে PLACED থেকে সরাসরি OUT_FOR_DELIVERY
 *    লেখা হতো, অর্থাৎ PREPARING কখনো হতো না। আর inventory deduction
 *    ঘটে ঠিক সেই transition-এ। ফলে এভাবে পাঠানো প্রতিটা order-এর
 *    ingredient বাস্তবে খরচ হতো কিন্তু StockMovement-এ কিছুই লেখা হতো
 *    না — currentStock নীরবে বাস্তবতা থেকে সরে যেতো, low-stock alert
 *    বন্ধ হয়ে যেতো, আর Phase 2-এর purchase suggestion ভুল data-র উপর
 *    দাঁড়াতো। ব্যস্ত manager-এর জন্য orders list থেকে সরাসরি rider
 *    assign করাই সবচেয়ে স্বাভাবিক পথ, তাই এটা বিরল edge case ছিল না।
 *
 * ২. Payment যাচাই — একটা ONLINE order যার paymentStatus এখনো PENDING
 *    (customer Stripe পেজ খুলে টাকা দেয়নি), সেটাও assign করা যেত।
 *    staff-এর কাছে সেটা paid order-এর মতোই দেখাতো, আর খাবার বেরিয়ে
 *    যেত। Stripe session ~২৪ ঘণ্টা বাঁচে, তাই জানালাটা ছোট নয়।
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("orders");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, assignRiderSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { riderId } = parsed;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      orderType: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      address: true,
      apartment: true,
      city: true,
      state: true,
      zip: true,
      country: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.orderType !== "DELIVERY") {
    return NextResponse.json(
      { error: "Only delivery orders can be assigned a rider" },
      { status: 400 }
    );
  }

  // State machine-ই এখন একমাত্র জায়গা যেখানে লেখা আছে কোথা থেকে
  // OUT_FOR_DELIVERY-তে যাওয়া যায়। আগে এখানে হাতে লেখা
  // `status === "DELIVERED" || status === "CANCELLED"` চেক ছিল — সেটা
  // terminal state আটকাতো ঠিকই, কিন্তু PLACED-এর লাফটা ধরতে পারতো না,
  // কারণ সেটা "অবৈধ" বলে চিহ্নিতই ছিল না কোথাও।
  if (!canTransition(order.status, "OUT_FOR_DELIVERY")) {
    return NextResponse.json(
      {
        error: `Cannot assign a rider — order is already ${order.status
          .toLowerCase()
          .replace(/_/g, " ")}`,
      },
      { status: 409 }
    );
  }

  // ONLINE order-এ টাকা নিশ্চিত না হওয়া পর্যন্ত খাবার পাঠানো যাবে না।
  // COD (এবং DINE_IN, যেটা সবসময় COD) এই চেকের বাইরে — সেখানে টাকা
  // delivery-র সময়ই নেওয়া হয়, তাই PENDING থাকাটাই স্বাভাবিক অবস্থা।
  if (order.paymentMethod === "ONLINE" && order.paymentStatus !== "PAID") {
    return NextResponse.json(
      {
        error:
          "This order hasn't been paid yet — payment is still pending with Stripe. Wait for confirmation before dispatching.",
      },
      { status: 409 }
    );
  }

  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    select: { role: true, staffProfile: { select: { isActive: true } } },
  });
  if (!rider || rider.role !== "DELIVERY") {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }
  if (rider.staffProfile?.isActive === false) {
    return NextResponse.json({ error: "This rider account is deactivated" }, { status: 400 });
  }

  const geocoded = await geocodeAddress(order);
  if (!geocoded) {
    return NextResponse.json(
      { error: "Could not locate this address on the map — check it and try again" },
      { status: 422 }
    );
  }

  // PLACED হলে আগে PREPARING-এ নিয়ে যাওয়া, যাতে inventory deduct হয়।
  // এটা নিজের transaction-এ চলে (advanceOrderToPreparing-এর ভেতরে),
  // নিচের assignment transaction-এর আগে — deduction ব্যর্থ হলে rider
  // assign-ই হবে না, বরং অর্ধেক-সম্পন্ন অবস্থা তৈরি হবে না।
  //
  // geocode-এর পরে রাখা হয়েছে ইচ্ছাকৃতভাবে: ঠিকানা geocode না হলে
  // assignment এমনিতেই ব্যর্থ, তাই তার আগে stock deduct করে ফেলার কোনো
  // মানে নেই।
  if (needsPreparingFirst(order.status)) {
    const prepared = await advanceOrderToPreparing(id);
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: 409 });
    }
  }

  const [, updatedOrder] = await prisma.$transaction([
    prisma.deliveryTracking.upsert({
      where: { orderId: id },
      create: {
        orderId: id,
        riderId,
        riderLat: RESTAURANT_LOCATION.lat,
        riderLng: RESTAURANT_LOCATION.lng,
        destLat: geocoded.lat,
        destLng: geocoded.lng,
      },
      update: {
        riderId,
        // Reassignment-এ rider position আবার restaurant-এ reset — নতুন
        // rider এখনো কোনো real position পাঠায়নি, আর আগের rider-এর শেষ
        // অবস্থান (বা customer-এর নিজের ঠিকানা) রেখে দিলে সেটা
        // বিভ্রান্তিকর হতো। Delivery সবসময় restaurant থেকেই শুরু হয়,
        // destination থেকে নয়।
        riderLat: RESTAURANT_LOCATION.lat,
        riderLng: RESTAURANT_LOCATION.lng,
        riderLocationUpdatedAt: new Date(),
        destLat: geocoded.lat,
        destLng: geocoded.lng,
        deliveredAt: null,
      },
    }),
    prisma.order.update({
      where: { id },
      data: {
        status: "OUT_FOR_DELIVERY",
        shippingMethod: "OWN_DELIVERY",
      },
    }),
  ]);

  return NextResponse.json(updatedOrder);
}