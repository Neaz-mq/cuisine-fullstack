/**
 * src/lib/mark-order-delivered.ts
 *
 * Order-কে DELIVERED করে এবং প্রথমবারের জন্য loyalty point দেয়।
 *
 * দুটো আলাদা জায়গা থেকে এটা ডাকা হয় — admin-এর status dropdown
 * (PATCH /api/orders/[id]) আর rider-এর নিজের dashboard
 * (POST /api/rider/deliveries/[orderId]/deliver)। এই file-টা তৈরিই
 * হয়েছিল দুই জায়গায় points-এর সূত্র আলাদা হয়ে যাওয়া ঠেকাতে — কিন্তু
 * ঠিক সেই দুই call site একসাথে চললে আরেকটা সমস্যা তৈরি হতো: আগে
 * pointsAwarded আলাদা query-তে পড়া হতো, তারপর আলাদা transaction-এ
 * লেখা হতো, তাই দুজনেই false দেখে দুবার point দিয়ে দিতে পারতো।
 *
 * এখন claim-টা updateMany-র affected-row count — যে call count 1 পায়
 * সেটাই একমাত্র point দেয়। consumeCoupon / redeemGiftCard /
 * advanceOrderToPreparing সবগুলোই এই একই pattern ব্যবহার করে।
 */
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/order-state-machine";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { calculatePointsEarned } from "@/lib/loyalty-tiers";
import { getActiveEarnRule, getLoyaltyTiers, pointsForSpend } from "@/lib/loyalty-config";

type DeliverResult =
  | { ok: true; order: { id: string; status: string }; pointsAwarded: number }
  | {
      ok: false;
      error:
        | "Order not found"
        | "Cannot deliver a cancelled order"
        | "This order cannot be marked delivered from its current status"
        | "This order hasn't been paid yet";
    };

