import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireApiScopeAny } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";
import { syncCustomerToAudience } from "@/lib/resend";
import {
  SHIPPING_METHODS,
  ShippingMethod,
  validateBilling,
  resolveOrderItems,
  findValidCoupon,
  calcDiscountAmount,
  consumeCoupon,
  getCustomerKey,
  CouponInfo,
} from "@/lib/order-checkout-shared";
import {
  findValidGiftCard,
  calcGiftCardAmountToApply,
  redeemGiftCard,
  GiftCardInfo,
} from "@/lib/gift-cards";
import { getTierForPoints } from "@/lib/loyalty-tiers";
import { clampPointsRedemption, redeemLoyaltyPoints } from "@/lib/loyalty-redemption";
import { getPricingSettings } from "@/lib/get-settings";
import { calculateOrderPricing, pricingToOrderFields } from "@/lib/pricing";
import { ZERO, type Money } from "@/lib/money";
import { parseBody } from "@/lib/validations/parse";
import { createOrderSchema } from "@/lib/validations/checkout";
import { paginationSchema } from "@/lib/validations/common";

/**
 * src/app/api/orders/route.ts
 *
 * GET  /api/orders   -> paginated order list for the admin dashboard
 *                        (staff with the "orders" or "kitchen" scope).
 *                        Accepts ?page= and ?limit= — see the note on the
 *                        handler for why this is not optional.
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

/**
 * Paginated. This used to return EVERY order ever placed, each with every
 * line item, each with the full MenuItem row — description, imageUrl and
 * all. At 5,000 orders averaging three items that's 15,000 nested objects
 * in one response: several megabytes to serialise inside a serverless
 * function with a 10-second ceiling. And it fails badly — no partial
 * result, just a request that never comes back.
 *
 * Note that /admin/orders/page.tsx does NOT call this endpoint; it's a
 * server component that queries Prisma directly and already paginates at
 * PAGE_SIZE = 10. So nothing was actually hitting the unbounded version
 * yet — but the endpoint is live, and the first caller to appear (a
 * mobile client, an integration, a future refactor of that page) would
 * have inherited the problem silently.
 *
 * The scope check is requireApiScopeAny(["orders", "kitchen"]) because
 * the doc comment above always claimed kitchen staff could read this,
 * while the code only allowed "orders" and handed them a 403. The comment
 * described the intent correctly; the code was the bug.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireApiScopeAny(["orders", "kitchen"]);
    if (authResult instanceof NextResponse) return authResult;

    // paginationSchema coerces the string query params into bounded
    // numbers (page >= 1, limit <= 100) with defaults — so ?limit=99999
    // can't quietly restore the old unbounded behaviour.
    const { searchParams } = new URL(request.url);
    const parsedPagination = paginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsedPagination.success) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
    }
    const { page, limit } = parsedPagination.data;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // Only the fields a list view actually renders. Pulling the
          // whole MenuItem meant shipping a description and an image URL
          // for every line of every order — the bulk of the payload, and
          // none of it visible on screen.
          items: { include: { menuItem: { select: { id: true, title: true } } } },
          table: true,
        },
      }),
      prisma.order.count(),
    ]);

    // ⚠️ Shape change: this used to be a bare array. Callers now read
    // `data.orders`, and get the totals they need to render pagination.
    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Failed to fetch order list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // This endpoint is unauthenticated — guest checkout is deliberately
    // allowed (see Order.userId in schema.prisma) — and every successful
    // call adds a row to the kitchen board. With no limit at all, a
    // trivial script could fill that board in minutes, and for any menu
    // item with a configured recipe it would drain InventoryItem stock
    // along the way once those orders were advanced to PREPARING.
    //
    // 10 per 10 minutes per IP is far above anything a real customer
    // does (place an order, maybe re-place after a mistake) and far
    // below what makes automated abuse worthwhile.
    //
    // ⚠️ rate-limit.ts is process-local — see its own file comment. This
    // deters casual scripted abuse; it is not a hard distributed
    // guarantee, and shouldn't be relied on as one.
    const rateLimitResult = checkRateLimit(request, "create-order", {
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many orders from this device. Please wait a moment and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
        }
      );
    }

    const parsed = await parseBody(request, createOrderSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      items,
      billing,
      shippingMethod,
      orderType,
      tableId,
      couponCode,
      giftCardCode,
      redeemPoints,
      tipAmount,
      tipPercent,
    } = parsed;

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
        return NextResponse.json({ error: "Invalid shipping method" }, { status: 400 });
      }
    }

    const resolution = await resolveOrderItems(items);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.error }, { status: 409 });
    }
    const resolvedItems = resolution.items;

    // কর, service charge, delivery fee, currency, tip — সব এখান থেকে।
    // কোনোটাই কোডে hardcode করা নেই, কারণ কোনোটাই রেস্তোরাঁ সম্পর্কে
    // সত্য নয়; সবগুলোই রেস্তোরাঁটা কোন দেশে সেই সম্পর্কে সত্য।
    const pricingSettings = await getPricingSettings();

    const session = await auth();
    const customerKey = getCustomerKey(session?.user?.id, billing.phone);

    // Fetched once up front (not per-discount-step) since both the tier
    // discount and the points redemption below need the same balance —
    // avoids two redundant round trips for a value that can't have
    // changed between them within this single request.
    const currentUser = session?.user?.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { loyaltyPoints: true },
        })
      : null;

    // Pre-check outside the transaction purely for a fast, friendly error
    // message — the actual claim (and the only real concurrency guard)
    // happens inside the transaction via consumeCoupon below.
    let couponInfo: CouponInfo | null = null;
    let discountAmount: Money = ZERO;
    if (couponCode?.trim()) {
      const couponResult = await findValidCoupon(couponCode, resolvedItems, customerKey);
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error }, { status: 409 });
      }
      couponInfo = couponResult.coupon;
      discountAmount = calcDiscountAmount(couponResult.eligibleSubtotal, couponInfo);
    }

    // Automatic loyalty-tier discount — no code needed, unlike the coupon
    // above. Guests (no session) are always Bronze (0%), so this is a
    // no-op for guest checkout. Applied against what's left after the
    // coupon, so the two never double-discount the same dollar.
    // Automatic loyalty-tier discount — no code needed, unlike the coupon
    // above. Guests (no session) are always Bronze (0%), so this is a
    // no-op for guest checkout.
    //
    // অঙ্ক নয়, শতাংশটাই pricing-এ পাঠানো হয় — টাকার হিসাব একমাত্র
    // calculateOrderPricing করে, Decimal-এ, currency জেনে।
    const tierDiscountPercent = currentUser
      ? getTierForPoints(currentUser.loyaltyPoints).discountPercent
      : 0;

    // ── দুই ধাপে দাম হিসাব ───────────────────────────────────────────────
    //
    // Gift card আর point বিলের বিপরীতে খরচ হয়, অথচ বিলটা নিজেই কর আর
    // service charge যোগ হওয়ার পরে চূড়ান্ত হয় — তাই একবারে হিসাব করা
    // যায় না।
    //
    //   ধাপ ১: prepaid কিছু ছাড়াই দাম কষে grandTotal বের করা
    //   ধাপ ২: সেই grandTotal-এর বিপরীতে gift card ও point কতটা খাটবে
    //          ঠিক করে আবার পুরো হিসাব চালানো
    //
    // ধাপ ১ কেবল হিসাব, কোনো DB call নেই — তাই দুবার চালানো সস্তা।
    const beforePrepaid = calculateOrderPricing(
      {
        orderType,
        items: resolvedItems,
        couponDiscount: discountAmount,
        tierDiscountPercent,
      },
      pricingSettings
    );

    // Pre-check outside the transaction purely for a fast, friendly error
    // message — the actual claim (and the only real concurrency guard)
    // happens inside the transaction via redeemGiftCard below.
    let giftCardInfo: GiftCardInfo | null = null;
    let giftCardAmount: Money = ZERO;
    if (giftCardCode?.trim()) {
      const giftCardResult = await findValidGiftCard(giftCardCode);
      if (!giftCardResult.ok) {
        return NextResponse.json({ error: giftCardResult.error }, { status: 409 });
      }
      giftCardInfo = giftCardResult.giftCard;
      // grandTotal-এর বিপরীতে, subtotal-এর নয় — কর আর service charge-ও
      // gift card দিয়ে দেওয়া যায়, ওগুলোও বিলেরই অংশ।
      giftCardAmount = calcGiftCardAmountToApply(beforePrepaid.grandTotal, giftCardInfo.balance);
    }

    // Loyalty points redemption — spends down what's left after every
    // other discount, same "last in line" position as a store-credit
    // wallet at most retailers. Guests never redeem (no account to hold
    // a balance on); clampPointsRedemption below silently returns
    // {points: 0, amount: 0} for anything invalid rather than erroring,
    // so a stale/racy client request just redeems nothing instead of
    // failing the whole order.
    let pointsToRedeem = 0;
    let pointsRedeemedAmount: Money = ZERO;
    if (currentUser && redeemPoints && redeemPoints > 0) {
      const clamped = clampPointsRedemption(
        redeemPoints,
        currentUser.loyaltyPoints,
        beforePrepaid.grandTotal.minus(giftCardAmount)
      );
      pointsToRedeem = clamped.points;
      pointsRedeemedAmount = clamped.amount;
    }

    // ধাপ ২ — চূড়ান্ত হিসাব। এই একটা object-ই Order row-তে লেখা হবে,
    // তাই গ্রাহক যা দেখে আর DB-তে যা জমা হয় দুটো আলাদা হওয়ার সুযোগ নেই।
    const priced = calculateOrderPricing(
      {
        orderType,
        items: resolvedItems,
        couponDiscount: discountAmount,
        tierDiscountPercent,
        giftCardRequested: giftCardAmount,
        pointsRedeemedRequested: pointsRedeemedAmount,
        tipAmount: tipAmount,
        tipPercent: tipPercent,
      },
      pricingSettings
    );

    // pricing নিজেই বিলের চেয়ে বেশি হলে কেটে ছোট করে, আর সেই কাটা
    // পরিমাণটাই ledger-এ লেখা হতে হবে — নইলে কার্ড থেকে বেশি কেটে নেওয়া
    // হতো। তাই নিচের সব জায়গায় priced.* ব্যবহার হচ্ছে, উপরের চাওয়া
    // পরিমাণ নয়।
    giftCardAmount = priced.giftCardAmount;
    pointsRedeemedAmount = priced.pointsRedeemedAmount;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          status: "PLACED",
          ...pricingToOrderFields(priced),
          orderType,
          firstName: billing.firstName,
          lastName: billing.lastName,
          phone: billing.phone,
          paymentMethod: "COD",
          userId: session?.user?.id ?? null,
          couponCode: couponInfo?.code ?? null,
          giftCardCode: giftCardInfo?.code ?? null,
          pointsRedeemed: pointsToRedeem,
          // Defaults to false (opt-in, never opt-out by default) if the
          // client omits it entirely.
          marketingConsent: billing.marketingConsent ?? false,
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
        const claimed = await consumeCoupon(
          tx,
          couponInfo.id,
          created.id,
          customerKey,
          priced.discountAmount
        );
        if (!claimed) {
          // Someone else claimed this exact code in the moment between our
          // pre-check and now — abort the whole order, not just the
          // discount, so the customer isn't silently charged full price
          // for what they believed was a discounted order.
          throw new Error("COUPON_ALREADY_USED");
        }
      }

      if (giftCardInfo && giftCardAmount.greaterThan(0)) {
        const redeemed = await redeemGiftCard(tx, giftCardInfo.id, created.id, giftCardAmount);
        if (!redeemed) {
          // Same race as the coupon check above — someone else spent the
          // balance we were counting on between the pre-check and now.
          throw new Error("GIFT_CARD_RACE");
        }
      }

      if (pointsToRedeem > 0 && session?.user?.id) {
        const redeemed = await redeemLoyaltyPoints(
          tx,
          session.user.id,
          created.id,
          pointsToRedeem,
          pointsRedeemedAmount
        );
        if (!redeemed) {
          // Same race pattern — the balance changed (e.g. another tab
          // redeeming, or an admin adjustment) between the pre-check and
          // now.
          throw new Error("POINTS_REDEMPTION_RACE");
        }
      }

      return created;
    });

    // ⚠️ The transaction has COMMITTED by this point. The order exists,
    // the coupon is claimed, the gift card is debited. Nothing below may
    // be allowed to throw into the outer catch, because that returns a
    // 500 and the customer sees "Failed to place order" for an order that
    // fully succeeded — so they submit again, and now there's a duplicate
    // in the kitchen queue, their gift card is debited twice, and the
    // coupon comes back as "already used by someone else" when in fact
    // they used it themselves seconds ago.
    //
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
      try {
        await sendOrderConfirmationEmail({
          id: order.id,
          email: order.email as string,
          firstName: order.firstName,
          address: order.address as string,
          city: order.city as string,
          state: order.state as string,
          zip: order.zip as string,

          // পুরো চালান — order row থেকে সরাসরি, কিছুই পুনর্গণনা নয়।
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          tierDiscountAmount: order.tierDiscountAmount,
          serviceCharge: order.serviceCharge,
          deliveryFee: order.deliveryFee,
          taxAmount: order.taxAmount,
          taxName: order.taxName,
          taxMode: order.taxMode,
          giftCardAmount: order.giftCardAmount,
          pointsRedeemedAmount: order.pointsRedeemedAmount,
          tipAmount: order.tipAmount,
          totalAmount: order.totalAmount,
          currency: order.currency,

          shippingMethod: order.shippingMethod as string,
          paymentMethod: order.paymentMethod,
          items: order.items,
        });
      } catch (error) {
        // Same reasoning as the Stripe webhook's handleOrderPaid: log it
        // (Sentry picks this up) and move on. A confirmation email is
        // worth far less than a correctly recorded order.
        console.error("Confirmation email failed for order", order.id, error);
      }

      // Marketing sync rides the same conditional as the confirmation
      // email on purpose — both need order.email, and COD/DINE_IN orders
      // never have one. syncCustomerToAudience() swallows its own errors
      // (see resend.ts); the try/catch here also covers the user update
      // that follows it.
      if (order.marketingConsent) {
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
          console.error("Marketing audience sync failed for order", order.id, error);
        }
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "COUPON_ALREADY_USED") {
      return NextResponse.json(
        { error: "This coupon was just used by someone else. Please remove it and try again." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "GIFT_CARD_RACE") {
      return NextResponse.json(
        { error: "This gift card's balance just changed. Please remove it and try again." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "POINTS_REDEMPTION_RACE") {
      return NextResponse.json(
        { error: "Your points balance just changed. Please try again." },
        { status: 409 }
      );
    }
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}