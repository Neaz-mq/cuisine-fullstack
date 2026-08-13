import { prisma } from "@/lib/prisma";
import type { PricingSettings, TaxModeForPricing } from "@/lib/pricing";

/**
 * সবসময় একটাই settings row থাকে (id: "singleton")। যদি এখনো তৈরি না হয়ে
 * থাকে (fresh database), ডিফল্ট মান দিয়ে একটা তৈরি করে দেয়।
 */
export async function getRestaurantSettings() {
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return settings;
}

/**
 * দাম হিসাবের জন্য যতটুকু দরকার ঠিক ততটুকু।
 *
 * পুরো row না ফিরিয়ে সংকীর্ণ এই রূপটা ফেরানোর কারণ শুধু কম data নয় —
 * lib/pricing.ts যেন Prisma-র উপর নির্ভর না করে। ফলে pricing test-এ
 * database লাগে না, একটা সাধারণ object দিলেই চলে, আর কর হিসাবের মতো
 * জিনিস mock-এর জটিলতা ছাড়াই পরীক্ষা করা যায়।
 *
 * ⚠️ কোনো call site-এ এর ফেরত মান ধরে রেখে (cache করে) পুনর্ব্যবহার করা
 * যাবে না। owner /admin/settings-এ হার বদলালে পরের order-টাই নতুন হারে
 * হওয়া উচিত। পুরোনো order পুরোনো হারেই থাকবে, কিন্তু সেটা cache-এর
 * কারণে নয় — সেটা Order row-তে snapshot হয়ে যাওয়ার কারণে।
 */
export async function getPricingSettings(): Promise<PricingSettings> {
  const s = await getRestaurantSettings();

  return {
    currency: s.currency,
    currencyMinorUnits: s.currencyMinorUnits,
    taxEnabled: s.taxEnabled,
    taxName: s.taxName,
    taxMode: s.taxMode as TaxModeForPricing,
    taxRateDineIn: s.taxRateDineIn,
    taxRateDelivery: s.taxRateDelivery,
    serviceChargeRate: s.serviceChargeRate,
    serviceChargeTaxable: s.serviceChargeTaxable,
    deliveryFeeFlat: s.deliveryFeeFlat,
    deliveryFeeTaxable: s.deliveryFeeTaxable,
    tipEnabled: s.tipEnabled,
  };
}
