import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
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
import { ZERO, sum, toMoney, toStripeMinorUnits, type Money } from "@/lib/money";
import { parseBody } from "@/lib/validations/parse";
import { createCheckoutSessionSchema } from "@/lib/validations/checkout";
import { sendOrderConfirmationEmail } from "@/lib/send-order-confirmation-email";

/**
 * src/app/api/checkout/create-session/route.ts
 *
 * POST -> শুধুমাত্র "Online Payment" checkout-এর জন্য। আগে আমাদের DB-তে
 * paymentStatus PENDING নিয়ে Order তৈরি করে (তখনো কোনো charge হয়নি),
 * তারপর Stripe Checkout Session বানিয়ে তার hosted URL ফেরত দেয় যাতে
 * client redirect করতে পারে। আসল card details Stripe নিজেদের পেজে নেয়
 * ও যাচাই করে — আমরা কখনো raw card data দেখি না বা রাখি না।
 *
 * Order শুধুমাত্র তখনই PAID হয় এবং confirmation email শুধু তখনই যায়
 * যখন /api/webhooks/stripe একটা verified checkout.session.completed
 * event পায়। client-side "success" redirect কখনোই payment-এর প্রমাণ
 * হিসেবে বিশ্বাস করা হয় না।
 *
 * marketingConsent এখানেই capture করা হয় (শুধু /api/orders-এ নয়), কারণ
 * online payment-এর Order row আসলে এখানেই তৈরি হয় — webhook পরে শুধু
 * সেই row UPDATE করে, customer-এর দেওয়া কোনো field সেট করে না। এই route
 * না নিলে webhook যখন পড়তো তখন order.marketingConsent সবসময় false থাকতো।
 *
 * ⚠️ পরিচিত সীমাবদ্ধতা — coupon আর gift card এখানেই, অর্থাৎ payment
 * নিশ্চিত হওয়ার আগেই দাবি করা হয়। customer Stripe পেজ ছেড়ে চলে গেলে
 * checkout.session.expired webhook এখন cancelOrder() ডাকে, যা stock,
 * coupon usageCount আর gift card balance — তিনটেই ফেরত দেয়। তাই
 * abandonment-এ আর মূল্য হারায় না।
 *
 * তবু দাবিটা webhook-এ সরানোই বেশি পরিষ্কার হতো, কারণ তখন reversal-এর
 * দরকারই পড়তো না। "webhook pre-discount subtotal জানে না" বলে আগে যে
 * আপত্তি লেখা ছিল সেটা আসলে ভুল — couponCode, discountAmount,
 * giftCardCode, giftCardAmount চারটাই Order row-তে সংরক্ষিত থাকে, তাই
 * webhook-এর কাছে দাবি করার মতো সব তথ্যই আছে। পরবর্তী refactor হিসেবে
 * রাখা হলো।
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, createCheckoutSessionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { items, billing, shippingMethod, couponCode, giftCardCode, redeemPoints, tipAmount, tipPercent } =
      parsed;

    const billingError = validateBilling(billing);
    if (billingError) {
      return NextResponse.json({ error: billingError }, { status: 400 });
    }

    const resolution = await resolveOrderItems(items);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.error }, { status: 409 });
    }
    const resolvedItems = resolution.items;

    const pricingSettings = await getPricingSettings();

    const session = await auth();
    const customerKey = getCustomerKey(session?.user?.id, billing.phone);

    // Fetched once up front — both the tier discount and the points
    // redemption below need the same balance, avoids two redundant round
    // trips within this single request.
    const currentUser = session?.user?.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { loyaltyPoints: true },
        })
      : null;

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

    // দুই ধাপে দাম হিসাব — কেন, তার পূর্ণ ব্যাখ্যা /api/orders/route.ts-এ।

    // Automatic loyalty-tier discount — see the identical logic (and its
    // full rationale) in /api/orders/route.ts.
    const tierDiscountPercent = currentUser
      ? getTierForPoints(currentUser.loyaltyPoints).discountPercent
      : 0;

    // এই route সবসময় DELIVERY — dine-in কখনো Stripe-এ যায় না (উপরের doc
    // comment দ্রষ্টব্য), তাই delivery fee আর delivery-র কর হার প্রযোজ্য।
    const beforePrepaid = calculateOrderPricing(
      {
        orderType: "DELIVERY",
        items: resolvedItems,
        couponDiscount: discountAmount,
        tierDiscountPercent,
      },
      pricingSettings
    );

    let giftCardInfo: GiftCardInfo | null = null;
    let giftCardAmount: Money = ZERO;
    if (giftCardCode?.trim()) {
      const giftCardResult = await findValidGiftCard(giftCardCode);
      if (!giftCardResult.ok) {
        return NextResponse.json({ error: giftCardResult.error }, { status: 409 });
      }
      giftCardInfo = giftCardResult.giftCard;
      giftCardAmount = calcGiftCardAmountToApply(beforePrepaid.grandTotal, giftCardInfo.balance);
    }

    // Loyalty points redemption — see /api/orders/route.ts for the full
    // rationale. Same silent-clamp behaviour: an invalid/stale request
    // just redeems nothing rather than failing checkout.
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

    const priced = calculateOrderPricing(
      {
        orderType: "DELIVERY",
        items: resolvedItems,
        couponDiscount: discountAmount,
        tierDiscountPercent,
        giftCardRequested: giftCardAmount,
        pointsRedeemedRequested: pointsRedeemedAmount,
        tipAmount,
        tipPercent,
      },
      pricingSettings
    );

    giftCardAmount = priced.giftCardAmount;
    pointsRedeemedAmount = priced.pointsRedeemedAmount;

    // Stripe খুব ছোট অঙ্ক charge করে না। coupon + tier discount + gift
    // card + points redemption মিলিয়ে পুরো bill ঢেকে ফেললে চার্জ করার
    // মতো কিছুই থাকে না — আগে তবুও Stripe session বানানোর চেষ্টা হতো, আর
    // customer ঠিক সেই মুহূর্তে একটা কঠিন error পেতো যখন সবচেয়ে মসৃণ
    // অভিজ্ঞতা আশা করছিল। অথচ ততক্ষণে তার balance debit হয়ে গেছে।
    //
    // ⚠️ সীমাটা এখন minor unit-এ, "0.5" নয়। ৫০ সেন্ট মানে ৫০ ইয়েন নয়,
    // আর ০.৫ ইয়েন বলে কিছু নেই — পুরোনো hardcoded 0.5 জাপানে কার্যত
    // প্রতিটা order-কেই "fully covered" ধরে নিতো না, বরং উল্টো: ¥০.৪৯-এর
    // মতো অসম্ভব অঙ্ক ছাড়া কিছুই ধরা পড়তো না।
    //
    // ৫০ minor unit Stripe-এর প্রকাশিত সর্বনিম্নের কাছাকাছি অনুমান
    // (USD ৫০¢, JPY ¥৫০, GBP ৩০p)। মুদ্রাভেদে হুবহু মিলবে না — নিচের
    // সীমার ঠিক উপরে কিন্তু Stripe-এর সীমার নিচে পড়া কোনো অঙ্ক এখনো
    // Stripe থেকে error পাবে। বিরল, কিন্তু জানা সীমাবদ্ধতা।
    const STRIPE_MINIMUM_MINOR_UNITS = 50;

    const chargeableMinorUnits = toStripeMinorUnits(
      priced.totalAmount,
      pricingSettings.currencyMinorUnits
    );

    // ⚠️ tip এখানে গুরুত্বপূর্ণ: বিল পুরোটা gift card-এ মিটে গেলেও গ্রাহক
    // যদি বকশিশ দেন তবে totalAmount > 0, তাই Stripe লাগবেই। তাই শর্তটা
    // grandTotal-এর নয়, totalAmount-এর উপর — যাতে বকশিশের টাকা চুপচাপ
    // হারিয়ে না যায়।
    const isFullyCoveredByDiscounts = chargeableMinorUnits < STRIPE_MINIMUM_MINOR_UNITS;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          status: "PLACED",
          ...pricingToOrderFields(priced),
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
          // পুরো bill discounts-এ ঢাকা পড়লে কোনো Stripe charge হবেই না,
          // তাই এই order-এর জন্য কোনো webhook-ও কখনো আসবে না — সেক্ষেত্রে
          // এখানেই PAID লিখতে হয়। নাহলে order চিরকাল PENDING থেকে যেতো
          // এবং assign-rider-এর নতুন payment check এটাকে dispatch হতে
          // দিত না, যদিও গ্রাহক পুরো টাকাই দিয়ে ফেলেছেন।
          paymentStatus: isFullyCoveredByDiscounts ? "PAID" : "PENDING",
          userId: session?.user?.id ?? null,
          couponCode: couponInfo?.code ?? null,
          giftCardCode: giftCardInfo?.code ?? null,
          pointsRedeemed: pointsToRedeem,
          // এখনই সংরক্ষণ করা হচ্ছে যাতে webhook যখন payment নিশ্চিত করে
          // পড়ে তখন row-তে আগে থেকেই থাকে — উপরের doc comment দ্রষ্টব্য।
          marketingConsent: billing.marketingConsent ?? false,
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

      if (couponInfo) {
        const claimed = await consumeCoupon(
          tx,
          couponInfo.id,
          created.id,
          customerKey,
          priced.discountAmount
        );
        if (!claimed) throw new Error("COUPON_ALREADY_USED");
      }

      if (giftCardInfo && giftCardAmount.greaterThan(0)) {
        const redeemed = await redeemGiftCard(tx, giftCardInfo.id, created.id, giftCardAmount);
        if (!redeemed) throw new Error("GIFT_CARD_RACE");
      }

      if (pointsToRedeem > 0 && session?.user?.id) {
        const redeemed = await redeemLoyaltyPoints(
          tx,
          session.user.id,
          created.id,
          pointsToRedeem,
          pointsRedeemedAmount
        );
        if (!redeemed) throw new Error("POINTS_REDEMPTION_RACE");
      }

      return created;
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Discounts-এ পুরোটা ঢাকা: Stripe-এর কিছুই করার নেই। এই path-এ কোনো
    // webhook আসবে না, তাই confirmation email-ও এখানেই পাঠাতে হয়।
    if (isFullyCoveredByDiscounts) {
      try {
        await sendOrderConfirmationEmail(order);
      } catch (error) {
        // Order তৈরি ও paid হয়ে গেছে — email ব্যর্থ হলে সেটা customer-কে
        // "checkout failed" দেখানোর কারণ নয়, কারণ retry করলে সে আরেকটা
        // order বানাবে আর gift card দ্বিতীয়বার debit হবে। webhook-এর
        // handleOrderPaid-এ ঠিক একই যুক্তি।
        console.error("Confirmation email failed for gift-card-paid order", order.id, error);
      }

      return NextResponse.json(
        { url: `${appUrl}/track/${order.id}?payment=success`, orderId: order.id },
        { status: 201 }
      );
    }

    const stripe = getStripeClient();

    // Discount Stripe-এর দিকেও প্রয়োগ করা হয়, এই একটা session-এর জন্য
    // তৈরি এককালীন Stripe-native coupon দিয়ে (duration: "once") — প্রতিটা
    // line item-এর unit_amount হাতে সমন্বয় করার বদলে, যেটার জন্য নিজস্ব
    // cent-rounding logic লাগতো শুধু উপরে হিসাব করা মোট অঙ্কে পৌঁছাতে।
    //
    // Stripe Checkout Session (payment mode) একটাই `discounts` entry নেয়,
    // তাই coupon discount আর gift-card amount দুটো মিলিয়ে একটাই Stripe
    // coupon বানানো হয় — amount_off = discountAmount + giftCardAmount।
    // আমাদের নিজের DB total-ও ঠিক একইভাবে দুটো বাদ দিয়ে হিসাব করা, তাই
    // যেটাই (বা দুটোই) প্রযোজ্য হোক, দুই দিক মিলে থাকে।
    //
    // সবসময় amount_off (সেন্টে) দিয়ে বানানো হয়, percent_off দিয়ে নয় —
    // এতেই maxDiscountAmount cap আর FIXED-type coupon Stripe-এর hosted
    // পেজেও সঠিকভাবে বসে, শুধু আমাদের DB total-এ নয়। সাধারণ percent_off
    // coupon cap আর fixed-amount দুটোকেই উপেক্ষা করতো।
    //
    // Stripe amount_off-এ ধনাত্মক পূর্ণসংখ্যা চায়, তাই শূন্যে নেমে আসা
    // combined discount পাঠানোই হয় না। tierDiscountAmount আর
    // pointsRedeemedAmount দুটোও এখানে যোগ হয় — আমাদের নিজের DB total এই
    // চারটে বাদ দিয়েই হিসাব করা, তাই Stripe-এর charge ঠিক ততটাই কমতে
    // হবে যতটা আমাদের total কমেছে।
    const stripeCurrency = pricingSettings.currency.toLowerCase();
    const minorUnits = pricingSettings.currencyMinorUnits;
    const toMinor = (amount: Money) => toStripeMinorUnits(amount, minorUnits);

    // ── Stripe-এ পাঠানো line item ────────────────────────────────────────
    //
    // খাবারের লাইনগুলোর পর কর, service charge, delivery fee আর বকশিশ
    // আলাদা line item হিসেবে যায়। আগে শুধু খাবারই যেতো, তাই Stripe-এর
    // হিসাব করা মোট আর আমাদের totalAmount আলাদা হতো — এখন কর/fee/tip
    // যুক্ত হওয়ায় পার্থক্যটা আর "শূন্য" থাকতো না, গ্রাহক কম টাকা দিয়ে
    // চলে যেতেন।
    //
    // ⚠️ INCLUSIVE mode-এ করের কোনো আলাদা লাইন যায় না, ইচ্ছাকৃতভাবে:
    // সেখানে কর ইতিমধ্যে প্রতিটা খাবারের দামের ভেতরে। আলাদা লাইন দিলে
    // ইউরোপ/জাপানে প্রতিটা গ্রাহকের কাছ থেকে কর দুবার আদায় হতো।
    const extraLine = (label: string, amount: Money) =>
      amount.greaterThan(0)
        ? [
            {
              quantity: 1,
              price_data: {
                currency: stripeCurrency,
                unit_amount: toMinor(amount),
                product_data: { name: label },
              },
            },
          ]
        : [];

    const lineItems = [
      ...resolvedItems.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: stripeCurrency,
          // Stripe সবচেয়ে ছোট একক চায়। গুণকটা settings থেকে আসে, কোডে
          // লেখা 100 নয় — ¥1,200 এখন 1200 হয়ে যায়, 120000 নয়।
          unit_amount: toMinor(toMoney(i.price)),
          product_data: { name: i.title },
        },
      })),
      ...extraLine("Service charge", priced.serviceCharge),
      ...extraLine("Delivery", priced.deliveryFee),
      ...(priced.taxMode === "EXCLUSIVE" ? extraLine(priced.taxName, priced.taxAmount) : []),
      ...extraLine("Tip", priced.tipAmount),
    ];

    // Discount Stripe-এর দিকেও প্রয়োগ করা হয়, এই একটা session-এর জন্য
    // তৈরি এককালীন Stripe-native coupon দিয়ে (duration: "once") — প্রতিটা
    // line item-এর unit_amount হাতে সমন্বয় করার বদলে, যেটার জন্য নিজস্ব
    // rounding logic লাগতো শুধু উপরে হিসাব করা মোট অঙ্কে পৌঁছাতে।
    //
    // Stripe Checkout Session (payment mode) একটাই `discounts` entry নেয়,
    // তাই coupon, tier discount, gift card আর point — চারটেই মিলিয়ে
    // একটাই Stripe coupon বানানো হয়। আমাদের নিজের totalAmount-ও ঠিক এই
    // চারটে বাদ দিয়েই হিসাব করা, তাই দুই দিক মিলে থাকে।
    //
    // সবসময় amount_off দিয়ে বানানো হয়, percent_off দিয়ে নয় — এতেই
    // maxDiscountAmount cap আর FIXED-type coupon Stripe-এর hosted পেজেও
    // সঠিকভাবে বসে, শুধু আমাদের DB total-এ নয়।
    const combinedDiscountMinor = toMinor(
      sum(
        priced.discountAmount,
        priced.tierDiscountAmount,
        priced.giftCardAmount,
        priced.pointsRedeemedAmount
      )
    );

    const stripeDiscounts =
      combinedDiscountMinor > 0
        ? [
            {
              coupon: (
                await stripe.coupons.create({
                  amount_off: combinedDiscountMinor,
                  currency: stripeCurrency,
                  duration: "once",
                  // এই coupon একটামাত্র session-এর জন্য। এটা ছাড়া প্রতিটা
                  // discounted order Stripe account-এ একটা করে চিরস্থায়ী,
                  // পুনঃব্যবহারযোগ্য coupon object রেখে যেতো — কয়েক হাজার
                  // order পরে dashboard-এর coupon তালিকা অব্যবহার্য হয়ে
                  // যায়, আর কেউ id জেনে গেলে সেটা আবার প্রয়োগ করতে পারতো।
                  max_redemptions: 1,
                  // ইচ্ছাকৃতভাবে সাধারণ নাম। আগে এখানে coupon code আর gift
                  // card code জোড়া দেওয়া হতো, ফলে customer-এর gift card
                  // code Stripe-এর hosted পেজে এবং dashboard/report-এ
                  // দেখা যেতো।
                  name: "Discount",
                })
              ).id,
            },
          ]
        : undefined;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: billing.email,
        line_items: lineItems,
        discounts: stripeDiscounts,
        metadata: { orderId: order.id },
        success_url: `${appUrl}/track/${order.id}?payment=success`,
        cancel_url: `${appUrl}/carts?payment=cancelled`,
      },
      // এই Order-এর জন্য ঠিক একটাই Checkout Session। network hiccup-এ
      // SDK নিজে থেকে retry করলে বা একই order-এ কোনোভাবে দ্বিতীয়বার call
      // হলে Stripe নতুন session না বানিয়ে আগেরটাই ফেরত দেয় — নাহলে একই
      // order-এর দুটো live session থেকে দুবার charge হওয়া সম্ভব হতো।
      { idempotencyKey: `checkout_${order.id}` }
    );

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json({ url: checkoutSession.url, orderId: order.id }, { status: 201 });
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
    console.error("POST /api/checkout/create-session error:", error);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}