import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getStripeClient } from "@/lib/stripe";
import { type Money, toMoney, ZERO, toStripeMinorUnits } from "@/lib/money";
import { minorUnitsFor } from "@/lib/currency-format";

/**
 * src/lib/refund-order.ts
 *
 * টাকা ফেরত দেওয়ার একমাত্র পথ।
 *
 * এতদিন সিস্টেম টাকা নিতে পারত, ফেরত দিতে পারত না। cancelOrder() stock,
 * coupon, gift card আর loyalty point সব ফিরিয়ে দিত — কিন্তু কার্ডে কাটা
 * টাকা রেস্তোরাঁর কাছেই থেকে যেতো, আর PaymentStatus-এ সেই অবস্থাটা
 * বোঝানোর মতো কোনো মানই ছিল না।
 *
 * ── কেন Stripe-কে ডাকার আগেই ledger row লেখা হয় ───────────────────────
 *
 * Refund একটা বাইরের পার্শ্বপ্রতিক্রিয়া — database transaction সেটা
 * rollback করতে পারে না। আগে Stripe ডেকে তারপর crash করলে গ্রাহক টাকা
 * পেয়ে যেতেন, অথচ আমাদের কাছে কোনো রেকর্ড থাকত না — আর পরের ক্লিকে
 * আবার পাঠানো হতো।
 *
 * তাই ক্রমটা:
 *
 *   ১. Order-এ conditional increment দিয়ে দাবি (claim) করা
 *   ২. PENDING Refund row লেখা
 *   ৩. row-এর id-কেই Stripe-এর idempotency key ধরে refund তৈরি
 *   ৪. SUCCEEDED বা FAILED-এ নেওয়া (fail হলে claim ফিরিয়ে দেওয়া)
 *
 * মাঝপথে crash হলে একটা দৃশ্যমান PENDING row পড়ে থাকে, যা মেলানো যায় —
 * নীরবে দুবার টাকা চলে যাওয়ার চেয়ে যা অনেক ভালো।
 *
 * ── একই সাথে দুজন Refund চাপলে ───────────────────────────────────────
 *
 * ধাপ ১-এর দাবিটা compare-and-set:
 *
 *     updateMany({ where: { id, refundedAmount: { lte: সর্বোচ্চ } }, ... })
 *
 * count 0 মানে ইতিমধ্যে কেউ দাবি করে ফেলেছে। ঠিক সেই ধরনের atomic claim
 * যা advance-order-to-preparing.ts-এ stockDeductedAt দিয়ে করা হয় —
 * read-then-write নয়, নইলে দুটো tab থেকে দুবার পুরো টাকা ফেরত যেতে পারত।
 */

export type RefundFailure =
  | "Order not found"
  | "Only online card payments can be refunded here"
  | "This order has not been paid"
  | "Amount must be greater than zero"
  | "Amount is more than what is left to refund"
  | "This order has no Stripe payment on record"
  | "Stripe refused the refund";

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      amount: Money;
      /** Total refunded on this order after this one. */
      refundedAmount: Money;
      paymentStatus: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
    }
  | { ok: false; error: RefundFailure; detail?: string };

/**
 * refundedAmount থেকে paymentStatus বের করা — এটাই একমাত্র জায়গা যেখানে
 * ওই দুটো নতুন enum মান বসে। হাতে কোথাও সেট করা হয় না, নইলে ledger আর
 * badge আলাদা কথা বলত।
 *
 * তুলনাটা totalAmount-এর সাথে (যা আসলে চার্জ হয়েছিল), grandTotal-এর সাথে
 * নয় — gift card বা point দিয়ে মেটানো অংশ Stripe-এ কখনো যায়নি, তাই
 * ফেরতও যাবে না। ওটুকু cancelOrder() ledger-এ ফেরত দেয়।
 */
export function recomputePaymentStatus(
  refundedAmount: Money,
  totalAmount: Money
): "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" {
  if (refundedAmount.lessThanOrEqualTo(ZERO)) return "PAID";
  if (refundedAmount.greaterThanOrEqualTo(totalAmount)) return "REFUNDED";
  return "PARTIALLY_REFUNDED";
}

export interface RefundInput {
  orderId: string;
  /** ছেড়ে দিলে যা বাকি আছে তার পুরোটা — সবচেয়ে সাধারণ ঘটনা। */
  amount?: Money | number | string;
  reason?: string;
  /** যে staff member চাপছেন। Stripe dashboard থেকে এলে null। */
  issuedById?: string | null;
}

