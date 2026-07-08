import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";
import {
  SHIPPING_METHODS,
  ShippingMethod,
  Billing,
  validateBilling,
  resolveOrderItems,
  IncomingItem,
} from "@/lib/order-checkout-shared";

/**
 * src/app/api/orders/route.ts
 *
 * GET  /api/orders   -> all orders, for the admin dashboard (ADMIN only)
 * POST /api/orders    -> create a Cash-on-Delivery order directly (public —
 *                         guest checkout is allowed, matching /carts which
 *                         isn't behind auth; we attach the account if
 *                         logged in). Online/card payments go through
 *                         /api/checkout/create-session instead, which
 *                         redirects to Stripe before the order is confirmed.
 *
 * See src/lib/order-checkout-shared.ts for the menu-item-resolution shim
 * shared between this route and the Stripe checkout route.
 */

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { include: { menuItem: true } } },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order list" },
      { status: 500 }
    );
  }
}

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

    // This route only ever creates Cash-on-Delivery orders now — Online
    // payment is handled by /api/checkout/create-session, which redirects
    // to Stripe before an order is confirmed.
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
        paymentMethod: "COD",
        userId: session?.user?.id ?? null,
        items: {
          create: resolvedItems.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: { items: { include: { menuItem: true } } },
    });

    await sendOrderConfirmationEmail(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}