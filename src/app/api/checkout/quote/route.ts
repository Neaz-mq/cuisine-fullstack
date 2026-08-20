import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  resolveOrderItems,
  findValidCoupon,
  calcDiscountAmount,
  getCustomerKey,
  type CouponInfo,
} from "@/lib/order-checkout-shared";
import { findValidGiftCard, calcGiftCardAmountToApply, type GiftCardInfo } from "@/lib/gift-cards";
import { getTierForPoints } from "@/lib/loyalty-tiers";
import { clampPointsRedemption } from "@/lib/loyalty-redemption";
import { getPricingSettings } from "@/lib/get-settings";
import { calculateOrderPricing } from "@/lib/pricing";
import { ZERO, serializeMoney, type Money } from "@/lib/money";
import { quoteSchema } from "@/lib/validations/checkout";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/checkout/quote
 *
 * গ্রাহকের বর্তমান cart-এর পূর্ণ বিল — কর, service charge, delivery fee,
 * ছাড়, gift card, point আর বকশিশ সমেত। কিছুই লেখে না।
 *
 * ── কেন এটা দরকার হলো ────────────────────────────────────────────────
 *
 * আগে Carts.tsx নিজেই টাকার হিসাব করত: subtotal, coupon discount, tier
 * discount, gift card, points — প্রতিটার জন্য server-এর যুক্তির একটা
 * করে "display-only mirror" client-এ লেখা ছিল। কাজ করত, কারণ দুই দিকের
 * নিয়ম একই ছিল।
 *
 * money model আসার পর সেটা আর সত্য নয়। এখন বিলে কর, service charge,
 * delivery fee আর বকশিশও আছে — যার হার settings-এ বসে, আর client সেগুলো
 * জানেই না। ফলে গ্রাহক দেখতেন ১০০, আর Stripe কাটত ১০৫। এটা সবচেয়ে খারাপ
 * ধরনের গরমিল, কারণ ধরা পড়ে টাকা কেটে নেওয়ার পরে।
 *
 * তাই hisab-টা এখানে সরানো হলো, আর client শুধু দেখায়। /api/orders আর
 * /api/checkout/create-session ঠিক এই একই ধাপগুলোই চালায় — একই
 * resolveOrderItems, একই findValidCoupon, একই calculateOrderPricing।
 * অর্থাৎ গ্রাহক যা দেখেন আর যা চার্জ হয়, দুটো আলাদা হওয়ার পথই নেই।
 *
 * ⚠️ এটা একটা quote, কোনো সংরক্ষণ নয়। gift card এখানে debit হয় না,
 * coupon-এর ব্যবহারও গোনা হয় না — সেসব হয় order তৈরির transaction-এর
 * ভেতরে, যেখানে concurrency guard আছে। দুটো ট্যাবে একই gift card quote
 * করা যায়, কিন্তু খরচ হবে একবারই।
 *
 * ── কেন এখানে rate limit ─────────────────────────────────────────────
 *
 * /api/coupons/validate আর /api/gift-cards/validate — দুটোতেই কোড
 * brute-force ঠেকাতে limit বসানো আছে। কিন্তু এই endpoint-টা couponCode
 * আর giftCardCode দুটোই নেয় আর বলে দেয় সেগুলো বৈধ কিনা, অথচ এখানে
 * কোনো limit ছিল না। অর্থাৎ ওই দুটো limit কার্যত পাশ কাটানো যেতো —
 * শুধু অন্য একটা URL-এ একই প্রশ্ন করে।
 *
 * ── কিন্তু একটাই সংখ্যা এখানে চলে না ─────────────────────────────────
 *
 * Carts.tsx প্রতিটা cart পরিবর্তনে quote চায় — quantity বদল, বকশিশের
 * ঘরে টাইপ, ছাড় প্রয়োগ, সবেতেই (৩০০ms debounce সহ)। একজন সাধারণ
 * গ্রাহক checkout করতে করতে সহজেই ২০–৪০টা quote চাইতে পারেন। তাই
 * validate endpoint-গুলোর মতো ২০/মিনিট বসালে আসল গ্রাহকই আটকে যেতেন।
 *
 * তাই দুটো আলাদা bucket, কারণ প্রশ্ন দুটোও আলাদা:
 *
 *   • নিজের cart-এর দাম জানতে চাওয়া — ঘন ঘন ও বৈধ, তাই উদার সীমা
 *   • কোনো কোড সঙ্গে পাঠানো — সেটাই আসলে "এই কোডটা কি খাটে?" প্রশ্ন,
 *     তাই validate endpoint-গুলোর সমান বাজেট
 */
