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
 *
 * ── ⚠️ ধাপ ৩ আর ৪-এর মাঝের ফাঁক (আগের বাগ) ──────────────────────────
 *
 * ধাপ ৩ শেষ হওয়ার সাথে সাথে Stripe `charge.refunded` webhook পাঠায় —
 * প্রায়ই ধাপ ৪ লেখার আগেই। তখনকার অবস্থাটা ছিল:
 *
 *   ধাপ ৩ → Stripe re_X ফেরত দিল
 *   [ফাঁক] → webhook এলো। recordExternalRefunds re_X খুঁজল, পেল না
 *            (কারণ stripeRefundId তখনো লেখা হয়নি), তাই একটা *দ্বিতীয়*
 *            Refund row বানাল আর refundedAmount আবার বাড়াল
 *   ধাপ ৪ → আমাদের update ওই re_X বসাতে গিয়ে P2002 খেল
 *          → catch-এ পড়ল → row FAILED, দাবি ফেরত
 *          → admin দেখল "Stripe refused the refund"
 *
 * টাকা কিন্তু ফেরত চলেই গেছে। মোট অঙ্কটা কাকতালীয়ভাবে ঠিক থাকত
 * (+A webhook, +A দাবি, −A catch = +A), কিন্তু paymentStatus হিসাব হতো
 * ক্ষণিকের 2A থেকে — তাই আংশিক refund-ও REFUNDED দেখাত — ledger-এ একটা
 * ভুতুড়ে FAILED row পড়ে থাকত, আর সবচেয়ে খারাপ, staff ভাবত ফেরত হয়নি
 * বলে Stripe dashboard থেকে হাতে আরেকবার পাঠাত। সেটাই আসল দ্বিগুণ ফেরত।
 *
 * ── সমাধান: refund-টা নিজের কিনা তা metadata দিয়ে চেনা ───────────────
 *
 * ধাপ ৩-এ Stripe refund-এ `metadata.refundId` বসানোই ছিল, শুধু webhook
 * সেটা ফেলে দিত। এখন সেটা পড়া হয়, আর ওই id-র row থাকলে নতুন row না
 * বানিয়ে *সেটাকেই* মিলিয়ে নেওয়া হয় (recordExternalRefunds-এ বিস্তারিত)।
 *
 * এতে race-টা আর সম্ভব নয়, কারণ PENDING row ধাপ ২-এ তৈরি হয় — অর্থাৎ
 * Stripe-কে ডাকার *আগে*। webhook যত দ্রুতই আসুক, row-টা সবসময় তার চেয়ে
 * পুরোনো।
 */

export type RefundFailure =
  | "Order not found"
  | "Only online card payments can be refunded here"
  | "This order has not been paid"
  | "This order has already been fully refunded"
  | "Amount must be greater than zero"
  | "Amount is more than what is left to refund"
  | "This order has no Stripe payment on record"
  | "Stripe refused the refund";

export type PaymentStatusAfterRefund = "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      amount: Money;
      /** Total refunded on this order after this one. */
      refundedAmount: Money;
      paymentStatus: PaymentStatusAfterRefund;
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
): PaymentStatusAfterRefund {
  if (refundedAmount.lessThanOrEqualTo(ZERO)) return "PAID";
  if (refundedAmount.greaterThanOrEqualTo(totalAmount)) return "REFUNDED";
  return "PARTIALLY_REFUNDED";
}

/**
 * Order-এর refundedAmount থেকে paymentStatus আর refundedAt মিলিয়ে দেওয়া।
 *
 * সবসময় *তাজা* refundedAmount পড়ে হিসাব করে, আগে পড়া কোনো মান থেকে নয়।
 * এটাই ছিল আরেকটা নীরব বাগের উৎস: refundOrder শুরুতে order পড়ত, তারপর
 * webhook মাঝখানে অঙ্ক বদলে দিলে শেষে বাসি মান দিয়ে status লেখা হতো —
 * আংশিক refund-ও REFUNDED দেখাত।
 *
 * refundedAt একবারই বসে — "কবে থেকে টাকা ফেরত যেতে শুরু করল" প্রশ্নের
 * উত্তর প্রথম ফেরতের সময়, শেষটার নয়।
 */
