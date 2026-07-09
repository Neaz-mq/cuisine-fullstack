import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";

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
        const orderId = session.metadata?.orderId;

        if (orderId) {
          const order = await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: "PAID" },
            include: { items: { include: { menuItem: true } } },
          });
          await sendOrderConfirmationEmail(order);
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