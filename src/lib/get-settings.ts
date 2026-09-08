import { prisma } from "@/lib/prisma";
import type { PricingSettings, TaxModeForPricing } from "@/lib/pricing";
import type { DeliveryFeeSettings } from "@/lib/delivery-fee";

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

/**
 * settings row থেকে delivery charge হিসাবের জন্য যতটুকু দরকার।
 *
 * ⚠️ এটা আলাদা করে export করা হয়নি, ইচ্ছাকৃতভাবে — নিচের
 * getCheckoutSettings() ছাড়া কেউ যেন এটা একা ডাকতে না পারে। কারণ
 * getRestaurantSettings() **প্রতিটা call-এ একটা write চালায়** (upsert,
 * update: {}), অর্থাৎ singleton row-তে একটা row lock। checkout-এ দুবার
 * ডাকলে সেই খরচ দ্বিগুণ, আর একই সময়ের checkout গুলো ওই একটা row-এর
 * lock-এ সারিবদ্ধ হয়ে যায়।
 */
function toDeliverySettings(s: {
  deliveryFeeMode: string;
  deliveryFeeFlat: PricingSettings["deliveryFeeFlat"];
  deliveryZones: unknown;
  restaurantLat: number | null;
  restaurantLng: number | null;
}): DeliveryFeeSettings {
  return {
    deliveryFeeMode: s.deliveryFeeMode === "DISTANCE" ? "DISTANCE" : "FLAT",
    deliveryFeeFlat: s.deliveryFeeFlat,
    deliveryZones: s.deliveryZones,
    restaurantLat: s.restaurantLat,
    restaurantLng: s.restaurantLng,
  };
}

/**
 * Checkout-এর তিনটে route-ই (quote, orders, create-session) দাম আর
 * delivery — দুটোই চায়। তাই settings row **একবার** পড়ে দুটো সংকীর্ণ
 * রূপ ফেরানো হয়, getPricingSettings() আর একটা delivery helper আলাদা
 * করে ডাকার বদলে (উপরের upsert-এর ব্যাখ্যা দ্রষ্টব্য)।
 *
 * ⚠️ getPricingSettings() মুছে ফেলা হয়নি: যেসব জায়গায় delivery-র কোনো
 * প্রশ্নই নেই (menu export, insights, admin পাতাগুলো) সেগুলো ওটাই
 * ডাকে, আর সেখানে বাড়তি field বয়ে বেড়ানোর মানে হয় না।
 */
export async function getCheckoutSettings(): Promise<{
  pricing: PricingSettings;
  delivery: DeliveryFeeSettings;
}> {
  const s = await getRestaurantSettings();

  return {
    pricing: {
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
    },
    delivery: toDeliverySettings(s),
  };
}
