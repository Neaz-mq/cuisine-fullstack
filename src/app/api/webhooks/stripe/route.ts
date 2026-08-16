import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";
import { syncCustomerToAudience } from "@/lib/resend";
import { createGiftCard } from "@/lib/gift-cards";
import { sendGiftCardEmail } from "@/lib/send-gift-card-email";
import { cancelOrder } from "@/lib/cancel-order";
import { recordExternalRefunds } from "@/lib/refund-order";

/**
 * src/app/api/webhooks/stripe/route.ts
 *
 * একটা online order-কে paymentStatus PAID করার এবং confirmation email
 * পাঠানোর একমাত্র জায়গা এটাই। /api/checkout/create-session-এর
 * success_url শুধু browser-কে কোথায় পাঠানো হবে তা ঠিক করে — সেটা
 * কখনোই payment হয়েছে তার প্রমাণ নয়, কারণ customer টাকা না দিয়েও ওই
 * URL-এ পৌঁছাতে পারে (back button, URL অনুমান, ইত্যাদি)। শুধুমাত্র
 * Stripe-এর নিজের signature-verified event বিশ্বাস করা হয়।
 *
 * Local testing-এ Stripe CLI দিয়ে event forward করতে হবে:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * সেটা যে whsec_... secret ছাপে তা .env-এর STRIPE_WEBHOOK_SECRET-এ
 * বসিয়ে dev server hard restart দিন (env পরিবর্তনে hot reload যথেষ্ট
 * নয়)। এই route থেকে 400 এলে প্রথমেই দেখবেন secret-টা পুরোপুরি কপি
 * হয়েছে কিনা এবং চলমান `stripe listen` যা দেখাচ্ছে তার সাথে মেলে কিনা।
 *
 * এই ফাইলের তিনটে নীতি, তিনটে আসল bug থেকে শেখা:
 *
 * ১. দাবি সবসময় atomic — findUnique করে পড়ে তারপর update নয়। Stripe
 *    at-least-once deliver করে, তাই একই event দুবার আসতেই পারে;
 *    পড়া-তারপর-লেখা করলে দুটো delivery-ই "এখনো PAID হয়নি" দেখে দুবার
 *    email পাঠাতো।
 *
 * ২. Payment record করার পরের কোনো side effect (email, audience sync)
 *    কখনো response fail করাতে পারবে না। আগে email throw করলে outer
 *    catch 500 দিত, Stripe retry করতো, কিন্তু order ততক্ষণে PAID — তাই
 *    idempotency guard short-circuit করতো আর email আর কোনোদিনই যেত না।
 *    টাকা নেওয়া হয়েছে, customer কিছুই পায়নি।
 *
 * ৩. session.expired শুধু status বদলায় না, দাবি করা মূল্য ফেরতও দেয় —
 *    cancelOrder() stock, coupon, gift card সব reverse করে। আগে শুধু
 *    CANCELLED লেখা হতো, ফলে abandoned checkout-এ customer-এর gift card
 *    balance চিরতরে হারিয়ে যেত।
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Stripe webhook: missing signature header or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Signature verification-এ Stripe যে exact bytes পাঠিয়েছে সেটাই লাগে।
  // .text() আগে string-এ decode করে, যা সূক্ষ্ম encoding পার্থক্য তৈরি
  // করতে পারে; arrayBuffer() -> Buffer হুবহু bytes রাখে, যা Stripe-এর
  // SDK HMAC যাচাইয়ের জন্য চায়।
  const rawBodyBuffer = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBodyBuffer, signature, webhookSecret);
  } catch (err) {
    console.error(
      "Stripe webhook signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Gift-card কেনাকাটায় কখনো orderId থাকে না — সেগুলো
        // metadata.purpose দিয়ে আলাদা করা হয়, যা শুধু
        // /api/gift-cards/purchase সেট করে। এখানে কোনো Order row-ই
        // জড়িত নয়, তাই নিচের order-payment path থেকে সম্পূর্ণ আলাদা।
        if (session.metadata?.purpose === "gift_card") {
          await handleGiftCardPurchase(session);
          break;
        }

        const orderId = session.metadata?.orderId;
        if (orderId) {
          await handleOrderPaid(orderId, session);
        }
        break;
      }

      case "charge.refunded": {
        // Stripe dashboard থেকে সরাসরি refund করা হয়েছে।
        //
        // এটা না সামলালে দুই জায়গায় দুই সত্য থাকত: Stripe বলত টাকা ফেরত
        // গেছে, আমাদের admin বলত order সম্পূর্ণ PAID। হিসাব মেলানোর সময়
        // সেটাই সবচেয়ে বিভ্রান্তিকর।
        //
        // আমাদের নিজের UI থেকে করা refund-ও এই event হয়ে ফিরে আসে —
        // তখন Refund row ইতিমধ্যে আছে, তাই stripeRefundId-এর unique
        // constraint চুপচাপ সেটা উপেক্ষা করে।
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (paymentIntentId) {
          await recordExternalRefunds(
            paymentIntentId,
            (charge.refunds?.data ?? []).map((r) => ({
              id: r.id,
              amount: r.amount,
              reason: r.reason,
            }))
          );
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          // Customer টাকা না দিয়ে Stripe-এর পেজ ছেড়ে গেছে। শুধু
          // CANCELLED লিখলে যথেষ্ট নয় — cancelOrder() deduct হওয়া stock
          // ফেরত দেয়, coupon-এর usageCount কমায়, আর সবচেয়ে জরুরি, gift
          // card balance ফেরত দেয়। ওটা না করলে customer-এর টাকা এমন
          // একটা order-এ আটকে থাকতো যার জন্য কেউ কখনো টাকা দেয়নি।
          //
          // completed event-এর সাথে race লাগলে (order ততক্ষণে PAID আর
          // DELIVERED-এর পথে) cancelOrder নিজেই ok:false ফেরত দেয়,
          // throw করে না — তাই এখানে আলাদা guard লাগে না।
          const result = await cancelOrder(orderId, "Stripe checkout session expired");
          if (!result.ok) {
            console.error("Could not cancel expired checkout order", orderId, result.error);
          }
        }
        break;
      }

      default:
        // এই flow-এর সাথে এখনো প্রাসঙ্গিক নয় এমন event type.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

/**
 * Order-কে PAID হিসেবে দাবি করে, তারপর confirmation email আর marketing
 * sync চালায়। দাবিটা updateMany দিয়ে — যে call count 1 পায় সেটাই
 * একমাত্র email পাঠায়, বাকি duplicate delivery চুপচাপ ফিরে যায়।
 */
