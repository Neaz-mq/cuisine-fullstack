import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  SHIPPING_METHODS,
  ShippingMethod,
  Billing,
  validateBilling,
  resolveOrderItems,
  IncomingItem,
} from "@/lib/order-checkout-shared";

/**
 * src/app/api/checkout/create-session/route.ts
 *
 * POST -> for "Online Payment" checkouts only. Creates the Order in our DB
 * immediately with paymentStatus PENDING (no charge has happened yet), then
 * creates a Stripe Checkout Session and returns its hosted URL for the
 * client to redirect to. Stripe collects and validates the actual card
 * details on their own page — we never see or store raw card data.
 *
 * The order is only ever marked paymentStatus PAID, and the confirmation
 * email only ever sent, once the /api/webhooks/stripe handler receives a
 * verified checkout.session.completed event. A client-side "success"
 * redirect alone is never trusted as proof of payment.
 *
 * If the customer abandons the Stripe page, this order is left behind as
 * PLACED/PENDING (or flipped to CANCELLED/FAILED by the
 * checkout.session.expired webhook, if Stripe sends one before the session
 * naturally expires ~24h later). A scheduled cleanup for stale pending
 * orders would be a reasonable future addition but is out of scope here.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      items,
      billing,
      shippingMethod,
    }: {
      items: IncomingItem[];
      billing: Billing;
      shippingMethod: ShippingMethod;
    } = body;

    const billingError = validateBilling(billing);
    if (billingError) {
      return NextResponse.json({ error: billingError }, { status: 400 });
    }

    if (!SHIPPING_METHODS.includes(shippingMethod)) {
      return NextResponse.json(
        { error: "Invalid shipping method" },
        { status: 400 }
      );
    }

    const resolution = await resolveOrderItems(items);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.error }, { status: 409 });
    }
    const resolvedItems = resolution.items;

    const totalAmount = resolvedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    const session = await auth();

    const order = await prisma.order.create({
      data: {
        status: "PLACED",
        totalAmount,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        phone: billing.phone,
        country: billing.country,
        address: billing.address,
        apartment: billing.apartment || null,
        city: billing.city,
        state: billing.state,
        zip: billing.zip,
        shippingMethod,
        paymentMethod: "ONLINE",
        paymentStatus: "PENDING",
        userId: session?.user?.id ?? null,
        items: {
          create: resolvedItems.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripeClient();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: billing.email,
      line_items: resolvedItems.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(i.price * 100), // Stripe expects the smallest currency unit (cents)
          product_data: { name: i.title },
        },
      })),
      metadata: { orderId: order.id },
      success_url: `${appUrl}/track/${order.id}?payment=success`,
      cancel_url: `${appUrl}/carts?payment=cancelled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json(
      { url: checkoutSession.url, orderId: order.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/checkout/create-session error:", error);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}