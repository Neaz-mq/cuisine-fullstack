import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { canTransition } from "@/lib/order-state-machine";
import { reverseLoyaltyPointsRedemption } from "@/lib/loyalty-redemption";
import { type Money, ZERO } from "@/lib/money";

/**
 * src/lib/cancel-order.ts
 *
 * একটা order বাতিল করে এবং তার সাথে দাবি করা সব মূল্য এক transaction-এ
 * ফেরত দেয়:
 *
 *   - ORDER_DEDUCTION হয়ে থাকলে সমপরিমাণ RETURN movement লিখে stock ফেরত
 *   - Coupon.usageCount কমিয়ে CouponRedemption মুছে ফেলা
 *   - Gift card balance ফেরত + ধনাত্মক ADJUSTMENT ledger row
 *   - দেওয়া হয়ে থাকলে loyalty point ফেরত (ঋণাত্মক LoyaltyTransaction)
 *
 * এর আগে cancellation মানে ছিল স্রেফ `status: "CANCELLED"` লেখা। ফলে
 * abandoned Stripe checkout-এ customer-এর gift card balance চিরতরে
 * হারিয়ে যেতো — টাকাটা এমন একটা order-এ আটকে থাকতো যার জন্য কেউ কখনো
 * টাকা দেয়নি, আর ফেরত পাওয়ার কোনো পথ ছিল না। Coupon-এর ক্ষেত্রে ক্ষতি
 * ছোট (একটা slot নষ্ট), কিন্তু gift card একটা prepaid আর্থিক দলিল —
 * সম্পূর্ণ ভিন্ন ঝুঁকি।
 *
 * কেন প্রতিটা reversal ledger row লেখা হয়, শুধু balance বাড়িয়ে দেওয়া হয়
 * না: StockMovement / GiftCardTransaction / LoyaltyTransaction append-only
 * ledger — সেটাই "কী ঘটেছিল"-এর সত্য উৎস। পুরোনো row মুছে দিলে বা চুপচাপ
 * balance বদলালে হিসাব আর মেলানো যাবে না।
 *
 * ব্যতিক্রম CouponRedemption — সেটা ledger নয়, বরং "এই customer এই coupon
 * ব্যবহার করে ফেলেছে" বোঝায়। বাতিল order-এর redemption রেখে দিলে
 * perCustomerLimit ভুলভাবে customer-কে আটকে রাখতো, তাই ওটা মুছে ফেলা হয়।
 */

export interface ReversalSummary {
  stockReturned: boolean;
  couponReleased: boolean;
  /** Decimal — ফেরত দেওয়া টাকার অঙ্ক, তাই number নয়। */
  giftCardRefunded: Money;
  loyaltyPointsReversed: number;
  redeemedPointsRefunded: number;
}

type CancelResult =
  | { ok: true; order: { id: string; status: string }; reversed: ReversalSummary }
  | {
      ok: false;
      error:
        | "Order not found"
        | "Order is already cancelled"
        | "This order can no longer be cancelled";
    };

export async function cancelOrder(orderId: string, reason?: string): Promise<CancelResult> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      userId: true,
      couponCode: true,
      giftCardCode: true,
      giftCardAmount: true,
      pointsAwarded: true,
      pointsRedeemed: true,
    },
  });

  if (!existing) return { ok: false, error: "Order not found" };
  if (existing.status === "CANCELLED") return { ok: false, error: "Order is already cancelled" };

  // DELIVERED order বাতিল করা যায় না — খাবার চলে গেছে, ingredient সত্যিই
  // খরচ হয়েছে, তাই stock ফেরত দেওয়ার কোনো মানে নেই। টাকা ফেরত দিতে হলে
  // সেটা refund flow, cancellation নয়। state machine-ই এই নিয়মের
  // একমাত্র উৎস।
  if (!canTransition(existing.status, "CANCELLED")) {
    return { ok: false, error: "This order can no longer be cancelled" };
  }

  const summary: ReversalSummary = {
    stockReturned: false,
    couponReleased: false,
    giftCardRefunded: ZERO,
    loyaltyPointsReversed: 0,
    redeemedPointsRefunded: 0,
  };

  const order = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
        select: { id: true, status: true },
      });

      summary.stockReturned = await returnStock(tx, orderId, reason);
      summary.couponReleased = await releaseCoupon(tx, orderId, existing.couponCode);
      summary.giftCardRefunded = await refundGiftCard(
        tx,
        orderId,
        existing.giftCardCode,
        existing.giftCardAmount
      );
      summary.loyaltyPointsReversed = await reverseLoyaltyPoints(
        tx,
        orderId,
        existing.userId,
        existing.pointsAwarded
      );
      summary.redeemedPointsRefunded = await refundRedeemedPoints(
        tx,
        orderId,
        existing.userId,
        existing.pointsRedeemed
      );

      return updated;
    },
    // Default 5s যথেষ্ট নয়: ingredient প্রতি ২টা sequential query, আর
    // Supabase pooler-এ latency বেশি। একটা ১০-উপকরণের order মানে ২০টা
    // round trip, পুরোটা সময় row lock ধরে রেখে।
    { timeout: 15000 }
  );

  return { ok: true, order, reversed: summary };
}