async function handleOrderPaid(orderId: string, session: Stripe.Checkout.Session) {
  // ⚠️ payment_intent এখানেই ধরে রাখতে হয়, আর কোথাও নয়।
  //
  // Stripe-এর Refunds API একটা payment intent বা charge id ছাড়া কাজ করে
  // না, অথচ আগে এই webhook শুধু metadata.orderId পড়ে বাকি সব ফেলে দিত।
  // ফলে টাকা নেওয়া যেত কিন্তু ফেরত দেওয়ার কোনো পথ থাকত না — এই একটা
  // লাইন না থাকায় গোটা refund feature-ই অসম্ভব ছিল।
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const claim = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAID" } },
    data: {
      paymentStatus: "PAID",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });

  // count 0 মানে অন্য কোনো delivery ইতিমধ্যে এটা সামলে ফেলেছে।
  if (claim.count !== 1) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { menuItem: true } } },
  });
  if (!order) {
    console.error("Order vanished between claim and read", orderId);
    return;
  }

  // ⚠️ এখান থেকে নিচের কিছুই throw করে webhook fail করাতে পারবে না।
  // টাকা নেওয়া হয়ে গেছে এবং DB-তে record হয়ে গেছে — Resend সাময়িকভাবে
  // বন্ধ থাকলে সেটা Stripe-কে 500 দেখানোর কারণ নয়, কারণ retry-তে উপরের
  // claim আর পাস করবে না আর email চিরতরে হারিয়ে যাবে।
  try {
    await sendOrderConfirmationEmail(order);
  } catch (error) {
    // TODO: retry queue / outbox — আপাতত অন্তত Sentry আর log-এ থাকে,
    // যাতে দরকার হলে হাতে পাঠানো যায়।
    console.error("Confirmation email failed for paid order", orderId, error);
  }

  // ⚠️ marketingConsent এই Order row-তে আগে থেকেই থাকতে হবে — সেটা
  // /api/checkout/create-session-এ order তৈরির সময় (Stripe redirect-এর
  // আগে) capture করা হয়, ঠিক যেভাবে COD order-এ /api/orders করে। এই
  // route শুধু পড়ে, customer-কে কখনো জিজ্ঞেস করে না।
  if (order.marketingConsent && order.email) {
    try {
      await syncCustomerToAudience({
        email: order.email,
        firstName: order.firstName,
        lastName: order.lastName,
      });

      if (order.userId) {
        await prisma.user.update({
          where: { id: order.userId },
          data: { marketingConsent: true, marketingConsentAt: new Date() },
        });
      }
    } catch (error) {
      console.error("Marketing audience sync failed for order", orderId, error);
    }
  }
}