export async function refundOrder(input: RefundInput): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      refundedAmount: true,
      currency: true,
      stripePaymentIntentId: true,
      refundedAt: true,
    },
  });

  if (!order) return { ok: false, error: "Order not found" };

  // COD / Pay-at-Table কখনো অনলাইনে চার্জ হয়নি — সেখানে "refund" মানে
  // হাতে নগদ ফেরত দেওয়া, যা এই সিস্টেমের কাজ নয়।
  if (order.paymentMethod !== "ONLINE") {
    return { ok: false, error: "Only online card payments can be refunded here" };
  }

  // PENDING বা FAILED order-এ ফেরত দেওয়ার মতো কিছুই নেই। ইতিমধ্যে
  // আংশিক ফেরত হয়ে থাকলে (PARTIALLY_REFUNDED) আরও দেওয়া যায়, তাই সেটা
  // অনুমোদিত।
  const refundable = ["PAID", "PARTIALLY_REFUNDED"];
  if (!refundable.includes(order.paymentStatus)) {
    return { ok: false, error: "This order has not been paid" };
  }

  if (!order.stripePaymentIntentId) {
    // এই migration-এর আগে টাকা দেওয়া order — payment intent সংরক্ষিত
    // হয়নি, তাই API দিয়ে ফেরত দেওয়ার পথ নেই। Stripe dashboard থেকে
    // করতে হবে; charge.refunded webhook সেটা এখানে লিখে দেবে।
    return { ok: false, error: "This order has no Stripe payment on record" };
  }

  const alreadyRefunded = order.refundedAmount;
  const remaining = order.totalAmount.minus(alreadyRefunded);

  const amount =
    input.amount === undefined ? remaining : toMoney(input.amount);

  if (amount.lessThanOrEqualTo(ZERO)) {
    return { ok: false, error: "Amount must be greater than zero" };
  }
  if (amount.greaterThan(remaining)) {
    return { ok: false, error: "Amount is more than what is left to refund" };
  }

  // ── ধাপ ১ + ২: দাবি করা, তারপর PENDING row ─────────────────────────
  //
  // দুটো একই transaction-এ, যাতে দাবি করা হয়েছে অথচ row লেখা হয়নি এমন
  // অবস্থা কখনো না থাকে — সেটা হলে টাকা চিরতরে "সংরক্ষিত" থেকে যেতো।
  const maxAllowed = order.totalAmount.minus(amount);

  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        // compare-and-set: অন্য কেউ ইতিমধ্যে দাবি করে থাকলে এই শর্ত আর
        // মিলবে না, count 0 আসবে।
        refundedAmount: { lte: maxAllowed },
      },
      data: { refundedAmount: { increment: amount } },
    });

    if (claim.count !== 1) return null;

    return tx.refund.create({
      data: {
        orderId: order.id,
        amount,
        currency: order.currency,
        status: "PENDING",
        reason: input.reason?.trim() || null,
        issuedById: input.issuedById ?? null,
      },
      select: { id: true },
    });
  });

  if (!claimed) {
    return { ok: false, error: "Amount is more than what is left to refund" };
  }

  // ── ধাপ ৩: Stripe ─────────────────────────────────────────────────
  //
  // idempotencyKey হিসেবে refund row-এর id। একই key-তে দ্বিতীয়বার call
  // করলে Stripe নতুন refund না বানিয়ে আগেরটাই ফেরত দেয় — তাই network
  // hiccup-এ SDK retry করলেও দুবার টাকা যাবে না।
  try {
    const stripeRefund = await getStripeClient().refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: toStripeMinorUnits(amount, minorUnitsFor(order.currency)),
        metadata: { orderId: order.id, refundId: claimed.id },
      },
      { idempotencyKey: `refund_${claimed.id}` }
    );

    const finalRefundedAmount = alreadyRefunded.plus(amount);
    const paymentStatus = recomputePaymentStatus(finalRefundedAmount, order.totalAmount);

    await prisma.$transaction([
      prisma.refund.update({
        where: { id: claimed.id },
        data: { status: "SUCCEEDED", stripeRefundId: stripeRefund.id },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          // প্রথম সফল refund-এর সময়টাই ধরে রাখা হয়, পরেরগুলো বদলায় না —
          // "কবে থেকে টাকা ফেরত যেতে শুরু করল" প্রশ্নের উত্তর ওটাই।
          refundedAt: order.refundedAt ?? new Date(),
        },
      }),
    ]);

    return {
      ok: true,
      refundId: claimed.id,
      amount,
      refundedAmount: finalRefundedAmount,
      paymentStatus,
    };
  } catch (error) {
    // ── ধাপ ৪ (ব্যর্থ পথ): দাবি ফিরিয়ে দেওয়া ──────────────────────
    //
    // Stripe না নিলে টাকা যায়নি, তাই refundedAmount আবার কমিয়ে দিতে হবে —
    // নইলে বাকি টাকা চিরতরে আটকে থাকত আর ভবিষ্যতে বৈধ refund আটকে যেতো।
    //
    // row মুছে ফেলা হয় না: ব্যর্থ চেষ্টাও ঘটনা, আর support-এ "কেন হলো না"
    // জানতে failureReason-টাই একমাত্র সূত্র।
    const detail = error instanceof Error ? error.message : String(error);

    await prisma.$transaction([
      prisma.refund.update({
        where: { id: claimed.id },
        data: { status: "FAILED", failureReason: detail.slice(0, 500) },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { refundedAmount: { decrement: amount } },
      }),
    ]);

    console.error("Stripe refund failed", order.id, detail);
    return { ok: false, error: "Stripe refused the refund", detail };
  }
}

