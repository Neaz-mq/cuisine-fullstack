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
import { calculatePointsEarned } from "@/lib/loyalty-tiers";

// $10 খরচে ১ point, নিচের দিকে rounded। আগে PATCH /api/orders/[id]-এর
// ভেতরে inline ছিল — সেই history-র সাথে সঙ্গতি রেখে আলাদাভাবে বদলাবেন না।
const POINTS_PER_CURRENCY_UNIT = 10;

type DeliverResult =
  | { ok: true; order: { id: string; status: string }; pointsAwarded: number }
  | {
      ok: false;
      error:
        | "Order not found"
        | "Cannot deliver a cancelled order"
        | "This order cannot be marked delivered from its current status";
    };

export async function markOrderDelivered(orderId: string): Promise<DeliverResult> {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
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

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: "DELIVERED" },
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
        totalAmount: true,
        user: { select: { loyaltyPoints: true } },
      },
    });

    // totalAmount coupon আর gift card বাদ দেওয়ার পরের অঙ্ক — অর্থাৎ
    // customer আসলে যত টাকা দিয়েছে। পুরো bill gift card-এ দিলে
    // totalAmount 0, তাই point-ও 0। "যত টাকা দিয়েছে তত point" চাইলে
    // এটাই সঠিক; "যত টাকার খাবার নিয়েছে তত point" চাইলে
    // discountAmount + giftCardAmount + totalAmount যোগ করতে হবে —
    // ব্যবসায়িক সিদ্ধান্ত, দুটোই যুক্তিসঙ্গত।
    const basePoints = Math.floor(claimed.totalAmount / POINTS_PER_CURRENCY_UNIT);

    // Loyalty tier bonus — Silver/Gold/Platinum customers earn a
    // multiplier on top of the base rate. Tier is derived from the
    // balance BEFORE this order's points land, so a big order can't
    // "bootstrap" itself into a bonus it applies to itself.
    const pointsEarned = calculatePointsEarned(basePoints, claimed.user?.loyaltyPoints ?? 0);

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
  });

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