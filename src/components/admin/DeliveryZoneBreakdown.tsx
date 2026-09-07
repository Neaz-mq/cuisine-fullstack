"use client";

import { formatKm, type OrderDeliverySnapshot } from "@/lib/delivery-zones";

/**
 * src/components/admin/DeliveryZoneBreakdown.tsx
 *
 * Figma "Ready to Delivery" → Delivery Charge অংশটা:
 *
 *   Delivery Charge
 *   [0–1 Km $2] [1–3 Km $5] [3–5 Km $7]* [5–8 Km $10] [8+ Km $14]
 *   ┌ Distance to customer ················· 3.9 Km ┐
 *   └ ▬▬▬▬▬▬▬▬▬●──────────────────────────────────┘
 *   Delivery Charge Applied                    $7.00
 *
 * ⚠️ পুরোটাই **প্রদর্শন**, কোনো নিয়ন্ত্রণ নয়। চিপে ক্লিক করা যায় না,
 * আর সেটা ইচ্ছাকৃত।
 *
 * ফি বসে checkout-এ (lib/delivery-fee.ts), আর তার উপরেই tax আর
 * grandTotal হিসাব হয়ে Order row-তে জমা থাকে। ONLINE অর্ডারে টাকাটা
 * ততক্ষণে Stripe-এ কেটেও গেছে। এখান থেকে ধাপ বদলাতে দিলে খদ্দের এক
 * দাম দেখে টাকা দিতেন আর রসিদে অন্যটা থাকত — যেটা টাকার হিসাবের
 * সবচেয়ে খারাপ ধরনের ভুল: নীরব, আর ধরা পড়ে অনেক পরে।
 *
 * তাই staff এখানে যা দেখেন তা হলো **কেন** এই ফি বসেছিল, কী বসানো
 * যেত তা নয়। ভুল হলে সমাধান refund/adjustment, ধাপ বদলানো নয়।
 *
 * ⚠️ ধাপের তালিকাটা order-এর নিজের snapshot থেকে আসে, আজকের settings
 * থেকে নয় — owner কাল দাম বদলালে গতকালের অর্ডারে গতকালের তালিকাই
 * থাকে। lib/delivery-fee.ts-এর deliveryFieldsForOrder()-এ কারণটা
 * বিস্তারিত, আর taxRate/currencyMinorUnits ঠিক একই যুক্তিতে Order-এ
 * snapshot করা।
 */
