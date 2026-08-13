import {
  type Money,
  ZERO,
  toMoney,
  sum,
  minMoney,
  clampToZero,
  roundMoney,
  applyRate,
  extractInclusiveTax,
} from "@/lib/money";

/**
 * src/lib/pricing.ts
 *
 * একটা order-এর বিল কীভাবে তৈরি হয়, তার একমাত্র উৎস।
 *
 * আগে হিসাবটা ছড়িয়ে ছিল: /api/orders/route.ts আর
 * /api/checkout/create-session/route.ts দুই জায়গায় প্রায় একই কোড, দুটোই
 * শেষ হতো `totalAfterGiftCard - pointsRedeemedAmount` দিয়ে। কর, service
 * charge, delivery fee বা tip-এর কোনো ধারণাই ছিল না — আর দুই জায়গায়
 * আলাদা করে সেগুলো যোগ করা মানে অবধারিতভাবে একদিন দুটো ভিন্ন উত্তর, যার
 * একটা customer দেখবে আর অন্যটা Stripe চার্জ করবে।
 *
 * এখন দুই route-ই calculateOrderPricing() ডাকে এবং ফলাফল হুবহু Order
 * row-তে লিখে দেয়।
 *
 * ── ক্রমটা কেন ঠিক এই ক্রম ─────────────────────────────────────────────
 *
 *     subtotal                    line item-এর যোগফল
 *   − couponDiscount
 *   − tierDiscount
 *   = discountedSubtotal          (কখনো ঋণাত্মক নয়)
 *   + serviceCharge               discountedSubtotal-এর %
 *   + deliveryFee
 *   = taxableBase                 (settings অনুযায়ী উপরের দুটো বাদ যেতে পারে)
 *   ± tax                         EXCLUSIVE হলে যোগ, INCLUSIVE হলে ভেতর থেকে বের করা
 *   = grandTotal                  ← ছাপা বিল
 *   − giftCard
 *   − pointsRedeemed
 *   + tip
 *   = amountDue                   ← Stripe এটাই কাটে
 *
 * দুটো সিদ্ধান্ত ব্যাখ্যা দাবি করে:
 *
 * ১. কর discount-এর *পরে* বসে, আগে নয়। প্রায় সব VAT ব্যবস্থায় কর বসে
 *    প্রকৃত প্রাপ্ত মূল্যের উপর — customer ৮০ টাকা দিলে ১০০ টাকার উপর কর
 *    নেওয়া যায় না। আগে বসালে রেস্তোরাঁ নিজের পকেট থেকে বাড়তি কর দিত।
 *
 * ২. tip সবার *শেষে*, gift card আর point কাটার পরেও। ফলে prepaid কোনো
 *    কিছু দিয়ে tip শোধ করা যায় না — যেটা ইচ্ছাকৃত, কারণ tip আইনত
 *    কর্মীদের প্রাপ্য, রেস্তোরাঁর আয় নয়। gift card দিয়ে tip দেওয়ার
 *    অনুমতি দিলে রেস্তোরাঁ কার্যত নিজের দায় কর্মীর টাকায় শোধ করতো।
 *    tip কখনোই taxableBase-এও ঢোকে না — পৃথিবীর কোনো দেশেই স্বেচ্ছা
 *    বকশিশ করযোগ্য সরবরাহ নয়।
 */

export type OrderTypeForPricing = "DELIVERY" | "DINE_IN";
export type TaxModeForPricing = "INCLUSIVE" | "EXCLUSIVE";

/**
 * RestaurantSettings-এর যে অংশটুকু দাম হিসাবের জন্য লাগে। পুরো model
 * না নিয়ে এই সংকীর্ণ রূপটা নেওয়ার কারণ: test-এ ৩০ লাইনের object বানাতে
 * না হওয়া, আর kitchen hour বদলালে pricing test ভেঙে না পড়া।
 */
export interface PricingSettings {
  currency: string;
  currencyMinorUnits: number;
  taxEnabled: boolean;
  taxName: string;
  taxMode: TaxModeForPricing;
  taxRateDineIn: Money | number | string;
  taxRateDelivery: Money | number | string;
  serviceChargeRate: Money | number | string;
  serviceChargeTaxable: boolean;
  deliveryFeeFlat: Money | number | string;
  deliveryFeeTaxable: boolean;
  tipEnabled: boolean;
}

export interface PricingLineItem {
  price: Money | number | string;
  quantity: number;
}

export interface PricingInput {
  orderType: OrderTypeForPricing;
  items: PricingLineItem[];

  /** যাচাই-করা coupon discount (lib/order-checkout-shared.ts থেকে)। */
  couponDiscount?: Money | number | string;

  /** Loyalty tier discount (lib/loyalty-tiers.ts থেকে)। */
  tierDiscount?: Money | number | string;

