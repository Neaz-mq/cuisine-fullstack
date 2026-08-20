import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScopeAny } from "@/lib/require-admin";
import { orderStatusUpdateSchema } from "@/lib/validations/order";
import { parseBody } from "@/lib/validations/parse";
import { markOrderDelivered } from "@/lib/mark-order-delivered";
import { advanceOrderToPreparing } from "@/lib/advance-order-to-preparing";
import { cancelOrder } from "@/lib/cancel-order";
import { transitionError } from "@/lib/order-state-machine";
import { resolveOrderAccess, canSeeRiderLocation } from "@/lib/order-access";

/**
 * GET /api/orders/[id] — /track/[orderId] পাতার poll endpoint.
 *
 * ⚠️ এখানে আগে কোনো auth ছিলই না। PATCH-এ requireApiScopeAny বসানো
 * ছিল, GET-এ কিছুই না — অর্থাৎ id জানলেই যে কেউ গ্রাহকের নাম, শহর,
 * পুরো চালান আর rider-এর live GPS পড়তে পারতো।
 *
 * এখন প্রতিটা request lib/order-access.ts-এর মধ্য দিয়ে যায়। নিয়মগুলো
 * ওই file-এ বিস্তারিত; সংক্ষেপে: guest order-এ id-ই টিকিট, কিন্তু
 * order-এর একজন মালিক থাকলে তাকে (বা staff-কে) log in করতে হবে।
 *
 * Field নির্বাচন আগের মতোই সংকীর্ণ — phone, পুরো ঠিকানা, email কখনোই
 * যায় না। deliveryTracking-এ rider-এর id/নাম/ফোনও কখনো select হয় না,
 * শুধু map-এর জন্য দরকারি স্থানাঙ্ক আর timestamp।
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
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

      // Access সিদ্ধান্তের জন্য — client-এ কখনো পাঠানো হয় না, নিচে
      // response বানানোর সময় ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে।
      userId: true,

      // পূর্ণ চালান — /track পাতা প্রতি ১৫ সেকেন্ডে এটা poll করে, তাই
      // এখানকার আকৃতি server-render করা প্রথম আকৃতির সাথে হুবহু মিলতে
      // হবে; নইলে প্রথম poll-এর পরেই বিলের লাইনগুলো উধাও হয়ে যেতো।
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
      currency: true,
      currencyMinorUnits: true,
      giftCardAmount: true,
      pointsRedeemed: true,
      pointsRedeemedAmount: true,

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
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const access = await resolveOrderAccess(order);
  if (!access) {
    // ইচ্ছাকৃতভাবে 404, 403 নয়। 403 নিশ্চিত করে দিত যে এই id-তে একটা
    // order আছে — সেটাই enumeration oracle।
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Order-এর নিজের currency থেকে দশমিক, আজকের settings থেকে নয়।
  const units = order.currencyMinorUnits;
  const money = (value: { toFixed(dp: number): string }) => value.toFixed(units);

  // ⚠️ `...order` spread করা হয় না ইচ্ছাকৃতভাবে।
  //
  // এটা একটা security boundary — কী কী বাইরে যাচ্ছে সেটা এখানে হাতে
  // লেখা থাকলে ভবিষ্যতে কেউ উপরের select-এ একটা field যোগ করলে (ধরা
  // যাক phone, বা access check-এর জন্য আরেকটা internal column) সেটা
  // নিজে থেকে response-এ ঢুকে পড়বে না। spread হলে ঢুকতো, আর কেউ
  // টেরও পেতো না।
  //
  // এ কারণেই `userId`-ও এখানে নেই: ওটা কেবল resolveOrderAccess-এর
  // জন্য select করা হয়েছিল, দেখানোর জন্য নয়।
  return NextResponse.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    firstName: order.firstName,
    city: order.city,
    orderType: order.orderType,
    shippingMethod: order.shippingMethod,
    table: order.table,

    currency: order.currency,
    taxName: order.taxName,
    taxMode: order.taxMode,
    pointsRedeemed: order.pointsRedeemed,

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
    // লাইন-মোট, একক দাম নয় — /track পাতার server-render করা আকৃতির সাথে
    // হুবহু মিলতে হবে, নইলে প্রথম poll-এর পরেই অঙ্কগুলো বদলে যেতো।
    items: order.items.map((item) => ({
      ...item,
      price: money(item.price.times(item.quantity)),
    })),
    deliveryTracking: serializeTracking(order),
  });
}

/**
 * deliveryTracking → client-এর আকৃতি, স্থানাঙ্ক gate করে।
 *
 * Object টা রাখা হয় (null করা হয় না) কারণ /track পাতার chat panel
 * deliveredAt দেখে "এই ডেলিভারি শেষ — চ্যাট বন্ধ" বার্তাটা দেখায়।
 * কিন্তু delivery-র জানালা পেরিয়ে গেলে rider-এর স্থানাঙ্ক null হয়ে
 * যায় — কারণ তখন ওটা আর order tracking নয়।
 */
