import { NextRequest, NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { updateSettingsSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";
import { calculateOrderPricing, type PricingSettings } from "@/lib/pricing";
import { toMoney, serializeMoney } from "@/lib/money";

/**
 * POST /api/admin/settings/preview
 *
 * এখনো সেভ না করা settings দিয়ে একটা নমুনা অর্ডারের বিল কষে দেখায়, যাতে
 * owner সেভ করার আগেই বুঝতে পারেন কর/service charge/বকশিশের নিয়ম বদলালে
 * গ্রাহকের বিল আসলে কেমন দাঁড়াবে।
 *
 * ── কেন এটা একটা endpoint, client-এর কয়েক লাইন হিসাব নয় ────────────────
 *
 * দুটো কারণ, দুটোই এই প্রজেক্টে ইতিমধ্যে ঘটে যাওয়া সমস্যা:
 *
 * ১. lib/pricing.ts → lib/money.ts → generated Prisma client → `node:module`।
 *    browser bundle-এ ওটার অস্তিত্ব থাকতে পারে না, তাই কোনো client
 *    component সরাসরি calculateOrderPricing ডাকতে পারে না — ডাকলে
 *    `next build` "the chunking context does not support external
 *    modules" বলে ভেঙে পড়ে।
 *
 * ২. তাহলে বিকল্প ছিল client-এ একই হিসাব আবার লেখা। কিন্তু তখন দুটো
 *    আলাদা বাস্তবায়ন থাকত, আর একদিন একটা বদলে অন্যটা বদলাত না — অর্থাৎ
 *    preview একটা বিল দেখাত আর গ্রাহক অন্যটা দিতেন। ঠিক এই কারণেই
 *    /api/orders আর /api/checkout/create-session-এর আলাদা হিসাব সরিয়ে
 *    একটাই pricing.ts বানানো হয়েছিল।
 *
 * তাই preview-ও সেই একই function-ই চালায়। বিল ভুল হলে preview-ও ভুল
 * দেখাবে — যা বৈশিষ্ট্য, ত্রুটি নয়: গরমিলটা তখন লুকিয়ে থাকে না।
 */

// নমুনা অর্ডার: ৫০ করে দুটো আইটেম = ১০০ subtotal। গোল সংখ্যা বেছে নেওয়া
// হয়েছে যাতে owner মাথায় শতাংশ মিলিয়ে নিতে পারেন — ৫% কর মানে ঠিক ৫।
const SAMPLE_UNIT_PRICE = 50;
const SAMPLE_QUANTITY = 2;

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("settings");
  if (authResult instanceof NextResponse) return authResult;

  // সেভ করার route-এর হুবহু একই schema — preview যেন এমন কনফিগারেশন
  // দেখাতে না পারে যা আসলে সেভই করা যাবে না।
  const parsed = await parseBody(req, updateSettingsSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Form শতাংশ পাঠায় ("5"), pricing ভগ্নাংশ চায় (0.05) — PATCH route-এর
  // মতো একই রূপান্তর।
  const asFraction = (percent: number) => toMoney(percent).dividedBy(100);

  const settings: PricingSettings = {
    currency: parsed.currency,
    currencyMinorUnits: parsed.currencyMinorUnits,
    taxEnabled: parsed.taxEnabled,
    taxName: parsed.taxName.trim(),
    taxMode: parsed.taxMode,
    taxRateDineIn: asFraction(parsed.taxRateDineIn),
    taxRateDelivery: asFraction(parsed.taxRateDelivery),
    serviceChargeRate: asFraction(parsed.serviceChargeRate),
    serviceChargeTaxable: parsed.serviceChargeTaxable,
    deliveryFeeFlat: toMoney(parsed.deliveryFeeFlat),
    deliveryFeeTaxable: parsed.deliveryFeeTaxable,
    tipEnabled: parsed.tipEnabled,
  };

  const units = parsed.currencyMinorUnits;

  // প্রথম preset শতাংশে একটা বকশিশ ধরে নেওয়া হয় — তালিকা খালি থাকলে ০।
  const samplePercent = parsed.tipPresetPercents[0] ?? 0;

  const quote = (orderType: "DINE_IN" | "DELIVERY") =>
    calculateOrderPricing(
      {
        orderType,
        items: [{ price: SAMPLE_UNIT_PRICE, quantity: SAMPLE_QUANTITY }],
        tipPercent: parsed.tipEnabled ? samplePercent : undefined,
      },
      settings
    );

  // Decimal সরাসরি JSON-এ দিলে string হয়ে যায় আর client-এ .toFixed()
  // ভেঙে পড়ে — serializeMoney currency-র দশমিক অনুযায়ী গুছিয়ে string-ই
  // দেয়, কিন্তু জেনেশুনে, আর ঠিক যতগুলো দশমিক দরকার ততগুলো নিয়ে।
  const shape = (orderType: "DINE_IN" | "DELIVERY") => {
    const p = quote(orderType);
    return {
      subtotal: serializeMoney(p.subtotal, units),
      serviceCharge: serializeMoney(p.serviceCharge, units),
      deliveryFee: serializeMoney(p.deliveryFee, units),
      taxAmount: serializeMoney(p.taxAmount, units),
      tipAmount: serializeMoney(p.tipAmount, units),
      grandTotal: serializeMoney(p.grandTotal, units),
      totalAmount: serializeMoney(p.totalAmount, units),
    };
  };

  return NextResponse.json({
    currency: parsed.currency,
    taxName: parsed.taxName.trim(),
    taxMode: parsed.taxMode,
    tipPercent: parsed.tipEnabled ? samplePercent : 0,
    dineIn: shape("DINE_IN"),
    delivery: shape("DELIVERY"),
  });
}
