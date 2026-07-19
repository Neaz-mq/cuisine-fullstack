import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";
import { syncCustomerToAudience } from "@/lib/resend";
import { createGiftCard } from "@/lib/gift-cards";
import { sendGiftCardEmail } from "@/lib/send-gift-card-email";

/**
 * src/app/api/webhooks/stripe/route.ts
 *
 * This is the ONLY place an online order is marked paymentStatus PAID and
 * the ONLY trigger for sending the confirmation email on an online order.
 * The success_url redirect in /api/checkout/create-session is just where
 * we send the browser — it is never treated as proof that payment
 * happened, since a customer could reach that URL without ever paying
 * (browser back button, guessing the URL, etc). Only a signature-verified
 * event from Stripe itself is trusted.
 *
 * Local testing requires the Stripe CLI forwarding events to this route:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * Copy the whsec_... secret it prints into STRIPE_WEBHOOK_SECRET in .env,
 * then restart the dev server (env changes need a hard restart, not hot
 * reload). If you ever see 400s from this route, first double check that
 * secret is copied in full and matches what the running `stripe listen`
 * session currently shows.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error(
      "Stripe webhook: missing signature header or STRIPE_WEBHOOK_SECRET",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 400 },
    );
  }

  // Signature verification needs the exact raw bytes Stripe sent. Using
  // .text() decodes to a string first, which can introduce subtle encoding
  // differences; arrayBuffer() -> Buffer preserves the exact bytes, which
  // is what Stripe's SDK expects for HMAC verification.
  const rawBodyBuffer = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBodyBuffer,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error(
      "Stripe webhook signature verification failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Gift-card purchases never have an orderId — they're
        // distinguished by metadata.purpose, set only in
        // /api/gift-cards/purchase. Handled entirely separately from the
        // order-payment path below since there's no Order row involved
        // at all (see the doc comment on that route for why).
        if (session.metadata?.purpose === "gift_card") {
          // IDEMPOTENCY: Stripe delivers webhooks at-least-once — the same
          // checkout.session.completed event can arrive twice (retry after
          // a timeout on our end, duplicate delivery, etc). Without this
          // check, a retry would attempt a second createGiftCard() call for
          // the same session. The DB's stripeSessionId @unique constraint
          // stops a literal duplicate row from being written, but
          // createGiftCard's own retry-on-P2002 loop can't tell "code
          // collision" apart from "this session was already processed" —
          // it would burn all 5 attempts on the latter and throw, causing
          // Stripe to see a 500 and keep retrying forever. Checking first
          // avoids calling createGiftCard (and re-sending the delivery
          // email) at all once this session has already been handled.
          const existing = await prisma.giftCard.findUnique({
            where: { stripeSessionId: session.id },
            select: { id: true },
          });
          if (existing) {
            break;
          }

          const amount = Number(session.metadata.amount);
          if (Number.isFinite(amount) && amount > 0) {
            const giftCard = await createGiftCard({
              amount,
              type: "PURCHASE",
              stripeSessionId: session.id,
              purchaserEmail: session.metadata.purchaserEmail || null,
              purchaserName: session.metadata.purchaserName || null,
              recipientEmail: session.metadata.recipientEmail || null,
              recipientName: session.metadata.recipientName || null,
              message: session.metadata.message || null,
            });

            if (giftCard.recipientEmail) {
              await sendGiftCardEmail({
                code: giftCard.code,
                amount: giftCard.initialAmount,
                recipientEmail: giftCard.recipientEmail,
                recipientName: giftCard.recipientName || "there",
                purchaserName: giftCard.purchaserName,
                message: giftCard.message,
              });
            }
          } else {
            console.error(
              "Stripe webhook: gift_card session completed with invalid amount metadata",
              session.id
            );
          }
          break;
        }

        const orderId = session.metadata?.orderId;

        if (orderId) {
          // IDEMPOTENCY: same at-least-once delivery concern as the gift
          // card branch above. Re-setting paymentStatus to PAID on a
          // retry is harmless on its own, but sendOrderConfirmationEmail
          // and syncCustomerToAudience are NOT idempotent — without this
          // check, every redelivery of this event resends the customer's
          // order confirmation email. Skip entirely once already PAID.
          const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            select: { paymentStatus: true },
          });
          if (existingOrder?.paymentStatus === "PAID") {
            break;
          }

          const order = await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: "PAID" },
            include: { items: { include: { menuItem: true } } },
          });
          await sendOrderConfirmationEmail(order);

          // ⚠️ Requires marketingConsent to already be set on this Order
          // row — it must be captured at order-creation time in
          // /api/checkout/create-session (before the Stripe redirect),
          // the same way it's captured in /api/orders for COD orders.
          // This route only reads it, never asks the customer for it.
          if (order.marketingConsent && order.email) {
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
          }
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          // Customer abandoned Stripe's page without paying — cancel the
          // order so it doesn't sit in the Kitchen queue or admin Orders
          // list looking like a live order nobody actually paid for.
          // Wrapped so a race with checkout.session.completed (order
          // already updated/deleted) doesn't throw here.
          await prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: "FAILED", status: "CANCELLED" },
            })
            .catch(() => {});
        }
        break;
      }

      default:
        // Other event types aren't relevant to this flow yet.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}