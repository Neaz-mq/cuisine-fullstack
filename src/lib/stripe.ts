import Stripe from "stripe";

let stripeClient: Stripe | null = null;

// Lazily instantiated for the same reason as getResendClient() in
// src/lib/resend.ts — importing this module should never throw just
// because STRIPE_SECRET_KEY isn't set yet locally.
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(apiKey);
  }
  return stripeClient;
}