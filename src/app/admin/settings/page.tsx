import { getRestaurantSettings } from "@/lib/get-settings";
import SettingsForm from "./SettingsForm";

/**
 * ভগ্নাংশ (DB) -> শতাংশ (form)।
 *
 * DB-তে হার ভগ্নাংশ হিসেবে থাকে (0.05), কিন্তু owner শতাংশ টাইপ করেন
 * ("5") — form-এ 0.05 লিখতে বললে একদিন কেউ 5 লিখে ফেলবেন আর ৫০০% VAT
 * আদায় হবে।
 *
 * ⚠️ round করাটা প্রসাধনী নয়। JavaScript-এ 0.05 * 100 = 5.000000000000001,
 * আর সেটা সরাসরি input-এ বসালে owner নিজের সেটিংস খুলেই একটা কিম্ভূত
 * সংখ্যা দেখতেন। ৩ দশমিকে থামানো হয় কারণ মার্কিন sales tax সত্যিই
 * 8.875%-এর মতো হয়।
 */
function toPercent(value: { toNumber(): number }): number {
  return Math.round(value.toNumber() * 100000) / 1000;
}

export default async function AdminSettingsPage() {
  const settings = await getRestaurantSettings();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Operating hours, and how money works at your restaurant — currency,
        tax, service charge and tipping. None of it is hardcoded, because
        none of it is the same in any two countries.
      </p>

      {/*
        Decimal -> number boundary. SettingsForm একটা client component, আর
        Prisma Decimal JSON পেরোলে string হয়ে যায় ("0.05") — তখন form-এর
        number input খালি দেখাত। তাই এখানে স্পষ্টভাবে রূপান্তর।
      */}
      <SettingsForm
        initialData={{
          timezone: settings.timezone,
          kitchenOpenHour: settings.kitchenOpenHour,
          kitchenCloseHour: settings.kitchenCloseHour,

          currency: settings.currency,
          currencyMinorUnits: settings.currencyMinorUnits,

          taxEnabled: settings.taxEnabled,
          taxName: settings.taxName,
          taxMode: settings.taxMode,
          taxRateDineIn: toPercent(settings.taxRateDineIn),
          taxRateDelivery: toPercent(settings.taxRateDelivery),

          serviceChargeRate: toPercent(settings.serviceChargeRate),
          serviceChargeTaxable: settings.serviceChargeTaxable,

          deliveryFeeFlat: settings.deliveryFeeFlat.toNumber(),
          deliveryFeeTaxable: settings.deliveryFeeTaxable,

          tipEnabled: settings.tipEnabled,
          tipPresetPercents: settings.tipPresetPercents,
        }}
      />
    </div>
  );
}