export async function POST(req: NextRequest) {
  // উদার সীমা: cart বদলালেই নতুন quote লাগে, ওটা আক্রমণ নয়।
  const quoteLimit = checkRateLimit(req, "checkout-quote", {
    limit: 60,
    windowMs: 60_000,
  });
  if (!quoteLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(quoteLimit.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(req, quoteSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { items, orderType, couponCode, giftCardCode, redeemPoints, tipAmount, tipPercent, phone } =
    parsed;

  // কোড সঙ্গে থাকলে এটা কার্যত একটা validate call, তাই সেই endpoint-
  // গুলোর সমান বাজেট — আলাদা scope, যাতে উপরের উদার bucket-টা এই
  // কড়া হিসাবের সাথে মিশে না যায়।
  if (couponCode || giftCardCode) {
    const codeLimit = checkRateLimit(req, "checkout-quote-code", {
      limit: 20,
      windowMs: 60_000,
    });
    if (!codeLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(codeLimit.retryAfterSeconds) } }
      );
    }
  }

  const resolution = await resolveOrderItems(items);
  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.error }, { status: 409 });
  }
  const resolvedItems = resolution.items;

  const pricingSettings = await getPricingSettings();

  const session = await auth();
  const customerKey = getCustomerKey(session?.user?.id, phone);

  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { loyaltyPoints: true },
      })
    : null;

  // ── ছাড় ──────────────────────────────────────────────────────────────
  //
  // একটা অচল coupon এখানে error নয়, নীরব উপেক্ষা। quote প্রতিটা keystroke-এ
  // চলে; মেয়াদোত্তীর্ণ কোড থাকলে পুরো বিলটাই দেখানো বন্ধ হয়ে যাওয়া
  // অর্থহীন হতো। ভুল কোডের বার্তা /api/coupons/validate দেয়, যখন গ্রাহক
  // নিজে "Apply" চাপেন।
  let couponInfo: CouponInfo | null = null;
  let discountAmount: Money = ZERO;
  if (couponCode?.trim()) {
    const couponResult = await findValidCoupon(couponCode, resolvedItems, customerKey);
    if (couponResult.ok) {
      couponInfo = couponResult.coupon;
      discountAmount = calcDiscountAmount(couponResult.eligibleSubtotal, couponInfo);
    }
  }

  const tierDiscountPercent = currentUser
    ? getTierForPoints(currentUser.loyaltyPoints).discountPercent
    : 0;

  // ── দুই ধাপে দাম হিসাব ────────────────────────────────────────────────
  // কেন দুই ধাপ, তার পূর্ণ ব্যাখ্যা /api/orders/route.ts-এ।
  const beforePrepaid = calculateOrderPricing(
    { orderType, items: resolvedItems, couponDiscount: discountAmount, tierDiscountPercent },
    pricingSettings
  );

  let giftCardInfo: GiftCardInfo | null = null;
  let giftCardRequested: Money = ZERO;
  if (giftCardCode?.trim()) {
    const giftCardResult = await findValidGiftCard(giftCardCode);
    if (giftCardResult.ok) {
      giftCardInfo = giftCardResult.giftCard;
      giftCardRequested = calcGiftCardAmountToApply(
        beforePrepaid.grandTotal,
        giftCardInfo.balance
      );
    }
  }

  let pointsToRedeem = 0;
  let pointsRedeemedRequested: Money = ZERO;
  if (currentUser && redeemPoints && redeemPoints > 0) {
    const clamped = clampPointsRedemption(
      redeemPoints,
      currentUser.loyaltyPoints,
      beforePrepaid.grandTotal.minus(giftCardRequested)
    );
    pointsToRedeem = clamped.points;
    pointsRedeemedRequested = clamped.amount;
  }

  const priced = calculateOrderPricing(
    {
      orderType,
      items: resolvedItems,
      couponDiscount: discountAmount,
      tierDiscountPercent,
      giftCardRequested,
      pointsRedeemedRequested,
      tipAmount,
      tipPercent,
    },
    pricingSettings
  );

  const units = pricingSettings.currencyMinorUnits;
  const m = (value: Money) => serializeMoney(value, units);

  // Decimal সরাসরি JSON-এ দিলে string হয়ে যায় আর client-এ .toFixed()
  // ভেঙে পড়ে। serializeMoney-ও string দেয়, কিন্তু জেনেশুনে — আর ঠিক
  // ততগুলো দশমিক নিয়ে যতগুলো এই currency-তে থাকা উচিত।
  return NextResponse.json({
    currency: priced.currency,
    currencyMinorUnits: units,

    taxName: priced.taxName,
    taxMode: priced.taxMode,
    tipEnabled: pricingSettings.tipEnabled,

    subtotal: m(priced.subtotal),
    discountAmount: m(priced.discountAmount),
    tierDiscountAmount: m(priced.tierDiscountAmount),
    serviceCharge: m(priced.serviceCharge),
    deliveryFee: m(priced.deliveryFee),
    taxAmount: m(priced.taxAmount),
    grandTotal: m(priced.grandTotal),

    // প্রকৃতপক্ষে যতটা প্রয়োগ হয়েছে, চাওয়া পরিমাণ নয় — বিলের চেয়ে বড়
    // gift card বিল পর্যন্তই কাটে।
    giftCardAmount: m(priced.giftCardAmount),
    pointsRedeemedAmount: m(priced.pointsRedeemedAmount),
    pointsRedeemed: pointsToRedeem,

    tipAmount: m(priced.tipAmount),
    totalAmount: m(priced.totalAmount),

    // client যা চেয়েছিল তার সাথে server কী মেনে নিল, তা মেলানোর জন্য।
    appliedCouponCode: couponInfo?.code ?? null,
    appliedGiftCardCode: giftCardInfo?.code ?? null,
    // ⚠️ giftCardBalance এখান থেকে সরানো হয়েছে।
    //
    // কার্ডের অবশিষ্ট balance ফেরত যেতো, অথচ Carts.tsx সেটা কখনো
    // দেখাতো না — type-এ ঘোষিত ছিল, ব্যবহার হতো না। এই বিলে কতটা
    // কাটছে সেটা giftCardAmount-ই বলে, আর সেটাই গ্রাহকের দরকার।
    //
    // পার্থক্যটা হলো একটা কোড অনুমান করে ফেললে কতটা জানা যায়: শুধু
    // "কোডটা খাটে" নাকি "কোডটা খাটে এবং এতে ৳৫০০০ পড়ে আছে"।
  });
}