function serializeTracking(order: {
  status: string;
  deliveryTracking: {
    riderLat: number;
    riderLng: number;
    riderLocationUpdatedAt: Date;
    destLat: number;
    destLng: number;
    deliveredAt: Date | null;
  } | null;
}) {
  const tracking = order.deliveryTracking;
  if (!tracking) return null;

  const live = canSeeRiderLocation(order);

  return {
    riderLat: live ? tracking.riderLat : null,
    riderLng: live ? tracking.riderLng : null,
    riderLocationUpdatedAt: live ? tracking.riderLocationUpdatedAt.toISOString() : null,
    destLat: live ? tracking.destLat : null,
    destLng: live ? tracking.destLng : null,
    deliveredAt: tracking.deliveredAt?.toISOString() ?? null,
  };
}

/**
 * PATCH — admin/kitchen status dropdown.
 *
 * প্রতিটা status-এর নিজস্ব helper আছে, কারণ status বদলানো মানে শুধু একটা
 * column লেখা নয় — সাথে stock, loyalty point, gift card balance-এর
 * হিসাবও বদলায়, আর সেগুলো একই transaction-এ হতে হবে:
 *
 *   PREPARING  -> advanceOrderToPreparing  (recipe ingredient deduct)
 *   DELIVERED  -> markOrderDelivered       (loyalty point + tracking বন্ধ)
 *   CANCELLED  -> cancelOrder              (stock/coupon/gift card ফেরত)
 *
 * আগে CANCELLED-এর কোনো helper ছিল না — নিচের সাধারণ update-এ গিয়ে
 * স্রেফ status লেখা হতো। ফলে admin dropdown থেকে cancel করলে deduct হওয়া
 * ingredient ফেরত আসতো না, coupon-এর slot নষ্ট হতো, আর সবচেয়ে গুরুতর,
 * customer-এর gift card balance চিরতরে হারিয়ে যেতো।
 *
 * OUT_FOR_DELIVERY একমাত্র status যেটার কোনো side effect নেই, তাই সেটাই
 * শুধু নিচের সাধারণ update path ব্যবহার করে — এবং তার আগেও state machine
 * দিয়ে transition বৈধতা যাচাই হয়।
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScopeAny(["orders", "kitchen"]);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, orderStatusUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { status } = parsed;

  // DELIVERED goes through the shared helper (loyalty points + closing
  // out DeliveryTracking) — same code path a rider's own "Mark Delivered"
  // button uses, see POST /api/rider/deliveries/[orderId]/deliver.
  if (status === "DELIVERED") {
    const result = await markOrderDelivered(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
    }
    return NextResponse.json(result.order);
  }

  // PREPARING goes through its own shared helper — deducts recipe
  // ingredients (MenuItemIngredient) from InventoryItem.currentStock in
  // the same transaction as the status change. Orders with no
  // recipe-configured menu items just advance with nothing to deduct.
  if (status === "PREPARING") {
    const result = await advanceOrderToPreparing(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
    }
    return NextResponse.json(result.order);
  }

  // CANCELLED reverses everything the order had already claimed. Note this
  // is deliberately NOT a plain status write — see the doc comment above.
  if (status === "CANCELLED") {
    const result = await cancelOrder(id, "Cancelled by staff");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
    }
    return NextResponse.json(result.order);
  }

  // যা বাকি থাকে তা কেবল OUT_FOR_DELIVERY — কোনো ledger বা balance
  // এতে বদলায় না, তাই সাধারণ update-ই যথেষ্ট। তবু transition বৈধ কিনা
  // দেখা হয়, নাহলে একটা DELIVERED order আবার OUT_FOR_DELIVERY-তে
  // ফিরিয়ে আনা যেতো।
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const invalid = transitionError(existingOrder.status, status);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 409 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}

/**
 * Helper-দের error string থেকে HTTP status. "Order not found" ছাড়া বাকি
 * সবগুলোই এখন transition-সংক্রান্ত — অর্থাৎ request নিজে ঠিক আছে, কিন্তু
 * order-এর বর্তমান অবস্থার সাথে সংঘাত। সেটা 400 (malformed request) নয়,
 * 409 Conflict — client যাতে "আমি ভুল পাঠিয়েছি" আর "এটা এখন করা যাবে না"
 * আলাদা করতে পারে।
 */
function errorStatus(error: string): number {
  return error === "Order not found" ? 404 : 409;
}