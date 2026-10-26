"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRIES } from "@/components/CountryCodeSelect";

type FlagComponent = React.ComponentType<{ title?: string; className?: string }>;
const FLAG_COMPONENTS = Flags as unknown as Record<string, FlagComponent>;

/**
 * src/app/admin/orders/[id]/OrderPhoneField.tsx
 *
 * Figma "Phone Number" ঘর: [পতাকা] +880 │ 1324-037691
 *
 * Order.phone-এ শুধু জাতীয় নম্বর থাকে (কোনো দেশ-কোড নয়), আর দেশ থাকে
 * Order.country-তে নাম হিসেবে — তাই ActiveDeliveries-এর মতোই নাম দিয়ে
 * COUNTRIES থেকে পতাকা ও dial code খোঁজা হয়।
 *
 * ⚠️ এটা আলাদা client component, কারণ COUNTRIES একটা "use client" ফাইলের
 * export — server component (page.tsx) থেকে সরাসরি পড়লে আসল array
 * পাওয়া যেত না। দেশ না মিললে শুধু নম্বরটাই দেখায়, কিছু ভাঙে না।
 */
export default function OrderPhoneField({
  phone,
  country,
}: {
  phone: string;
  country: string | null;
}) {
  const match = country ? COUNTRIES.find((c) => c.name === country) : undefined;
  const FlagIcon = match ? FLAG_COMPONENTS[match.code.toUpperCase()] : undefined;

  if (!match) return <span className="break-all">{phone}</span>;

  return (
    <span className="flex items-center gap-3">
      <span className="flex shrink-0 items-center gap-1.5">
        {FlagIcon ? (
          <FlagIcon
            title={match.name}
            className="h-[14px] w-[21px] shrink-0 rounded-[2px] object-cover"
          />
        ) : null}
        <span>{match.dial}</span>
      </span>
      <span aria-hidden="true" className="h-7 w-px shrink-0 bg-[#D9D9D9]" />
      <span className="break-all">{phone}</span>
    </span>
  );
}