export default function DeliveryZoneBreakdown({
  delivery,
}: {
  delivery: OrderDeliverySnapshot;
}) {
  const { zones, distanceKm, barRatio, appliedFeeLabel, fellBackToFlat } = delivery;

  // ধাপের তালিকা না থাকলে (FLAT mode-এ চলা দোকান, বা এই feature-এর
  // আগের অর্ডার) আগের সরল সারিটাই দেখানো হয় — চিপ ছাড়া। পুরোনো
  // অর্ডারের modal ভেঙে ফেলার কোনো কারণ নেই।
  if (zones.length === 0) {
    return <AppliedRow label={appliedFeeLabel} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-[#F9F6F3] p-4">
      <span className="font-frank-ruhl text-[15px] font-semibold leading-none text-black">
        Delivery Charge
      </span>

      {/**
       * ⚠️ grid, flex নয় — আর ৩২০px-এ ৩ কলাম।
       *
       * Figma-তে পাঁচটা চিপ এক সারিতে, কিন্তু পাঁচটা ~১০০px চিপ মানে
       * অন্তত ৫৪০px। modal-এর ভেতরে ৩২০px পর্দায় জায়গা থাকে ~২৪০px,
       * তাই এক সারিতে জোর করলে চিপগুলো modal-এর বাইরে বেরিয়ে যেত —
       * ঠিক যেভাবে orders তালিকার বোতামজোড়া বেরিয়েছিল।
       *
       * flex-wrap-ও করা যেত, কিন্তু তাতে শেষ সারিতে একটা-দুটো চিপ
       * এলোমেলো চওড়ায় বসত। grid-এ প্রতিটা চিপ সমান, তাই ভেঙে গেলেও
       * সারিটা তালিকার মতোই দেখায়।
       */}
      <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-5">
        {zones.map((zone) => (
          <div
            key={zone.id}
            /**
             * ⚠️ `aria-current` — চিপটা যে বাছাই-করা নয় বরং "এটাই
             * প্রযোজ্য" সেটা screen reader-কে জানাতে। এটা button নয়,
             * তাই `aria-pressed`/`aria-selected` ভুল হতো: ওগুলো
             * নিয়ন্ত্রণের ভাষা, আর এখানে ক্লিক করার কিছু নেই।
             */
            aria-current={zone.active ? "true" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] px-2 py-2.5 text-center ${
              zone.active
                ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                : "border border-black/10 bg-white text-black"
            }`}
          >
            <span
              className={`truncate font-sora text-[11px] leading-none ${
                zone.active ? "text-white/80" : "text-black/50"
              }`}
            >
              {zone.label}
            </span>
            <span
              className={`truncate font-frank-ruhl text-[15px] font-semibold leading-none ${
                zone.active ? "text-white" : "text-black"
              }`}
            >
              {zone.feeLabel}
            </span>
          </div>
        ))}
      </div>

      {/* Distance to customer — সাদা বাক্স, ভেতরে লেখা + বার। */}
      <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-sora text-[13px] leading-none text-black/60">
            Distance to customer
          </span>
          <span className="shrink-0 font-sora text-[13px] font-semibold leading-none text-black">
            {distanceKm === null ? "Not available" : `${formatKm(distanceKm)} Km`}
          </span>
        </div>

        {distanceKm === null ? (
          /**
           * ⚠️ দূরত্ব মাপা যায়নি — বারটা দেখানোই হয় না।
           *
           * শূন্য-ভরা একটা বার দেখালে সেটা "০ কিমি" বলে মিথ্যা বলত,
           * অথচ আসল কথাটা হলো "আমরা জানি না"। staff-এর জানা দরকার,
           * কারণ তখন ফি-টা ধাপ থেকে নয়, flat থেকে বসেছে।
           */
          <p className="font-sora text-[12px] leading-[1.5] text-black/50">
            The address couldn&apos;t be located on the map, so the flat delivery fee was
            charged instead of a distance-based one.
          </p>
        ) : (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-black/[0.07]"
            role="progressbar"
            aria-label="Distance to customer"
            aria-valuenow={Math.round(barRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_260%)]"
              // ⚠️ inline style, Tailwind class নয় — প্রস্থটা চলক,
              // আর Tailwind শুধু সেই class গুলোই তৈরি করে যেগুলো
              // source-এ আক্ষরিকভাবে লেখা আছে। `w-[${x}%]` লিখলে
              // build-এ কোনো CSS-ই তৈরি হতো না।
              style={{ width: `${Math.max(barRatio * 100, 2)}%` }}
            />
          </div>
        )}
      </div>

      <AppliedRow label={appliedFeeLabel} bare fallback={fellBackToFlat} />
    </div>
  );
}

/**
 * "Delivery Charge Applied … $7.00"।
 *
 * `bare` — চিপগুলোর নিচে বসলে নিজের cream মোড়কটা লাগে না, কারণ
 * বাইরের বাক্সটাই cream। ধাপ ছাড়া (FLAT mode) বসলে লাগে।
 */
function AppliedRow({
  label,
  bare = false,
  fallback = false,
}: {
  label: string;
  bare?: boolean;
  fallback?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        bare ? "" : "rounded-[20px] bg-[#F9F6F3] p-4"
      }`}
    >
      <span className="min-w-0 font-sora text-[14px] leading-none text-black/70">
        Delivery Charge Applied
        {fallback && (
          <span className="ml-1.5 font-sora text-[12px] text-black/40">(flat rate)</span>
        )}
      </span>
      <span className="shrink-0 font-frank-ruhl text-[20px] font-semibold leading-none text-black">
        {label}
      </span>
    </div>
  );
}