/**
 * Stripe dashboard থেকে সরাসরি করা refund রেকর্ড করে (charge.refunded)।
 *
 * এটা না থাকলে দুই জায়গায় দুই সত্য থাকত: Stripe বলত টাকা ফেরত গেছে,
 * আমাদের admin বলত order এখনো সম্পূর্ণ PAID। হিসাব মেলানোর সময় সেটাই
 * সবচেয়ে বিভ্রান্তিকর।
 *
 * Idempotency আসে Refund.stripeRefundId-এর unique constraint থেকে —
 * Stripe একই event বারবার পাঠায়, আর আমাদের নিজেদের তৈরি refund-ও এই
 * event হিসেবে ফিরে আসে (তখন row ইতিমধ্যে আছে, তাই কিছুই হয় না)।
 */
export async function recordExternalRefunds(
  paymentIntentId: string,
  refunds: { id: string; amount: number; reason?: string | null }[]
): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, currency: true, totalAmount: true, refundedAmount: true, refundedAt: true },
  });
  if (!order) return 0;

  const units = minorUnitsFor(order.currency);
  let recorded = 0;

  for (const refund of refunds) {
    // এই refund আমাদেরই তৈরি হতে পারে (উপরের flow), তখন row-টা আগে থেকেই
    // আছে — কিছু করার নেই।
    const existing = await prisma.refund.findUnique({
      where: { stripeRefundId: refund.id },
      select: { id: true },
    });
    if (existing) continue;

    // Stripe minor unit -> Money, এই order-এর currency অনুযায়ী।
    const asMoney = fromMinorUnits(refund.amount, units);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.refund.create({
          data: {
            orderId: order.id,
            amount: asMoney,
            currency: order.currency,
            status: "SUCCEEDED",
            stripeRefundId: refund.id,
            reason: refund.reason ?? "Refunded from Stripe dashboard",
            // issuedById null — এটাই যে কেউ Stripe থেকে করেছে তার চিহ্ন,
            // আর বিরোধ মেটানোর সময় ঠিক এই পার্থক্যটাই জানা দরকার।
            issuedById: null,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            refundedAmount: { increment: asMoney },
            refundedAt: order.refundedAt ?? new Date(),
          },
        });
      });
      recorded += 1;
    } catch (error) {
      // stripeRefundId-এ P2002 মানে সমান্তরাল কোনো delivery এটা আগেই
      // লিখে ফেলেছে — সেটাই কাম্য আচরণ, ভুল নয়।
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (recorded > 0) {
    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      select: { refundedAmount: true, totalAmount: true },
    });
    if (fresh) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: recomputePaymentStatus(fresh.refundedAmount, fresh.totalAmount),
        },
      });
    }
  }

  return recorded;
}

/** Stripe-এর minor unit -> Money, currency-র দশমিক অনুযায়ী। */
function fromMinorUnits(amount: number, minorUnits: number): Money {
  return toMoney(amount).dividedBy(toMoney(10).pow(minorUnits));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
  );
}