/**
 * ORDER_DEDUCTION হয়ে থাকলে প্রতিটার বিপরীতে একটা RETURN movement লিখে
 * stock ফেরত দেয়। আগে থেকে RETURN থাকলে কিছুই করে না — দুবার cancel
 * করার চেষ্টায় stock দ্বিগুণ ফেরত আসা ঠেকাতে।
 *
 * Order.stockDeductedAt ইচ্ছাকৃতভাবে null-এ ফেরানো হয় না: RETURN
 * movement গুলোই বিপরীতমুখী হিসাব, আর claim-টা রেখে দিলে একই order
 * ভুলে আবার PREPARING করা হলেও দ্বিতীয়বার deduct হবে না।
 */
async function returnStock(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason?: string
): Promise<boolean> {
  const alreadyReturned = await tx.stockMovement.findFirst({
    where: { orderId, type: "RETURN" },
    select: { id: true },
  });
  if (alreadyReturned) return false;

  const deductions = await tx.stockMovement.findMany({
    where: { orderId, type: "ORDER_DEDUCTION" },
    select: { inventoryItemId: true, quantityChange: true },
  });
  if (deductions.length === 0) return false;

  // inventoryItemId দিয়ে sort — সব transaction একই ক্রমে row lock করলে
  // দুটো concurrent cancel (বা একটা cancel আর একটা PREPARING) deadlock
  // করবে না। advance-order-to-preparing.ts-ও একই ক্রম ব্যবহার করে।
  const sorted = [...deductions].sort((a, b) =>
    a.inventoryItemId.localeCompare(b.inventoryItemId)
  );

  for (const deduction of sorted) {
    // quantityChange ঋণাত্মক ছিল (deduction), তাই চিহ্ন উল্টে ধনাত্মক
    // করে ঠিক ততটাই ফেরত দেওয়া হচ্ছে।
    const returnQuantity = -deduction.quantityChange;

    const item = await tx.inventoryItem.update({
      where: { id: deduction.inventoryItemId },
      data: { currentStock: { increment: returnQuantity } },
    });

    await tx.stockMovement.create({
      data: {
        type: "RETURN",
        quantityChange: returnQuantity,
        resultingStock: item.currentStock,
        note: reason ? `Order cancelled: ${reason}` : "Order cancelled",
        inventoryItemId: deduction.inventoryItemId,
        orderId,
      },
    });
  }

  return true;
}

/**
 * usageCount কমিয়ে redemption row মুছে দেয়, যাতে customer কোডটা আবার
 * ব্যবহার করতে পারে। usageCount কখনো শূন্যের নিচে নামতে দেওয়া হয় না —
 * `gt: 0` guard সেটাই নিশ্চিত করে।
 */
async function releaseCoupon(
  tx: Prisma.TransactionClient,
  orderId: string,
  couponCode: string | null
): Promise<boolean> {
  if (!couponCode) return false;

  const redemption = await tx.couponRedemption.findUnique({
    where: { orderId },
    select: { id: true, couponId: true },
  });
  if (!redemption) return false;

  await tx.couponRedemption.delete({ where: { id: redemption.id } });

  await tx.coupon.updateMany({
    where: { id: redemption.couponId, usageCount: { gt: 0 } },
    data: { usageCount: { decrement: 1 } },
  });

  return true;
}

