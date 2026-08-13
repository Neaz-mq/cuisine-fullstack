import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updateSettingsSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";
import { toMoney } from "@/lib/money";

/**
 * PATCH /api/admin/settings — the singleton RestaurantSettings row.
 *
 * এই একটা endpoint-ই ঠিক করে দেয় system-টা কোন দেশের নিয়মে চলবে: কর
 * দামের ভেতরে না উপরে, কী নামে, কোন হারে, service charge আছে কিনা,
 * বকশিশ চাওয়া হবে কিনা, আর currency-র দশমিক কয়টা।
 *
 * ⚠️ এখানে যা লেখা হয় তা কেবল ভবিষ্যতের order-এ প্রযোজ্য। পুরোনো
 * order-গুলো নিজেদের হার আর currency নিজেদের row-তেই snapshot করে
 * রেখেছে (schema.prisma-র Order model দ্রষ্টব্য) — VAT ৫% থেকে ১০%
 * করলে গত মাসের চালান বদলে যাবে না, যা উদ্দেশ্যপ্রণোদিত।
 */
export async function PATCH(req: NextRequest) {
  const authResult = await requireApiScope("settings");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, updateSettingsSchema);
  if (parsed instanceof NextResponse) return parsed;

  const {
    timezone,
    kitchenOpenHour,
    kitchenCloseHour,
    currency,
    currencyMinorUnits,
    taxEnabled,
    taxName,
    taxMode,
    taxRateDineIn,
    taxRateDelivery,
    serviceChargeRate,
    serviceChargeTaxable,
    deliveryFeeFlat,
    deliveryFeeTaxable,
    tipEnabled,
    tipPresetPercents,
  } = parsed;

  // Owner শতাংশ টাইপ করে ("5"), DB ভগ্নাংশ রাখে (0.05). রূপান্তরটা ঠিক
  // এই এক জায়গায়, DB-তে লেখার ঠিক আগে — form-এ 0.05 লিখতে বলা মানে
  // একদিন কেউ 5 লিখে ফেলবে আর ৫০০% VAT আদায় হবে।
  const asFraction = (percent: number) => toMoney(percent).dividedBy(100);

  const data = {
    timezone,
    kitchenOpenHour,
    kitchenCloseHour,
    currency,
    currencyMinorUnits,
    taxEnabled,
    taxName: taxName.trim(),
    taxMode,
    taxRateDineIn: asFraction(taxRateDineIn),
    taxRateDelivery: asFraction(taxRateDelivery),
    serviceChargeRate: asFraction(serviceChargeRate),
    serviceChargeTaxable,
    deliveryFeeFlat: toMoney(deliveryFeeFlat),
    deliveryFeeTaxable,
    tipEnabled,
    // বড় থেকে ছোট নয় — ছোট থেকে বড় করে সাজানো, যাতে checkout-এ
    // button গুলো স্বাভাবিক ক্রমে বসে। ডুপ্লিকেট বাদ, কারণ একই শতাংশ
    // দুবার দেখানো নিছক বিভ্রান্তি।
    tipPresetPercents: [...new Set(tipPresetPercents)].sort((a, b) => a - b),
  };

  const updated = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json(updated);
}
