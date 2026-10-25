import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { assignRiderSchema } from "@/lib/validations/delivery";
import { geocodeAddressDetailed, type GeocodeFailure } from "@/lib/geocode";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { canAssignRider } from "@/lib/order-state-machine";
import { sendOrderStatusEmail } from "@/lib/send-order-status-email";
import { isRecordNotFound } from "@/lib/prisma-errors";

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
 * ১. READY বাধ্যতামূলক — rider বসানো যায় কেবল রান্নাঘর অর্ডারটা "Ready"
 *    করার পরে (বা rider বদলের সময় OUT_FOR_DELIVERY-তে)। আগে PLACED থেকে
 *    সরাসরি OUT_FOR_DELIVERY লেখা হতো, ফলে inventory deduction (PREPARING-এর
 *    transition) এড়িয়ে যেত, আর রান্না শেষ হওয়ার আগেই গ্রাহকের পাতায় খাবার
 *    "পথে" দেখাত। এখন stock কাটে "Move to Kitchen"-এ, আর এই route শুধু READY
 *    অর্ডারকে rider-সহ OUT_FOR_DELIVERY-তে নেয়।
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
  // কেবল "orders" scope — rider বসানো হয় শুধু Orders list-এর "Ready to
  // Delivery" modal থেকে। Kitchen board এখন কেবল অর্ডারকে READY করে, rider
  // বসায় না।
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
      // checkout-এ মাপা স্থানাঙ্ক — নিচে দ্বিতীয় geocode এড়াতে।
      deliveryLat: true,
      deliveryLng: true,
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

  /**
   * ⚠️ রান্নাঘর "Ready" না করা পর্যন্ত rider বসানো যায় না।
   *
   * আগে PLACED/PREPARING অর্ডারেও rider বসানো যেত — PLACED হলে route নিজেই
   * অর্ডারটাকে আগে PREPARING-এ নিয়ে stock কাটত, আর তারপর সরাসরি "পথে"
   * পাঠিয়ে দিত; অর্থাৎ রান্না শেষ হওয়ার আগেই গ্রাহক দেখত খাবার রওনা দিয়েছে।
   * এখন বৈধ পথ একটাই: PLACED → PREPARING → READY → (rider) OUT_FOR_DELIVERY।
   * OUT_FOR_DELIVERY-তে আবার ডাকা মানে rider বদল (reassign), সেটা অনুমোদিত।
   */
  if (!canAssignRider(order.status)) {
    if (order.status === "PLACED" || order.status === "PREPARING") {
      return NextResponse.json(
        {
          error:
            "The kitchen hasn't marked this order Ready yet. You can assign a rider once it is Ready.",
        },
        { status: 409 }
      );
    }
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

  /**
   * ⚠️ checkout-এ ঠিকানাটা ইতিমধ্যেই geocode হয়ে Order-এ বসে থাকলে
   * সেটাই ব্যবহার হয় — এক অর্ডারে দুবার Nominatim ডাকার কারণ নেই।
   *
   * দুটো লাভ, আর দ্বিতীয়টাই বড়:
   *
   *   ১. dispatch তাৎক্ষণিক হয়, কয়েক সেকেন্ড অপেক্ষা নয়।
   *      lib/geocode.ts ব্যর্থ হলে ৯ ধাপ পর্যন্ত fallback করে, মাঝে
   *      ১.১s করে ঘুম — কঠিন ঠিকানায় সেটা প্রায় ৯ সেকেন্ড।
   *   ২. এই call-টাই মাঝেমধ্যে ব্যর্থ হয়ে rider পাঠানো আটকে দিত,
   *      অথচ ঠিকানাটা checkout-এ ঠিকই খুঁজে পাওয়া গিয়েছিল। একই
   *      অর্ডারে দুটো আলাদা ফল আসার সুযোগটাই এখন বন্ধ।
   *
   * ⚠️ null হলে আগের মতোই geocode — FLAT mode-এ চলা দোকান আর এই
   * feature-এর আগের অর্ডারগুলোতে ওই column খালি, তাই fallback-টা
   * থাকতেই হবে।
   */
  // ⚠️ The map point is a nice-to-have, not a requirement. A rider can
  // always deliver to the written address (and their Navigate button falls
  // back to it). Before, any map-service hiccup — rate limit, outage, a
  // village the map doesn't know — blocked dispatch entirely, and the food
  // sat waiting. Now the rider is assigned either way; staff just see a
  // note that the live map won't show the customer's pin.
  let geocoded: { lat: number; lng: number } | null = null;
  let mapWarning: string | null = null;
  if (order.deliveryLat !== null && order.deliveryLng !== null) {
    geocoded = { lat: order.deliveryLat, lng: order.deliveryLng };
  } else {
    const outcome = await geocodeAddressDetailed(order);
    if (outcome.ok) {
      geocoded = outcome.result;
    } else {
      mapWarning = geocodeErrorMessage(outcome.failure);
    }
  }

  // ⚠️ `status: order.status` update-এর where-এ — উপরের যাচাইয়ের পর অর্ডারটা
  // এই মুহূর্তে cancel/deliver হয়ে গেলে সেটাকে আবার "পথে" তুলে আনা চলবে না।
  // $transaction একসাথে ফেরে, তাই এই ক্ষেত্রে DeliveryTracking-ও লেখা হয় না।
  let updatedOrder;
  try {
    [, updatedOrder] = await prisma.$transaction([
      prisma.deliveryTracking.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          riderId,
          riderLat: RESTAURANT_LOCATION.lat,
          riderLng: RESTAURANT_LOCATION.lng,
          destLat: geocoded?.lat ?? null,
          destLng: geocoded?.lng ?? null,
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
          destLat: geocoded?.lat ?? null,
          destLng: geocoded?.lng ?? null,
          deliveredAt: null,
        },
      }),
      prisma.order.update({
        where: { id, status: order.status },
        data: {
          status: "OUT_FOR_DELIVERY",
          shippingMethod: "OWN_DELIVERY",
          // tracking পাতার timeline-এ "Out for Delivery · 12:00"।
          dispatchedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json(
        { error: "This order was just changed by someone else. Please refresh and try again." },
        { status: 409 }
      );
    }
    throw error;
  }

  // "Your order is on its way" — after the response (Order Updates switch).
  after(() => sendOrderStatusEmail(id, "OUT_FOR_DELIVERY"));

  return NextResponse.json({ ...updatedOrder, mapWarning });
}

/**
 * Tells staff WHICH problem it is. Before, all three read "Could not
 * locate this address", so a throttled map service looked like a typo in
 * the customer's address and staff went looking for a mistake that
 * wasn't there.
 */
function geocodeErrorMessage(failure: GeocodeFailure): string {
  const tail =
    " The rider was assigned anyway and can navigate by the written address.";
  if (failure.reason === "not_found") {
    return "This address couldn't be found on the map." + tail;
  }
  if (failure.reason === "refused") {
    return `The map service was busy (error ${failure.status}), so the customer's pin isn't on the live map.` + tail;
  }
  return "The map service couldn't be reached, so the customer's pin isn't on the live map." + tail;
}