export async function markOrderDelivered(orderId: string): Promise<DeliverResult> {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentMethod: true, paymentStatus: true },
  });

  if (!existingOrder) return { ok: false, error: "Order not found" };
  if (existingOrder.status === "CANCELLED") {
    return { ok: false, error: "Cannot deliver a cancelled order" };
  }

  // State machine-ই এখন একমাত্র জায়গা যেখানে লেখা আছে কোথা থেকে
  // DELIVERED-এ যাওয়া যায়। আগে এখানে শুধু CANCELLED আটকানো হতো, ফলে
  // একটা PLACED order সরাসরি DELIVERED হয়ে যেতে পারতো — মানে PREPARING
  // কখনো হয়নি, মানে সেই order-এর ingredient কখনো deduct হয়নি।
  if (!canTransition(existingOrder.status, "DELIVERED")) {
    return {
      ok: false,
      error: "This order cannot be marked delivered from its current status",
    };
  }

  /**
   * ── নগদ টাকা হাতে আসার মুহূর্ত ──────────────────────────────────────
   *
   * COD অর্ডারে টাকাটা ঠিক এখানেই হাতবদল হয়: rider দরজায় টাকা নেন, বা
   * dine-in-এ গ্রাহক টেবিলে দিয়ে যান। তাই DELIVERED হওয়ার সাথে সাথেই
   * `paymentStatus` PAID, একই transaction-এ।
   *
   * ⚠️ আগে এটা কোথাও হতো না — schema-র মন্তব্যেই স্বীকার করা ছিল "no
   * mark paid on delivery/at table admin action exists yet"। ফলে নগদে
   * নেওয়া প্রতিটা টাকা চিরকাল PENDING থেকে যেত, আর /admin/payment-এর
   * "Total Revenue" কেবল কার্ডের অর্ডার গুনত। অর্ধেক ব্যবসা হিসাবের
   * বাইরে থাকা মানে সংখ্যাটা ভুল, আর সেই সংখ্যা দেখেই সিদ্ধান্ত হয়।
   *
   * ⚠️ শর্ত দুটো, আর দুটোই দরকার:
   *
   *   `paymentMethod === "COD"` — ONLINE অর্ডারের টাকা Stripe webhook
   *   বসায়। ডেলিভারির সময় সেটাকে PAID বলা মানে টাকা আসার প্রমাণ ছাড়াই
   *   দাবি করা; কার্ড আটকে গেলেও অর্ডারটা "পরিশোধিত" হয়ে যেত।
   *
   *   `paymentStatus === "PENDING"` — নাহলে ফেরত দেওয়া অর্ডার (REFUNDED
   *   বা PARTIALLY_REFUNDED) কোনোভাবে আবার DELIVERED চিহ্নিত হলে
   *   ফেরতের হিসাবটাই মুছে গিয়ে PAID বসত।
   */
  // Same rule as advanceOrderToPreparing(): an unpaid ONLINE order must not
  // be handed over, and must not earn loyalty points.
  if (
    existingOrder.paymentMethod === "ONLINE" &&
    (existingOrder.paymentStatus === "PENDING" || existingOrder.paymentStatus === "FAILED")
  ) {
    return { ok: false, error: "This order hasn't been paid yet" };
  }

  const settlesCash =
    existingOrder.paymentMethod === "COD" && existingOrder.paymentStatus === "PENDING";

  // কত খরচে কত point (admin → Loyalty → Target Point, যেটা "Applied") আর
  // tier-এর bonus — transaction-এর বাইরে পড়া, কারণ এগুলো এই order-এর
  // উপর নির্ভর করে না। কোনো নিয়ম active না থাকলে point দেওয়া হয় না।
  const [earnRule, tiers] = await Promise.all([getActiveEarnRule(), getLoyaltyTiers()]);

  const result = await prisma.$transaction(async (tx) => {
    // status in WHERE = atomic claim (see cancelOrder in cancel-order.ts).
    // Without it a cancel and a "delivered" at the same moment could both
    // succeed — the order ends up DELIVERED after its stock and gift card
    // were already given back.
    const order = await tx.order.update({
      where: { id: orderId, status: existingOrder.status },
      /**
       * ⚠️ `DeliveryTracking.deliveredAt`-এর নকল নয়। ওটা কেবল
       * OWN_DELIVERY অর্ডারে থাকে (rider assign হলে তবেই row তৈরি হয়),
       * আর dine-in বা Uber Eats অর্ডারে কিছুই থাকে না। timeline-টা
       * প্রতিটা অর্ডারে দেখাতে হয়, তাই Order-এর নিজের কলাম।
       */
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        ...(settlesCash ? { paymentStatus: "PAID" as const } : {}),
      },
      select: { id: true, status: true },
    });

    // Point দেওয়ার একমাত্র আসল guard। guest checkout (userId null) হলে
    // where clause মেলে না, তাই count 0 আসে এবং point দেওয়া হয় না —
    // আলাদা করে userId চেক করার দরকার নেই।
    const claim = await tx.order.updateMany({
      where: { id: orderId, pointsAwarded: false, userId: { not: null } },
      data: { pointsAwarded: true },
    });

    if (claim.count !== 1) {
      return { order, pointsAwarded: 0 };
    }

    // Claim জেতার পরেই totalAmount আর userId পড়া হচ্ছে — এই মুহূর্তে
    // নিশ্চিত যে অন্য কোনো call একই order-এ point দিচ্ছে না। user-এর
    // বর্তমান loyaltyPoints-ও এখানেই পড়া হয় — এটাই সেই balance যেটা
    // দিয়ে tier bonus multiplier ঠিক হবে (এই order যত point-ই দিক না
    // কেন, তার আগের tier অনুযায়ী)।
    const claimed = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        userId: true,
        subtotal: true,
        totalAmount: true,
        user: { select: { loyaltyPoints: true } },
      },
    });

    // ⚠️ ভিত্তি এখন subtotal, আগের totalAmount নয়।
    //
    // Money model আসার পর totalAmount-এ কর, service charge, delivery fee
    // আর বকশিশও ঢুকেছে। ওটার উপর point দিলে গ্রাহক সরকারের কর আর
    // rider-এর বকশিশের উপরেও loyalty point পেতেন — অর্থাৎ VAT ১৫% এমন
    // দেশে ঠিক ততটাই বেশি, নিছক ভূগোলের কারণে।
    //
    // subtotal হলো খাবারের দাম, ছাড়ের আগে। ফলে point দেওয়া হয় "কত
    // টাকার খাবার নিলেন" অনুযায়ী, "শেষে কত টাকা হাতবদল হলো" অনুযায়ী নয়।
    // পুরো bill gift card-এ মিটলেও গ্রাহক এখন point পাবেন — যা আগের
    // আচরণ থেকে ইচ্ছাকৃত পরিবর্তন, এবং প্রায় সব loyalty program এভাবেই
    // কাজ করে (gift card পরিশোধের মাধ্যম, ছাড় নয়)।
    const basePoints = pointsForSpend(claimed.subtotal, earnRule);

    // Loyalty tier bonus — Silver/Gold/Platinum customers earn a
    // multiplier on top of the base rate. Tier is derived from the
    // balance BEFORE this order's points land, so a big order can't
    // "bootstrap" itself into a bonus it applies to itself.
    const pointsEarned = calculatePointsEarned(basePoints, claimed.user?.loyaltyPoints ?? 0, tiers);

    if (pointsEarned > 0 && claimed.userId) {
      await tx.user.update({
        where: { id: claimed.userId },
        data: { loyaltyPoints: { increment: pointsEarned } },
      });

      await tx.loyaltyTransaction.create({
        data: {
          points: pointsEarned,
          reason: "ORDER_DELIVERED",
          userId: claimed.userId,
          orderId,
        },
      });
    }
    // pointsEarned 0 হলেও (যেমন $10-এর কম order) claim ধরে রাখা হচ্ছে
    // ইচ্ছাকৃতভাবে: "এই order-এর point-হিসাব সম্পন্ন" বোঝাতে, যাতে পরে
    // কেউ আবার চেষ্টা না করে।

    return { order, pointsAwarded: pointsEarned };
  }).catch((error: unknown) => {
    if (isRecordNotFound(error)) return null;
    throw error;
  });

  if (!result) {
    // Another request moved or cancelled the order between our read and write.
    return {
      ok: false,
      error: "This order cannot be marked delivered from its current status",
    };
  }

  // DeliveryTracking বন্ধ করা transaction-এর বাইরে, কারণ এটা নিছক
  // housekeeping — rider dashboard আর customer-এর live map জানবে delivery
  // শেষ, position polling থামাবে। এটা ব্যর্থ হলে order DELIVERED হওয়া বা
  // point দেওয়া rollback হওয়ার কোনো কারণ নেই; টাকা-সংক্রান্ত কাজ শেষ
  // হয়ে যাওয়ার পর কোনো side effect যেন পুরোটা ফিরিয়ে না দেয়।
  //
  // updateMany ব্যবহার করা হচ্ছে, update নয় — Uber Eats/Food Panda
  // order-এ কোনো DeliveryTracking row থাকে না, সেখানে update() throw
  // করতো, updateMany শূন্য row মিলিয়ে চুপচাপ ফিরে আসে।
  try {
    await prisma.deliveryTracking.updateMany({
      where: { orderId },
      data: { deliveredAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to close delivery tracking for order", orderId, error);
  }

  return { ok: true, order: result.order, pointsAwarded: result.pointsAwarded };
}