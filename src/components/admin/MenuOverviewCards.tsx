import { UtensilsCrossed, CircleCheck, LayoutDashboard, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import { overviewPeriodRange, type OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/MenuOverviewCards.tsx
 *
 * Figma Frame 2147236300 — /admin/menu-এর Overview: Total Items ·
 * Available Items · Categories · Unavailable।
 *
 * খোলসটা Categories/Staff/Users/Suppliers-এর Overview-এর হুবহু নকল
 * (কার্ড: column, padding 16, gap 20, radius 16, #F9F6F3; আইকনের ঘর
 * 40×40 সাদা গোল; মান Frank Ruhl 600 24px; hint Sora 12px Black/70)।
 *
 * ── এখানে period ছাঁকনিটা সত্যিই বসানো গেছে ─────────────────────────
 *
 * Categories পাতায় এটা বসানো যায়নি, কারণ `Category`-তে কোনো তারিখের
 * মাঠ নেই। `MenuItem`-এ আছে (`createdAt`), তাই এখানে Figma-র
 * ছাঁকনিটাই বসেছে — আর হিসাবের ছাঁদটা `SuppliersOverviewCards`-এর
 * হুবহু: period দিলে "ওই মাসের শেষ পর্যন্ত যা যোগ হয়েছে" (`lt`),
 * অর্থাৎ সঞ্চিত সংখ্যা, ওই মাসে যোগ হওয়াগুলো নয়। মেনু বাড়তেই থাকে,
 * তাই "গত মাসে মেনুতে কী কী ছিল" প্রশ্নটারই অর্থ আছে।
 *
 * ── তৃতীয় কার্ড "Categories" নিয়ে একটা সতর্কতা ──────────────────────
 *
 * ⚠️ এটা **পদওয়ালা** শ্রেণির সংখ্যা, মোট শ্রেণির নয় — তাই
 * /admin/categories-এর "Total Categories"-এর চেয়ে কম হতে পারে
 * (একটাও পদ নেই এমন শ্রেণি এখানে গোনা হয় না)।
 *
 * কেন: `Category`-তে `createdAt` নেই, তাই period বাছলে শ্রেণিকে
 * নিজের তারিখ ধরে ছাঁকা অসম্ভব। মোট সংখ্যাটা দেখালে ছাঁকনি ঘোরালেও
 * ওই একটা কার্ড কখনো বদলাত না — চারটের মধ্যে একটা স্থির সংখ্যা
 * সবচেয়ে বিভ্রান্তিকর, কারণ দেখে মনে হয় হিসাবটা ভেঙেছে।
 *
 * তাই গোনা হয় "যে শ্রেণিগুলোয় এই সময়সীমার ভেতরে অন্তত একটা পদ
 * আছে" — সংখ্যাটা period-এর সাথে বদলায়, আর hint-এ লেখা থাকে
 * "With Menu Items"। `SuppliersOverviewCards`-এর তৃতীয় কার্ডেও
 * ("Among suppliers so far") ঠিক এই একই কৌশল।
 */
const HINTS: Record<OverviewPeriod, [string, string, string, string]> = {
  all: ["All Menu Items", "Currently Available", "With Menu Items", "Currently Unavailable"],
  "this-month": [
    "Added so far",
    "Available, so far",
    "With items so far",
    "Unavailable, so far",
  ],
  "prev-month": [
    "Added by month end",
    "Available, by month end",
    "With items by month end",
    "Unavailable, by month end",
  ],
};

export default async function MenuOverviewCards({ period }: { period: OverviewPeriod }) {
  const range = overviewPeriodRange(period);

  // "মোট" সঞ্চিত — ওই মাস শেষ হওয়ার আগ পর্যন্ত যা যা যোগ হয়েছে।
  const addedBy = range ? { createdAt: { lt: range.lt } } : {};

  /**
   * ⚠️ চারটে আলাদা query নয়, একটাই — তারপর memory-তে গোনা।
   *
   * তিনটে সংখ্যাই (মোট, পাওয়া যাচ্ছে, পাওয়া যাচ্ছে না) একই সারিগুলোর
   * উপর, আর চতুর্থটার (শ্রেণি) জন্য দরকার distinct categoryId — সেটাও
   * ঐ একই সারি থেকেই বেরোয়। একটা রেস্তোরাঁর মেনু কয়েকশো সারির বেশি
   * হয় না, তাই চারবার DB-তে যাওয়ার কোনো কারণ নেই।
   */
  const rows = await prisma.menuItem.findMany({
    where: addedBy,
    select: { isAvailable: true, categoryId: true },
  });

  const total = rows.length;
  const available = rows.filter((row) => row.isAvailable).length;
  const categories = new Set(rows.map((row) => row.categoryId)).size;

  const hints = HINTS[period];

  const CARDS = [
    { label: "Total Items", value: total, hint: hints[0], icon: UtensilsCrossed },
    { label: "Available Items", value: available, hint: hints[1], icon: CircleCheck },
    { label: "Categories", value: categories, hint: hints[2], icon: LayoutDashboard },
    { label: "Unavailable", value: total - available, hint: hints[3], icon: CircleAlert },
  ];

  return (
    /* Figma Frame 2147236300: column, padding 30, gap 24, radius 20, সাদা। */
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      {/* Frame 2147236226: row, gap 20, চারটে কার্ড সমান ভাগে।
          ৪৮০-এর নিচে এক কলাম — দুই কলামে "Available Items"
          (Frank Ruhl 20px) আইকন-বৃত্তের নিচ দিয়ে বেরিয়ে যেত। */}
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
