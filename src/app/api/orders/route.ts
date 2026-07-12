import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";
import {
  SHIPPING_METHODS,
  ShippingMethod,
  Billing,
  OrderTypeValue,
  validateBilling,
  resolveOrderItems,
  findValidCoupon,
  calcDiscountAmount,
  consumeCoupon,
  getCustomerKey,
  CouponInfo,
  IncomingItem,
} from "@/lib/order-checkout-shared";

/**
 * src/app/api/orders/route.ts
 *
 * GET  /api/orders   -> all orders, for the admin dashboard (ADMIN only)
 * POST /api/orders    -> create an order directly, no payment redirect.
 *                        Covers two order types:
 *                          - DELIVERY (default) + Cash on Delivery — same
 *                            flow as before.
 *                          - DINE_IN (QR Table Ordering) — always "Pay at
 *                            Table", which reuses the COD paymentMethod
 *                            value (see prisma/schema.prisma note on
 *                            Order.paymentMethod).
 *                        Online/card payments still go through
 *                        /api/checkout/create-session instead, which
 *                        redirects to Stripe before the order is confirmed
 *                        — that path is DELIVERY-only, dine-in never uses it.
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
      include: { items: { include: { menuItem: true } }, table: true },
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
      orderType = "DELIVERY",
      tableId,
      couponCode,
    }: {
      items: IncomingItem[];
      billing: Billing;
      shippingMethod?: ShippingMethod;
      orderType?: OrderTypeValue;
      tableId?: string;
      couponCode?: string;
    } = body;

    if (orderType !== "DELIVERY" && orderType !== "DINE_IN") {
      return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
    }

    const billingError = validateBilling(billing, orderType);
    if (billingError) {
      return NextResponse.json({ error: billingError }, { status: 400 });
    }

    let validatedTableId: string | null = null;

    if (orderType === "DINE_IN") {
      if (!tableId) {
        return NextResponse.json(
          { error: "Table is required for dine-in orders" },
          { status: 400 }
        );
      }

      const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } });
      if (!table || !table.isActive) {
        return NextResponse.json(
          {
            error:
              "This table is no longer available. Please ask staff for a fresh QR code.",
          },
          { status: 409 }
        );
      }
      validatedTableId = table.id;
    } else {
      if (!SHIPPING_METHODS.includes(shippingMethod as ShippingMethod)) {
        return NextResponse.json(
          { error: "Invalid shipping method" },
          { status: 400 }
        );
      }
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

    const session = await auth();
    const customerKey = getCustomerKey(session?.user?.id, billing.phone);

    // Pre-check outside the transaction purely for a fast, friendly error
    // message — the actual claim (and the only real concurrency guard)
    // happens inside the transaction via consumeCoupon below.
    let couponInfo: CouponInfo | null = null;
    let discountAmount = 0;
    if (couponCode?.trim()) {
      const couponResult = await findValidCoupon(couponCode, resolvedItems, customerKey);
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error }, { status: 409 });
      }
      couponInfo = couponResult.coupon;
      discountAmount = calcDiscountAmount(couponResult.eligibleSubtotal, couponInfo);
    }

    const totalAmount = subtotal - discountAmount;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          status: "PLACED",
          totalAmount,
          orderType,
          firstName: billing.firstName,
          lastName: billing.lastName,
          phone: billing.phone,
          paymentMethod: "COD",
          userId: session?.user?.id ?? null,
          couponCode: couponInfo?.code ?? null,
          discountAmount,
          ...(orderType === "DELIVERY"
            ? {
                email: billing.email,
                country: billing.country,
                address: billing.address,
                apartment: billing.apartment || null,
                city: billing.city,
                state: billing.state,
                zip: billing.zip,
                shippingMethod: shippingMethod as ShippingMethod,
              }
            : {
                tableId: validatedTableId,
              }),
          items: {
            create: resolvedItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
        include: { items: { include: { menuItem: true } }, table: true },
      });

      if (couponInfo) {
        const claimed = await consumeCoupon(tx, couponInfo.id, created.id, customerKey, discountAmount);
        if (!claimed) {
          // Someone else claimed this exact code in the moment between our
          // pre-check and now — abort the whole order, not just the
          // discount, so the customer isn't silently charged full price
          // for what they believed was a discounted order.
          throw new Error("COUPON_ALREADY_USED");
        }
      }

      return created;
    });

    // Dine-in orders never collect an email address, so there's nothing to
    // send a confirmation to — the customer just watches /track/[orderId]
    // (or the kitchen calls their name/table).
    //
    // Note: address/city/state/zip/shippingMethod/email are typed nullable
    // by Prisma now (optional as of QR Table Ordering), but validateBilling
    // above guarantees they're populated for a DELIVERY order — the `as
    // string` casts here reflect that already-checked invariant, not an
    // unchecked assumption.
    if (orderType === "DELIVERY" && order.email) {
      await sendOrderConfirmationEmail({
        id: order.id,
        email: order.email as string,
        firstName: order.firstName,
        address: order.address as string,
        city: order.city as string,
        state: order.state as string,
        zip: order.zip as string,
        totalAmount: order.totalAmount,
        shippingMethod: order.shippingMethod as string,
        paymentMethod: order.paymentMethod,
        items: order.items,
      });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "COUPON_ALREADY_USED") {
      return NextResponse.json(
        { error: "This coupon was just used by someone else. Please remove it and try again." },
        { status: 409 }
      );
    }
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}