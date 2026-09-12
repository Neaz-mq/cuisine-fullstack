import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScopeAny } from "@/lib/require-admin";
import { orderStatusUpdateSchema } from "@/lib/validations/order";
import { parseBody } from "@/lib/validations/parse";
import { markOrderDelivered } from "@/lib/mark-order-delivered";
import { advanceOrderToPreparing } from "@/lib/advance-order-to-preparing";
import { cancelOrder } from "@/lib/cancel-order";
import { transitionError } from "@/lib/order-state-machine";
import { resolveOrderAccess } from "@/lib/order-access";
import { findOrderForTracking, serializeTrackedOrder } from "@/lib/track-order";

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
 * Field নির্বাচন সংকীর্ণ — phone আর email কখনোই যায় না। deliveryTracking-এ
 * rider-এর id/নাম/ফোনও কখনো select হয় না, শুধু map-এর স্থানাঙ্ক আর timestamp।
 *
 * ⚠️ ঠিকানা (`address`) এখন যায়। /track পাতা সেটা আগে থেকেই server-render
 * করে একই দর্শককে দেখাত (Figma-র "Address" ঘর), শুধু এই endpoint পাঠাত
 * না — ফলে প্রথম poll-এর পর ঘরটা বদলে যেত। একই access নিয়মে একই দর্শক,
 * তাই দুই পথে দুই রকম উত্তর দেওয়ার কোনো নিরাপত্তা-লাভ ছিল না।
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ⚠️ select আর serialize দুটোই lib/track-order.ts থেকে — /track পাতাও
  // হুবহু একই দুটো ব্যবহার করে। আগে এখানে আলাদা হাতে-লেখা map ছিল, যেটা
  // পাতার থেকে সরে গিয়েছিল (preparingAt/dispatchedAt/deliveredAt/address
  // পাঠাত না), ফলে প্রথম poll-এর পরেই timeline-এর সময়গুলো মুছে যেত।
  const order = await findOrderForTracking(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const access = await resolveOrderAccess(order);
  if (!access) {
    // ইচ্ছাকৃতভাবে 404, 403 নয়। 403 নিশ্চিত করে দিত যে এই id-তে একটা
    // order আছে — সেটাই enumeration oracle।
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(await serializeTrackedOrder(order));
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
    select: { id: true, status: true, dispatchedAt: true },
  });
  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const invalid = transitionError(existingOrder.status, status);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 409 });
  }

  /**
   * ⚠️ `dispatchedAt` এখানেও বসে, শুধু assign-rider route-এ নয়।
   *
   * আগে কেবল ওই route-টা সময়টা লিখত। কিন্তু dine-in-এর "Mark Ready",
   * kitchen board আর admin dropdown — সবগুলোই এই সাধারণ path দিয়ে
   * OUT_FOR_DELIVERY-তে নেয়, আর তখন কলামটা null থেকে যেত। ফল: /track
   * পাতার timeline-এ "Out for Delivery" ধাপটা সবুজ হতো ঠিকই, কিন্তু
   * তার নিচে সময়টা থাকত না।
   *
   * ⚠️ শুধু তখনই লেখা হয় যখন আগে থেকে নেই — নাহলে rider বসানোর পর কেউ
   * status আবার সেট করলে আসল বেরোনোর সময়টা মুছে গিয়ে এখনকার সময়
   * বসত, আর ETA-র হিসাবও (পথে কত সময় পেরিয়েছে) ভুল হয়ে যেত।
   */
  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === "OUT_FOR_DELIVERY" && existingOrder.dispatchedAt === null
        ? { dispatchedAt: new Date() }
        : {}),
    },
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