async function settleOrderAfterRefund(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ refundedAmount: Money; paymentStatus: PaymentStatusAfterRefund } | null> {
  const fresh = await tx.order.findUnique({
    where: { id: orderId },
    select: { refundedAmount: true, totalAmount: true, refundedAt: true },
  });
  if (!fresh) return null;

  const paymentStatus = recomputePaymentStatus(fresh.refundedAmount, fresh.totalAmount);

  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      // PAID মানে কার্যত কিছুই ফেরত যায়নি (বা দাবিটা ফিরিয়ে দেওয়া
      // হয়েছে) — তখন refundedAt বসানো মিথ্যা বলা হতো।
      refundedAt: fresh.refundedAt ?? (paymentStatus === "PAID" ? null : new Date()),
    },
  });

  return { refundedAmount: fresh.refundedAmount, paymentStatus };
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

  // REFUNDED-কে "not been paid"-এর সাথে গুলিয়ে ফেলা যাবে না — দুটো
  // সম্পূর্ণ ভিন্ন পরিস্থিতি। একটায় টাকাই ওঠেনি, আরেকটায় পুরো টাকা
  // ইতিমধ্যে ফেরত হয়ে গেছে। staff দুটোর একই বার্তা দেখলে বিভ্রান্ত
  // হবে — মনে করবে payment-ই হয়নি।
  if (order.paymentStatus === "REFUNDED") {
    return { ok: false, error: "This order has already been fully refunded" };
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

  const amount = input.amount === undefined ? remaining : toMoney(input.amount);

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
  //
  // এই row-টা Stripe-কে ডাকার আগে তৈরি হয় বলেই webhook কখনো এর চেয়ে
  // এগিয়ে যেতে পারে না — নিচের metadata-ভিত্তিক মিলিয়ে নেওয়াটা তাই
  // সবসময় একটা বিদ্যমান row খুঁজে পায়।
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
  //
  // metadata.refundId কেবল সাজসজ্জা নয় — charge.refunded webhook এটা
  // পড়েই বোঝে refund-টা আমাদেরই তৈরি, আর তখন নতুন row না বানিয়ে এই
  // row-টাই মিলিয়ে নেয়।
  try {
    const stripeRefund = await getStripeClient().refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: toStripeMinorUnits(amount, minorUnitsFor(order.currency)),
        metadata: { orderId: order.id, refundId: claimed.id },
      },
      { idempotencyKey: `refund_${claimed.id}` }
    );

    // ── ধাপ ৪ (সফল পথ) ──────────────────────────────────────────────
    //
    // updateMany + status guard, সরাসরি update নয়। webhook ইতিমধ্যে এই
    // row-টা SUCCEEDED করে ফেলে থাকলে count 0 আসবে — সেটা ব্যর্থতা নয়,
    // কেবল "কাজটা অন্য কেউ আগে সেরে ফেলেছে"।
    //
    // দুই পথেই stripeRefundId-তে একই মান (re_X) বসে, আর দুটোই *একই*
    // row-এ লেখে — তাই unique constraint আর কখনো এখানে ভাঙে না। আগের
    // বাগটা ঠিক এখানেই ছিল, কারণ webhook একটা আলাদা row বানিয়ে ফেলত।
    const settled = await prisma.$transaction(async (tx) => {
      await tx.refund.updateMany({
        where: { id: claimed.id, status: "PENDING" },
        data: { status: "SUCCEEDED", stripeRefundId: stripeRefund.id },
      });

      return settleOrderAfterRefund(tx, order.id);
    });

    const finalRefundedAmount = settled?.refundedAmount ?? alreadyRefunded.plus(amount);

    return {
      ok: true,
      refundId: claimed.id,
      amount,
      refundedAmount: finalRefundedAmount,
      paymentStatus:
        settled?.paymentStatus ??
        recomputePaymentStatus(finalRefundedAmount, order.totalAmount),
    };
  } catch (error) {
    // ── ধাপ ৪ (ব্যর্থ পথ): দাবি ফিরিয়ে দেওয়া ──────────────────────
    //
    // Stripe না নিলে টাকা যায়নি, তাই refundedAmount আবার কমিয়ে দিতে হবে —
    // নইলে বাকি টাকা চিরতরে আটকে থাকত আর ভবিষ্যতে বৈধ refund আটকে যেতো।
    //
    // ⚠️ কিন্তু শর্তসাপেক্ষে। "Stripe নেয়নি" আর "আমরা উত্তরটা পাইনি" এক
    // জিনিস নয় — read timeout-এ refund ঠিকই হয়ে যেতে পারে, আর তখন
    // webhook এসে row-টা SUCCEEDED করে দেয়। সেই অবস্থায় দাবি ফিরিয়ে
    // দিলে ledger বলত টাকা ফেরত যায়নি, অথচ গ্রাহক টাকা পেয়ে গেছেন।
    //
    // তাই status guard: row এখনো PENDING থাকলেই কেবল ছেড়ে দেওয়া হয়।
    //
    // row মুছে ফেলা হয় না: ব্যর্থ চেষ্টাও ঘটনা, আর support-এ "কেন হলো না"
    // জানতে failureReason-টাই একমাত্র সূত্র।
    const detail = error instanceof Error ? error.message : String(error);

    const released = await prisma.$transaction(async (tx) => {
      const flip = await tx.refund.updateMany({
        where: { id: claimed.id, status: "PENDING" },
        data: { status: "FAILED", failureReason: detail.slice(0, 500) },
      });

      // webhook আমাদের আগেই এটা নিষ্পত্তি করে ফেলেছে — টাকা গেছে।
      if (flip.count !== 1) return null;

      await tx.order.update({
        where: { id: order.id },
        data: { refundedAmount: { decrement: amount } },
      });

      return settleOrderAfterRefund(tx, order.id);
    });

    if (!released) {
      // ব্যর্থতা নয়, সফলতা — আমাদের call উত্তর পায়নি, কিন্তু Stripe
      // refund-টা করেছে এবং webhook সেটা নিশ্চিত করেছে। এখানে
      // "Stripe refused the refund" বলা মানেই staff-কে হাতে আরেকবার
      // ফেরত পাঠাতে পাঠানো — অর্থাৎ সত্যিকারের দ্বিগুণ ফেরত।
      console.warn(
        "Stripe refund call failed but a webhook had already settled it",
        order.id,
        claimed.id,
        detail
      );

      const fresh = await prisma.order.findUnique({
        where: { id: order.id },
        select: { refundedAmount: true, totalAmount: true },
      });

      const settledAmount = fresh?.refundedAmount ?? alreadyRefunded.plus(amount);

      return {
        ok: true,
        refundId: claimed.id,
        amount,
        refundedAmount: settledAmount,
        paymentStatus: recomputePaymentStatus(
          settledAmount,
          fresh?.totalAmount ?? order.totalAmount
        ),
      };
    }

    console.error("Stripe refund failed", order.id, detail);
    return { ok: false, error: "Stripe refused the refund", detail };
  }
}

