import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { parseBody } from "@/lib/validations/parse";
import { purchaseGiftCardSchema } from "@/lib/validations/coupon";
import { getPricingSettings } from "@/lib/get-settings";
import { toMoney, toStripeMinorUnits } from "@/lib/money";

/**
 * src/app/api/gift-cards/purchase/route.ts
 *
 * POST -> starts a Stripe Checkout Session for buying a gift card.
 * Unlike a regular order, no DB row is created here at all — the
 * GiftCard row is only ever created once /api/webhooks/stripe verifies
 * checkout.session.completed for a session carrying `metadata.purpose ===
 * "gift_card"`. This avoids the "abandoned session leaves a live row
 * behind" tradeoff that /api/checkout/create-session deliberately accepts
 * for orders — an abandoned gift-card purchase simply leaves nothing
 * behind at all, which is a strictly better default here since there's no
 * cart/inventory reason to pre-create anything.
 *
 * All the identifying info needed to create the card after payment
 * (amount, recipient, message) rides along in the session's metadata,
 * since Stripe hands that back to us verbatim on the webhook event.
 */

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, purchaseGiftCardSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { amount, purchaserEmail, purchaserName, recipientEmail, recipientName, message } = parsed;

    // Defaults to the purchaser themselves when no recipient is given —
    // covers the common "buy one for myself to use later" case without
    // forcing the form to duplicate the purchaser's own details.
    const finalRecipientEmail = recipientEmail?.trim() || purchaserEmail.trim();
    const finalRecipientName = recipientName?.trim() || purchaserName?.trim() || "there";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripeClient();

    // Gift card-এর অঙ্ক রেস্তোরাঁর নিজের currency-তেই, তাই settings
    // থেকেই currency আর গুণক — hardcoded "usd" / ×100 নয়। ¥5,000-এর
    // একটা কার্ড আগে Stripe-এ ৫,০০,০০০ হয়ে যেতো।
    const pricingSettings = await getPricingSettings();
    const amountMinor = toStripeMinorUnits(
      toMoney(amount),
      pricingSettings.currencyMinorUnits
    );

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: purchaserEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pricingSettings.currency.toLowerCase(),
            unit_amount: amountMinor,
            product_data: {
              // মুদ্রা চিহ্ন ছাড়া নাম — Stripe নিজেই hosted পেজে
              // currency অনুযায়ী অঙ্কটা সাজিয়ে দেখায়, তাই এখানে "$"
              // লিখলে ইউরোর পাশে ডলার চিহ্ন বসতো।
              name: `Cuisine Gift Card (${pricingSettings.currency})`,
            },
          },
        },
      ],
      metadata: {
        purpose: "gift_card",
        amount: String(amount),
        purchaserEmail: purchaserEmail.trim(),
        purchaserName: purchaserName?.trim() || "",
        recipientEmail: finalRecipientEmail,
        recipientName: finalRecipientName,
        message: message?.trim().slice(0, 500) || "",
      },
      success_url: `${appUrl}/gift-cards?purchase=success`,
      cancel_url: `${appUrl}/gift-cards?purchase=cancelled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json({ url: checkoutSession.url }, { status: 201 });
  } catch (error) {
    console.error("POST /api/gift-cards/purchase error:", error);
    return NextResponse.json(
      { error: "Failed to start gift card checkout. Please try again." },
      { status: 500 }
    );
  }
}