/**
 * Gift card কেনা সম্পন্ন — card তৈরি করে recipient-কে email পাঠায়।
 *
 * Idempotency-র আসল guard হলো GiftCard.stripeSessionId-এর @unique
 * constraint। আগে findUnique দিয়ে আগে থেকে দেখা হতো, কিন্তু সেটা
 * check-then-act — দুটো delivery একসাথে এলে দুটোই "নেই" দেখতো। এখন
 * সরাসরি তৈরি করার চেষ্টা করা হয় আর P2002 ধরা হয়।
 */
async function handleGiftCardPurchase(session: Stripe.Checkout.Session) {
  const amount = Number(session.metadata?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error(
      "Stripe webhook: gift_card session completed with invalid amount metadata",
      session.id
    );
    return;
  }

  let giftCard;
  try {
    giftCard = await createGiftCard({
      amount,
      type: "PURCHASE",
      stripeSessionId: session.id,
      purchaserEmail: session.metadata?.purchaserEmail || null,
      purchaserName: session.metadata?.purchaserName || null,
      recipientEmail: session.metadata?.recipientEmail || null,
      recipientName: session.metadata?.recipientName || null,
      message: session.metadata?.message || null,
    });
  } catch (error) {
    // stripeSessionId-এ P2002 মানে এই session আগেই সামলানো হয়েছে —
    // duplicate delivery, ত্রুটি নয়। চুপচাপ ফিরে যাওয়াই সঠিক, নাহলে
    // Stripe 500 দেখে চিরকাল retry করতে থাকবে।
    if (isSessionAlreadyProcessed(error)) return;
    throw error;
  }

  if (giftCard.recipientEmail) {
    try {
      await sendGiftCardEmail({
        code: giftCard.code,
        amount: giftCard.initialAmount,
        recipientEmail: giftCard.recipientEmail,
        recipientName: giftCard.recipientName || "there",
        purchaserName: giftCard.purchaserName,
        message: giftCard.message,
      });
    } catch (error) {
      // Card তৈরি হয়ে গেছে — email পাঠানো যায়নি বলে webhook fail
      // করানো যাবে না, কারণ retry-তে P2002 হয়ে চুপচাপ ফিরে যাবে আর
      // email কোনোদিনই যাবে না। Admin panel থেকে code দেখে হাতে
      // পাঠানো যাবে।
      console.error("Gift card delivery email failed for card", giftCard.id, error);
    }
  }
}

/** P2002 হয়েছে কিনা এবং সেটা stripeSessionId-এর কারণে কিনা। code-এর
 * collision (createGiftCard নিজেই retry করে) থেকে আলাদা করা জরুরি। */
function isSessionAlreadyProcessed(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; meta?: { target?: string[] | string } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  const fields = Array.isArray(target) ? target : target ? [target] : [];
  return fields.some((f) => f.includes("stripeSessionId"));
}