/**
 * Stripe থেকে আসা একটা refund-এর আকৃতি (charge.refunded webhook)।
 *
 * `metadata` আগে এখানে ছিল না, আর সেটাই ছিল race-টার মূল কারণ — refund
 * আমাদের নিজের তৈরি কিনা চেনার একমাত্র তথ্যটাই webhook route ফেলে দিত।
 */
export interface ExternalRefund {
  id: string;
  amount: number;
  reason?: string | null;
  metadata?: Record<string, string> | null;
}

/**
 * Stripe-এ ঘটে যাওয়া refund গুলো আমাদের ledger-এ মেলানো (charge.refunded)।
 *
 * দুই রকম refund এই পথ দিয়ে আসে, আর দুটোকে আলাদা করে চেনা জরুরি:
 *
 *   ১. **Dashboard থেকে হাতে করা** — আমাদের কাছে কোনো row নেই। নতুন row
 *      বানাতে হবে, refundedAmount বাড়াতে হবে। এটাই এই function-এর মূল
 *      কাজ: নইলে Stripe বলত টাকা ফেরত গেছে আর admin বলত order সম্পূর্ণ
 *      PAID।
 *
 *   ২. **আমাদের নিজের refundOrder() থেকে** — row আগে থেকেই আছে
 *      (metadata.refundId), শুধু হয়তো এখনো PENDING। এখানে নতুন row
 *      বানানো মানেই দ্বিগুণ হিসাব। বদলে ওই row-টাই মিলিয়ে নেওয়া হয়।
 *
 * আগে ২ নম্বরটা চেনা হতো কেবল stripeRefundId দিয়ে — কিন্তু সেটা
 * refundOrder ধাপ ৪-এ লেখে, অর্থাৎ webhook আসার পরেও হতে পারে। তাই
 * metadata.refundId-ই এখন প্রথম ভরসা: ওই row ধাপ ২-এ তৈরি হয়, Stripe-কে
 * ডাকার আগেই, তাই webhook কখনো তার চেয়ে এগিয়ে থাকতে পারে না।
 *
 * ফেরত দেয় কতগুলো refund এই ডাকে *নতুন করে* হিসাবে যোগ হলো।
 */
