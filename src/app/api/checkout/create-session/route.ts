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
  findValidCoupon,
  calcDiscountAmount,
  consumeCoupon,
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
 *
 * A coupon (if any) is consumed at ORDER CREATION here, same as the
 * abandonment tradeoff above — not deferred until payment is actually
 * confirmed by the webhook. An abandoned Stripe session therefore burns
 * the coupon code along with leaving a PENDING order behind. Deferring
 * consumption to the webhook would close this gap but adds real
 * complexity (the webhook doesn't currently know the pre-discount
 * subtotal); accepted as a known limitation for now, consistent with how
 * the order-abandonment case above is already handled.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      items,
      billing,
      shippingMethod,
      couponCode,
    }: {
      items: IncomingItem[];
      billing: Billing;
      shippingMethod: ShippingMethod;
      couponCode?: string;
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

    const subtotal = resolvedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    let couponInfo: { id: string; code: string; percentOff: number } | null = null;
    if (couponCode?.trim()) {
      const couponResult = await findValidCoupon(couponCode);
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error }, { status: 409 });
      }
      couponInfo = couponResult.coupon;
    }

    const discountAmount = couponInfo
      ? calcDiscountAmount(subtotal, couponInfo.percentOff)
      : 0;
    const totalAmount = subtotal - discountAmount;

    const session = await auth();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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
          couponCode: couponInfo?.code ?? null,
          discountAmount,
          items: {
            create: resolvedItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
      });

      if (couponInfo) {
        const claimed = await consumeCoupon(tx, couponInfo.id, created.id);
        if (!claimed) {
          throw new Error("COUPON_ALREADY_USED");
        }
      }

      return created;
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripeClient();

    // The percent discount is applied on Stripe's side too, via a one-off
    // Stripe-native coupon scoped to this single session (duration:
    // "once") — rather than hand-adjusting each line item's unit_amount,
    // which would need its own cent-rounding logic to land on the exact
    // same total we already computed above.
    const stripeDiscounts = couponInfo
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                percent_off: couponInfo.percentOff,
                duration: "once",
                name: `Coupon ${couponInfo.code}`,
              })
            ).id,
          },
        ]
      : undefined;

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
      discounts: stripeDiscounts,
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
    if (error instanceof Error && error.message === "COUPON_ALREADY_USED") {
      return NextResponse.json(
        { error: "This coupon was just used by someone else. Please remove it and try again." },
        { status: 409 }
      );
    }
    console.error("POST /api/checkout/create-session error:", error);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}