  /**
   * customer যত gift card / point ভাঙাতে চেয়েছে। নিচে বিলের চেয়ে বেশি
   * হলে কেটে ছোট করা হয়, আর প্রকৃত প্রয়োগকৃত পরিমাণটাই ফেরত আসে —
   * caller সেটাই ledger-এ লিখবে, চাওয়া পরিমাণটা নয়।
   */
  giftCardRequested?: Money | number | string;
  pointsRedeemedRequested?: Money | number | string;

  /** নির্দিষ্ট অঙ্কে tip. tipPercent-এর সাথে একসাথে দেওয়া যাবে না। */
  tipAmount?: Money | number | string;

  /** discountedSubtotal-এর শতাংশ হিসেবে tip (১৫ = ১৫%)। */
  tipPercent?: number;
}

export interface PricedOrder {
  subtotal: Money;
  discountAmount: Money;
  tierDiscountAmount: Money;
  serviceCharge: Money;
  deliveryFee: Money;
  taxAmount: Money;
  grandTotal: Money;

  /** প্রকৃতপক্ষে যতটা প্রয়োগ করা গেছে — চাওয়া পরিমাণ নয়। */
  giftCardAmount: Money;
  pointsRedeemedAmount: Money;

  tipAmount: Money;

  /** grandTotal − prepaid + tip. এটাই charge হবে। */
  totalAmount: Money;

  // Order row-তে হুবহু কপি হয়ে যাওয়া snapshot গুলো।
  currency: string;
  taxName: string;
  taxRate: Money;
  taxMode: TaxModeForPricing;
}

/**
 * এই order type-এ কর কত। জার্মানি dine-in ১৯% / takeaway ৭%, বাংলাদেশ
 * AC ১০% / non-AC ৫% — একই রান্নাঘরে দুই হার স্বাভাবিক ঘটনা, ব্যতিক্রম
 * নয়, তাই দুটো আলাদা column.
 */
export function resolveTaxRate(
  settings: PricingSettings,
  orderType: OrderTypeForPricing
): Money {
  if (!settings.taxEnabled) return ZERO;
  return toMoney(
    orderType === "DINE_IN" ? settings.taxRateDineIn : settings.taxRateDelivery
  );
}