export async function recordExternalRefunds(
  paymentIntentId: string,
  refunds: ExternalRefund[]
): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, currency: true, totalAmount: true, refundedAmount: true, refundedAt: true },
  });
  if (!order) return 0;

  const units = minorUnitsFor(order.currency);

  /** অঙ্ক বদলেছে এমন refund-এর সংখ্যা — এটাই ফেরত যায়। */
  let recorded = 0;
  /** কিছু একটা লেখা হয়েছে কিনা — status recompute করা লাগবে কিনা তার জন্য। */
  let touched = 0;

  for (const refund of refunds) {
    // Stripe minor unit -> Money, এই order-এর currency অনুযায়ী।
    const asMoney = fromMinorUnits(refund.amount, units);

    // ── ২ নম্বর: আমাদের নিজের তৈরি refund ────────────────────────────
    const ownRefundId = refund.metadata?.refundId;
    if (ownRefundId) {
      const own = await prisma.refund.findUnique({
        where: { id: ownRefundId },
        select: { id: true, orderId: true, status: true },
      });

      // orderId মিলিয়ে দেখা হয় কারণ metadata বাইরের ইনপুট — অন্য
      // environment বা restore করা database থেকে আসা একটা id ভুল
      // order-এ টাকা যোগ করে দিতে পারত।
      if (own && own.orderId === order.id) {
        if (own.status === "SUCCEEDED") {
          // আগেই নিষ্পত্তি হয়ে গেছে। Stripe একই event বারবার পাঠায়,
          // তাই এটাই সবচেয়ে সাধারণ ঘটনা।
          continue;
        }

        if (own.status === "PENDING") {
          // refundOrder এখনো ধাপ ৩ আর ৪-এর মাঝে। দাবিটা ইতিমধ্যে
          // refundedAmount-এ যোগ হয়ে আছে, তাই এখানে **বাড়ানো যাবে না** —
          // শুধু id বসিয়ে SUCCEEDED করা।
          //
          // ঠিক এই জায়গাটাতেই আগে একটা দ্বিতীয় row তৈরি হতো, আর তার
          // পরেই refundOrder-এর update P2002 খেয়ে সফল refund-কে
          // "Stripe refused" বানিয়ে দিত।
          const stamped = await prisma.refund.updateMany({
            where: { id: own.id, status: "PENDING" },
            data: { status: "SUCCEEDED", stripeRefundId: refund.id },
          });
          if (stamped.count === 1) touched += 1;
          continue;
        }

        // FAILED — refundOrder দাবি ছেড়ে দিয়েছিল, অথচ Stripe বলছে টাকা
        // ঠিকই গেছে (call টা timeout হয়েছিল, refund হয়নি এমন নয়)।
        // এটাই সেই বিরল অবস্থা যেখানে ledger সারিয়ে নিতে হয়।
        // Counter গুলো transaction-এর *বাইরে* বাড়ে। ভেতরে বাড়ালে
        // callback পুনরায় চললে (বা আংশিক ব্যর্থ হলে) হিসাব দুবার
        // গোনা হতে পারত — return করা boolean-ই একমাত্র সত্য।
        const repaired = await prisma.$transaction(async (tx) => {
          const flip = await tx.refund.updateMany({
            where: { id: own.id, status: "FAILED" },
            data: { status: "SUCCEEDED", stripeRefundId: refund.id, failureReason: null },
          });
          if (flip.count !== 1) return false;

          await tx.order.update({
            where: { id: order.id },
            data: { refundedAmount: { increment: asMoney } },
          });

          return true;
        });

        if (repaired) {
          recorded += 1;
          touched += 1;
        }
        continue;
      }
    }

    // ── ১ নম্বর: dashboard থেকে করা refund ───────────────────────────
    //
    // stripeRefundId-এর lookup এখনো দরকার: Stripe একই event বারবার
    // পাঠায়, আর metadata ছাড়া refund-এ চেনার আর কিছুই নেই।
    const existing = await prisma.refund.findUnique({
      where: { stripeRefundId: refund.id },
      select: { id: true },
    });
    if (existing) continue;

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
          data: { refundedAmount: { increment: asMoney } },
        });
      });
      recorded += 1;
      touched += 1;
    } catch (error) {
      // stripeRefundId-এ P2002 মানে সমান্তরাল কোনো delivery এটা আগেই
      // লিখে ফেলেছে — সেটাই কাম্য আচরণ, ভুল নয়।
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (touched > 0) {
    // তাজা অঙ্ক থেকে status — উপরে পড়া order.refundedAmount ততক্ষণে
    // বাসি হয়ে যেতে পারে, কারণ refundOrder সমান্তরালে দাবি করে থাকতে
    // পারে। আগে এখানে সেই বাসি মানই ব্যবহার হতো।
    await prisma.$transaction(async (tx) => {
      await settleOrderAfterRefund(tx, order.id);
    });
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
