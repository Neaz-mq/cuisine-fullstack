import { ClipboardList, CircleCheck, Package, Bike } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import { overviewPeriodRange, type OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/OrdersOverviewCards.tsx
 *
 * Figma — /admin/orders-এর Overview: Total Orders · Completed ·
 * Processing · On the Way।
 *
 * খোলসটা Categories/Menu/Staff/Suppliers-এর Overview-এর হুবহু নকল
 * (কার্ড: column, padding 16, gap 20, radius 16, #F9F6F3; আইকনের ঘর
 * 40×40 সাদা গোল; মান Frank Ruhl 600 24px; hint Sora 12px Black/70)।
 *
 * ⚠️ period ছাঁকনিটা এখানে সবচেয়ে অর্থবহ — Menu বা Categories-এর
 * বিপরীতে অর্ডার জিনিসটা **সময়েরই** তালিকা। তবু হিসাবের ছাঁদটা আলাদা:
 * Suppliers/Menu-তে period মানে "ওই সময় পর্যন্ত মোট কতগুলো" (`lt`,
 * সঞ্চিত), কারণ মেনু বা সরবরাহকারী জমতে থাকে। অর্ডারের ক্ষেত্রে
 * প্রশ্নটা উল্টো — "**ওই মাসে** কতগুলো অর্ডার এল" — তাই এখানে
 * সময়সীমার দুই প্রান্তই ব্যবহার হয় (`gte` + `lt`)।
 *
 * ⚠️ "Processing" মানে PREPARING, আর "On the Way" মানে
 * OUT_FOR_DELIVERY। PLACED কোনো কার্ডে আলাদা করে গোনা হয় না — সেটা
 * ইচ্ছাকৃত: চারটে ঘরের নকশায় পাঁচটা অবস্থা ধরানো যায় না, আর নতুন
 * অর্ডারের সংখ্যা এমনিতেই "Total − বাকি সব"। তালিকায় status ছাঁকনি
 * দিয়ে ওটা দেখা যায়।
 */
const HINTS: Record<OverviewPeriod, [string, string, string, string]> = {
  all: ["All Orders", "Successfully Delivered", "Currently Processing", "Awaiting Fulfilment"],
  "this-month": ["This month", "Delivered this month", "Processing now", "On the way now"],
  "prev-month": [
    "Last month",
    "Delivered last month",
    "Processing, last month",
    "On the way, last month",
  ],
};

export default async function OrdersOverviewCards({ period }: { period: OverviewPeriod }) {
  const range = overviewPeriodRange(period);

  /**
   * ⚠️ সময়ের শর্তটা একবার বানিয়ে চারটে গণনাতেই ব্যবহার — নাহলে একটা
   * জায়গায় বদলে বাকিগুলো ভুলে যাওয়া কেবল সময়ের ব্যাপার, আর তখন
   * "Completed" আর "Total" দুটো আলাদা সময়সীমার হিসাব দেখাত।
   */
  const placedIn = range ? { createdAt: { gte: range.gte, lt: range.lt } } : {};

  /**
   * ⚠️ চারটে `count`, একটা `findMany` নয়। অর্ডারের সংখ্যা হাজার ছাড়াতে
   * পারে (Menu বা Category-র মতো কয়েকশো নয়), তাই সব সারি টেনে এনে
   * memory-তে গোনাটা এখানে সত্যিই ব্যয়বহুল। `count` DB-তেই শেষ হয়।
   */
  const [total, delivered, preparing, onTheWay] = await Promise.all([
    prisma.order.count({ where: placedIn }),
    prisma.order.count({ where: { ...placedIn, status: "DELIVERED" } }),
    prisma.order.count({ where: { ...placedIn, status: "PREPARING" } }),
    prisma.order.count({ where: { ...placedIn, status: "OUT_FOR_DELIVERY" } }),
  ]);

  const hints = HINTS[period];

  const CARDS = [
    { label: "Total Orders", value: total, hint: hints[0], icon: ClipboardList },
    { label: "Completed", value: delivered, hint: hints[1], icon: CircleCheck },
    { label: "Processing", value: preparing, hint: hints[2], icon: Package },
    { label: "On the Way", value: onTheWay, hint: hints[3], icon: Bike },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      {/* ৪৮০-এর নিচে এক কলাম — দুই কলামে "Total Orders" (Frank Ruhl
          20px) আইকন-বৃত্তের নিচ দিয়ে বেরিয়ে যেত। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <div key={card.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {card.label}
              </h3>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <card.icon
                  className="h-[18px] w-[18px] text-black"
                  strokeWidth={1.2}
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {card.value}
              </p>
              <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                {card.hint}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
