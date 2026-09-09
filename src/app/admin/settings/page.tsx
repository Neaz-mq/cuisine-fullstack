import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import SettingsForm from "./SettingsForm";
import { normalizeDeliveryZones } from "@/lib/delivery-zones";

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

/**
 * src/app/admin/settings/page.tsx
 *
 * ⚠️ এই পাতাটা আগে অ্যাপের নকশা-ব্যবস্থার বাইরে ছিল: `max-w-2xl mx-auto
 * px-4 py-8` — নিজের একটা container, নিজের শিরোনাম, আর Tailwind-এর
 * ডিফল্ট ধূসর; যেখানে বাকি সব admin পাতা AdminShell-এর ভেতরে cream/
 * orange ব্যবস্থায় চলে। Kitchen, Categories, Menu আর Orders-এর
 * ক্ষেত্রেও ঠিক এটাই হয়েছিল, আর সারানোটাও একই ছাঁদে: Welcome শিরোনাম
 * → তারিখের pill → সাদা radius-20 কার্ডের সারি।
 *
 * ⚠️ `max-w-2xl` তুলে দেওয়া হয়েছে। ওটা থাকায় পাতাটা চওড়া পর্দাতেও
 * সরু কলামে আটকে থাকত, অথচ delivery zone-এর সারিগুলোয় (Zone · Up to ·
 * Fee · ×) চারটে কলাম পাশাপাশি বসাতে হয়। AdminShell নিজেই প্রস্থ ঠিক
 * করে, ঠিক যেমন Orders-এ করে।
 */
export default async function AdminSettingsPage() {
  // layout.tsx-ও `requireStaff("settings")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ — Orders-এর
  // হুবহু একই ছাঁদ।
  const [session, settings] = await Promise.all([
    requireStaff("settings"),
    getRestaurantSettings(),
  ]);

  /**
   * ⚠️ তারিখটা এখানে **server-এ** সাজানো হয়, SettingsForm-এ নয়।
   *
   * SettingsForm একটা client component। ওখানে `new Date()` ডাকলে
   * server render আর browser hydration দুই সময়ে দুটো আলাদা মান পেত —
   * React সেটাকে hydration mismatch বলে ধরে, আর মাঝরাতের আশেপাশে
   * তারিখটা সত্যিই আলাদা হতে পারত।
   */
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4">

      {/*
        Decimal -> number boundary. SettingsForm একটা client component, আর
        Prisma Decimal JSON পেরোলে string হয়ে যায় ("0.05") — তখন form-এর
        number input খালি দেখাত। তাই এখানে স্পষ্টভাবে রূপান্তর।
      */}
      {/**
        * ⚠️ Welcome শিরোনাম, তারিখ আর "Save Change" — তিনটেই এখন
        * SettingsForm-এর ভেতরে, যদিও শিরোনামটা server-এর তথ্য।
        *
        * কারণ Figma-তে তারিখ আর Save একই সারিতে বসে, অথচ Save একটা
        * form submit বোতাম — ওটা <form>-এর বাইরে রাখলে ফর্মটা জমা
        * দেওয়ার কোনো স্বাভাবিক পথ থাকে না, আর `isPending` অবস্থাটাও
        * ওখানে পৌঁছয় না। তাই উল্টোটা করা হলো: নাম আর তারিখ prop
        * হিসেবে ভেতরে পাঠানো, যেগুলো নিছক string।
        */}
      <SettingsForm
        userName={session.user.name ?? "there"}
        today={today}
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

          deliveryFeeMode: settings.deliveryFeeMode,
          /**
           * ⚠️ normalize করে পাঠানো হয় — column-টা Json, তাই DB-তে
           * এলোমেলো বা অসম্পূর্ণ কিছু থাকতে পারে (হাতে লেখা SQL, বা
           * migration চালানোর আগের row)। form যেন সবসময় একটা বৈধ
           * সিঁড়ি নিয়ে শুরু করে।
           *
           * label/fromKm/id ফেলে দেওয়া হয়: ওগুলো derived, আর form-এ
           * রাখলে owner ধাপ বদলানোর পর ওরা বাসি হয়ে যেত।
           */
          deliveryZones: normalizeDeliveryZones(settings.deliveryZones).map((zone) => ({
            upToKm: zone.upToKm,
            fee: zone.fee,
          })),
          restaurantLat: settings.restaurantLat,
          restaurantLng: settings.restaurantLng,

          tipEnabled: settings.tipEnabled,
          tipPresetPercents: settings.tipPresetPercents,

          reservationDepositAmount: settings.reservationDepositAmount.toNumber(),
        }}
      />
    </div>
  );
}
