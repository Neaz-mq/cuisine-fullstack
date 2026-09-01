import { Box, CircleCheck, ClipboardList, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import { overviewPeriodRange, type OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/SuppliersOverviewCards.tsx
 *
 * /admin/suppliers-এর Overview — Total Suppliers · Active Suppliers ·
 * Products · Pending।
 *
 * ── তৃতীয় কার্ডটা নিয়ে ─────────────────────────────────────────────
 *
 * Figma-তে নাম "Product", নিচে লেখা "Supply Categories" — অর্থাৎ
 * সংখ্যাটা আলাদা **শ্রেণির**, পণ্যের নয়।
 *
 * ⚠️ প্রথম দফায় এটা অন্যরকম ছিল: তখন schema-য় কোনো category ক্ষেত্রই
 * ছিল না, তাই কার্ডটা purchase order-এর line item ধরে "কতগুলো আলাদা
 * পণ্য এসেছে" গুনত আর hint লেখা ছিল "Items Supplied"। এখন
 * `Supplier.category` যোগ হয়েছে (Figma-র modal-এ ঘরটা এসেছে), তাই
 * designer-এর মূল অর্থটাই ফিরিয়ে আনা গেল — আর hint-ও তাঁরই লেখা।
 */

const CARD_ICONS = [ClipboardList, CircleCheck, Box, Truck];

const HINTS: Record<OverviewPeriod, [string, string, string, string]> = {
  all: ["Registered Suppliers", "Currently Supplying", "Supply Categories", "Awaiting Delivery"],
  "this-month": [
    "Registered so far",
    "Active, registered so far",
    "Among suppliers so far",
    "Ordered this month",
  ],
  "prev-month": [
    "Registered by month end",
    "Active, by month end",
    "Among suppliers by month end",
    "Ordered last month",
  ],
};

export default async function SuppliersOverviewCards({ period }: { period: OverviewPeriod }) {
  const range = overviewPeriodRange(period);

  // "মোট" সঞ্চিত — মাস শেষ হওয়ার আগ পর্যন্ত যতজন যোগ হয়েছেন।
  // Users page-এর Total Users-এর একই যুক্তি।
  const registeredBy = range ? { createdAt: { lt: range.lt } } : {};
  const orderedIn = range ? { createdAt: { gte: range.gte, lt: range.lt } } : {};

  const [total, active, categoryGroups, pending] = await prisma.$transaction([
    prisma.supplier.count({ where: registeredBy }),
    prisma.supplier.count({ where: { isActive: true, ...registeredBy } }),
    /**
     * আলাদা সরবরাহ-শ্রেণির সংখ্যা।
     *
     * ⚠️ `groupBy` + `.length`, `count` নয় — count-এ পাঁচজন Protein
     * সরবরাহকারী থাকলে পাঁচবারই গুনত। প্রশ্নটা "কতগুলো **আলাদা**
     * শ্রেণি", তাই category ধরে গুচ্ছ করে গুচ্ছের সংখ্যা।
     *
     * ⚠️ `not: null` — যাঁদের শ্রেণি লেখা হয়নি তাঁরা একটা আলাদা
     * "শ্রেণি" নন। বাদ না দিলে null-এর গুচ্ছটাও একটা হিসেবে গোনা হতো,
     * আর একজন শ্রেণিহীন সরবরাহকারী থাকলেই সংখ্যাটা এক বেশি দেখাত।
     */
    prisma.supplier.groupBy({
      by: ["category"],
      where: { category: { not: null }, ...registeredBy },
      // ⚠️ `orderBy` এখানে ঐচ্ছিক নয় — Prisma-র generated type
      // `groupBy`-তে এটা **বাধ্যতামূলক** করে রাখে (না দিলে
      // "Property 'orderBy' is missing" — টাইপ-চেকে ধরা পড়ে, runtime-এ
      // নয়, তাই `next build`-এর আগে চোখে পড়ে না)।
      //
      // কারণটা যুক্তিসঙ্গত: গুচ্ছগুলো কোন ক্রমে ফিরবে সেটা নির্দিষ্ট
      // না করলে Postgres যেকোনো ক্রমে দিতে পারে। আমরা কেবল `.length`
      // নিই, তাই ক্রমে কিছু যায়-আসে না — তবু একটা স্থিতিশীল ক্রম
      // দেওয়াই ভালো, কেউ পরে এই ফলাফলটা render করতে চাইলে।
      orderBy: { category: "asc" },
    }),
    // Figma-র "Pending / Awaiting Delivery" — অর্থাৎ সরবরাহকারীকে বলা
    // হয়েছে কিন্তু মাল আসেনি। DRAFT নয়, সেটা এখনো পাঠানোই হয়নি।
    prisma.purchaseOrder.count({ where: { status: "ORDERED", ...orderedIn } }),
  ]);

  const hints = HINTS[period];

  const CARDS = [
    { label: "Total Suppliers", value: total, hint: hints[0] },
    { label: "Active Suppliers", value: active, hint: hints[1] },
    { label: "Product", value: categoryGroups.length, hint: hints[2] },
    { label: "Pending", value: pending, hint: hints[3] },
  ];

  return (
    /* Figma Frame 2147236275: column, padding 30, gap 24, radius 20,
       BG #FFFFFF — Users/Staff-এর Overview-এর হুবহু একই খোলস। */
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      {/* Frame 2147236226: row, gap 20, চারটে কার্ড সমান ভাগে।
          ৪৮০-এর নিচে এক কলাম — দুই কলামে "Active Suppliers"
          (Frank Ruhl 20px) icon-বৃত্তের নিচ দিয়ে বেরিয়ে যেত। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card, index) => {
          const Icon = CARD_ICONS[index];
          return (
            /* Figma Card: column, padding 16, gap 20, radius 16,
               BG #F9F6F3, উচ্চতা 140 (hug: 16+40+20+48+16)। */
            <div key={card.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                  {card.label}
                </h3>
                {/* Frame 2147232069: 40×40, BG #FFFFFF, পুরো গোল,
                    icon 18×18 stroke 1.2। */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <Icon
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
          );
        })}
      </div>
    </div>
  );
}