export function calculateOrderPricing(
  input: PricingInput,
  settings: PricingSettings
): PricedOrder {
  const units = settings.currencyMinorUnits;
  const round = (v: Money) => roundMoney(v, units);

  // ── লাইন আইটেম ────────────────────────────────────────────────────────
  // প্রতিটা লাইন আলাদা করে round করা হয়, শেষে একবার নয় — তাহলে চালানের
  // লাইনগুলো হাতে যোগ করলে subtotal মেলে, আর customer নিজেই মিলিয়ে
  // দেখতে পারে।
  const subtotal = round(
    sum(...input.items.map((i) => toMoney(i.price).times(i.quantity)))
  );

  // ── ছাড় ──────────────────────────────────────────────────────────────
  // দুটো ছাড় একসাথে subtotal ছাড়িয়ে গেলে কেটে ছোট করা হয়। coupon আগে
  // পুরোটা পায়, tier discount বাকিটুকু — নইলে দুটোর যোগফল বিলের চেয়ে
  // বড় হয়ে discountedSubtotal ঋণাত্মক করে দিতো।
  const couponDiscount = minMoney(round(toMoney(input.couponDiscount)), subtotal);
  const tierDiscount = minMoney(
    round(toMoney(input.tierDiscount)),
    subtotal.minus(couponDiscount)
  );

  const discountedSubtotal = clampToZero(subtotal.minus(couponDiscount).minus(tierDiscount));

  // ── Service charge ও delivery fee ─────────────────────────────────────
  const serviceCharge = round(
    applyRate(discountedSubtotal, toMoney(settings.serviceChargeRate))
  );

  // DINE_IN order-এ delivery fee নেই — কোনো কিছু কোথাও যাচ্ছে না।
  const deliveryFee =
    input.orderType === "DELIVERY" ? round(toMoney(settings.deliveryFeeFlat)) : ZERO;

  // ── কর ────────────────────────────────────────────────────────────────
  // করযোগ্য ভিত্তি: খাবার সবসময়, বাকি দুটো settings অনুযায়ী। VAT
  // ব্যবস্থায় service charge সাধারণত করযোগ্য (এটাও একটা সেবার বিনিময়
  // মূল্য), কিন্তু US sales tax-এ স্বেচ্ছা service charge সাধারণত নয় —
  // তাই অনুমান না করে switch।
  const taxRate = resolveTaxRate(settings, input.orderType);

  const taxableBase = sum(
    discountedSubtotal,
    settings.serviceChargeTaxable ? serviceCharge : ZERO,
    settings.deliveryFeeTaxable ? deliveryFee : ZERO
  );

  const isInclusive = settings.taxMode === "INCLUSIVE";

  // INCLUSIVE: কর ইতিমধ্যে দামের ভেতরে, তাই বের করে আনা হয় — মোট বাড়ে না।
  // EXCLUSIVE: কর উপরে যোগ হয়, মোট বাড়ে।
  const taxAmount = round(
    isInclusive ? extractInclusiveTax(taxableBase, taxRate) : applyRate(taxableBase, taxRate)
  );

  const grandTotal = round(
    sum(discountedSubtotal, serviceCharge, deliveryFee, isInclusive ? ZERO : taxAmount)
  );

  // ── আগাম পরিশোধ ───────────────────────────────────────────────────────
  // Gift card আগে, তারপর point। ক্রমটা customer-এর পক্ষে: gift card-এর
  // টাকা কখনো মেয়াদোত্তীর্ণ হয় না, কিন্তু point হয় — তাই যেটা নষ্ট
  // হওয়ার ঝুঁকিতে সেটা যতটা সম্ভব খরচ হওয়া উচিত। উল্টো ক্রমে করলে
  // customer-এর point পড়ে থেকে একদিন হারিয়ে যেতো।
  //
  // (কার্যত gift card-ই আগে ফুরায় বলে বেশিরভাগ ক্ষেত্রে পার্থক্য হয় না,
  // কিন্তু ভিত্তিটা স্পষ্ট থাকা ভালো।)
  const giftCardAmount = minMoney(round(toMoney(input.giftCardRequested)), grandTotal);

  const pointsRedeemedAmount = minMoney(
    round(toMoney(input.pointsRedeemedRequested)),
    clampToZero(grandTotal.minus(giftCardAmount))
  );

  // ── বকশিশ ─────────────────────────────────────────────────────────────
  // settings-এ বন্ধ থাকলে জোর করে শূন্য। জাপান/কোরিয়ায় tip প্রস্তাব
  // করাটাই অভদ্রতা, তাই client কোনোভাবে পাঠিয়ে দিলেও server সেটা
  // মানবে না — UI লুকিয়ে রাখাই যথেষ্ট নিরাপত্তা নয়।
  let tipAmount = ZERO;
  if (settings.tipEnabled) {
    if (input.tipPercent !== undefined && input.tipPercent > 0) {
      // শতাংশ discountedSubtotal-এর উপর, grandTotal-এর উপর নয়: করের
      // উপর বকশিশ একটা মার্কিন প্রথা, বৈশ্বিক নিয়ম নয়।
      tipAmount = round(applyRate(discountedSubtotal, toMoney(input.tipPercent).dividedBy(100)));
    } else {
      tipAmount = clampToZero(round(toMoney(input.tipAmount)));
    }
  }

  const totalAmount = round(
    sum(clampToZero(grandTotal.minus(giftCardAmount).minus(pointsRedeemedAmount)), tipAmount)
  );

  return {
    subtotal,
    discountAmount: couponDiscount,
    tierDiscountAmount: tierDiscount,
    serviceCharge,
    deliveryFee,
    taxAmount,
    grandTotal,
    giftCardAmount,
    pointsRedeemedAmount,
    tipAmount,
    totalAmount,
    currency: settings.currency,
    taxName: settings.taxName,
    taxRate,
    taxMode: settings.taxMode,
  };
}

/**
 * Order row-তে লেখার জন্য প্রস্তুত object — prisma.order.create()-এ
 * সরাসরি spread করা যায়।
 *
 * আলাদা helper রাখার কারণ: PricedOrder-এ এমন কিছু ক্ষেত্র নেই যা Order-এ
 * নেই, আর উল্টোটাও নয়। ভবিষ্যতে একটা নতুন money column যোগ করলে এখানে
 * TypeScript সাথে সাথে ধরিয়ে দেবে যে দুই route-এর কোনোটাতেই সেটা লেখা
 * হচ্ছে না।
 */
export function pricingToOrderFields(priced: PricedOrder) {
  return {
    subtotal: priced.subtotal,
    discountAmount: priced.discountAmount,
    tierDiscountAmount: priced.tierDiscountAmount,
    serviceCharge: priced.serviceCharge,
    deliveryFee: priced.deliveryFee,
    taxAmount: priced.taxAmount,
    tipAmount: priced.tipAmount,
    grandTotal: priced.grandTotal,
    giftCardAmount: priced.giftCardAmount,
    pointsRedeemedAmount: priced.pointsRedeemedAmount,
    totalAmount: priced.totalAmount,
    currency: priced.currency,
    taxName: priced.taxName,
    taxRate: priced.taxRate,
    taxMode: priced.taxMode,
  };
}