/**
 * Gift card balance ফেরত + ধনাত্মক ADJUSTMENT row. REDEEM row মুছে ফেলা
 * হয় না — ledger append-only, ফেরতটা নতুন entry হিসেবেই থাকে, যাতে
 * "কী ঘটেছিল" ইতিহাস অক্ষুণ্ণ থাকে।
 */
async function refundGiftCard(
  tx: Prisma.TransactionClient,
  orderId: string,
  giftCardCode: string | null,
  giftCardAmount: Money
): Promise<Money> {
  if (!giftCardCode || giftCardAmount.lessThanOrEqualTo(ZERO)) return ZERO;

  const alreadyRefunded = await tx.giftCardTransaction.findFirst({
    where: { orderId, type: "ADJUSTMENT", amount: { gt: 0 } },
    select: { id: true },
  });
  if (alreadyRefunded) return ZERO;

  const card = await tx.giftCard.findUnique({
    where: { code: giftCardCode },
    select: { id: true },
  });
  if (!card) return ZERO;

  await tx.giftCard.update({
    where: { id: card.id },
    data: { balance: { increment: giftCardAmount } },
  });

  await tx.giftCardTransaction.create({
    data: {
      giftCardId: card.id,
      orderId,
      amount: giftCardAmount,
      type: "ADJUSTMENT",
      note: "Order cancelled — redemption refunded",
    },
  });

  return giftCardAmount;
}

/**
 * DELIVERED হয়ে point পাওয়ার পর cancel হলে point ফিরিয়ে নেয়। state
 * machine এখন DELIVERED -> CANCELLED আটকায়, তাই বর্তমান নিয়মে এটা
 * চলবেই না — কিন্তু পুরোনো data-য় এমন order থাকতে পারে, আর নিয়ম
 * ভবিষ্যতে বদলালেও এই reversal-টা তখনই কাজে লাগবে।
 */
async function reverseLoyaltyPoints(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string | null,
  pointsAwarded: boolean
): Promise<number> {
  if (!pointsAwarded || !userId) return 0;

  const awarded = await tx.loyaltyTransaction.findFirst({
    where: { orderId, reason: "ORDER_DELIVERED", points: { gt: 0 } },
    select: { points: true },
  });
  if (!awarded) return 0;

  await tx.user.update({
    where: { id: userId },
    data: { loyaltyPoints: { decrement: awarded.points } },
  });

  await tx.loyaltyTransaction.create({
    data: {
      points: -awarded.points,
      reason: "MANUAL_ADJUSTMENT",
      note: "Order cancelled — points reversed",
      userId,
      orderId,
    },
  });

  await tx.order.update({
    where: { id: orderId },
    data: { pointsAwarded: false },
  });

  return awarded.points;
}

/**
 * Refunds points the customer spent at checkout (see
 * lib/loyalty-redemption.ts) when the order carrying that redemption is
 * cancelled — same idempotency pattern as refundGiftCard above: checks
 * for an existing MANUAL_ADJUSTMENT refund row on this order first, so
 * calling cancelOrder twice on the same order (which the state machine
 * already blocks via the CANCELLED-status early-return, but belt and
 * braces) never double-credits.
 */
async function refundRedeemedPoints(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string | null,
  pointsRedeemed: number
): Promise<number> {
  if (pointsRedeemed <= 0 || !userId) return 0;

  const alreadyRefunded = await tx.loyaltyTransaction.findFirst({
    where: {
      orderId,
      reason: "MANUAL_ADJUSTMENT",
      points: { gt: 0 },
      // Matched on the exact note reverseLoyaltyPointsRedemption writes.
      //
      // (Earlier revisions of this comment claimed reverseLoyaltyPoints —
      // the EARNED-points reversal that runs just above, in the same
      // transaction — also writes a POSITIVE MANUAL_ADJUSTMENT row. It
      // does not; it writes a negative one, so `points: { gt: 0 }` alone
      // would already exclude it. The note match is kept anyway: it costs
      // nothing, and it keeps this guard correct if that sign ever
      // changes.)
      note: "Order cancelled — redeemed points refunded",
    },
    select: { id: true },
  });
  if (alreadyRefunded) return 0;

  return reverseLoyaltyPointsRedemption(tx, orderId, userId, pointsRedeemed);
}