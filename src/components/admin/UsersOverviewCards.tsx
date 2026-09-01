import { CircleCheck, CircleX, UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import { overviewPeriodRange, type OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/UsersOverviewCards.tsx
 *
 * /admin/users-এর Overview — Total Users · Active Users · Inactive ·
 * New Users।
 *
 * ── কেন এটা আলাদা component ─────────────────────────────────────────
 *
 * এই পাতাটা এতদিন `StaffOverviewCards` দেখাচ্ছিল — Managers, Chefs,
 * Waiters, Rider, Cleaners। সেটা ভুল ছিল, আর ভুলটা নিছক নকশার নয়:
 * /admin/users পাতাটা **গ্রাহকদের** তালিকা, অথচ উপরের কার্ডগুলো
 * গুনছিল **কর্মীদের**। অর্থাৎ পাতার মাথায় একটা সংখ্যা আর নিচে
 * সম্পূর্ণ অন্য জিনিসের তালিকা — কেউ "Waiters 1" দেখে নিচে খুঁজলে
 * একজন waiter-ও পেতেন না, কারণ তালিকায় কেবল CUSTOMER-রা আছেন।
 *
 * Figma-ও ঠিক এটাই বলে: users পাতার Overview-তে চারটে কার্ড, সবই
 * গ্রাহক-সম্পর্কিত। staff পাতায় পাঁচটা role-কার্ড আগের মতোই থাকে
 * (StaffOverviewCards), কারণ ওখানে সেটাই ঠিক।
 *
 * ── "Active" মানে কী ────────────────────────────────────────────────
 *
 * ⚠️ গ্রাহকের কোনো `isActive` ক্ষেত্র নেই, আর সেটা ইচ্ছাকৃত — কেউ
 * গ্রাহক অ্যাকাউন্ট "নিষ্ক্রিয়" করে না। StaffProfile-এ ওটা আছে কারণ
 * কর্মী চাকরি ছাড়েন; গ্রাহক শুধু আসা বন্ধ করেন।
 *
 * তাই এখানে সক্রিয়তার মাপকাঠি আচরণ: **গত ৯০ দিনে অন্তত একটা
 * অর্ডার**। সংখ্যাটা মনগড়া নয় — একটা রেস্তোরাঁয় নিয়মিত গ্রাহক
 * মাসে অন্তত একবার আসেন, তাই তিন মাস চুপ থাকা মানে সত্যিই হারিয়ে
 * যাওয়া। বদলাতে চাইলে নিচের একটা ধ্রুবক বদলালেই হয়।
 *
 * "Inactive" তাই বাকিরা — মোট থেকে সক্রিয়দের বাদ। আলাদা query
 * চালানো হয় না: দুটো query-র মধ্যে নতুন কেউ যোগ হলে যোগফল মোটের
 * সাথে মিলত না, আর পাশাপাশি বসা তিনটে সংখ্যা না মিললে সেটা সাথে
 * সাথে চোখে পড়ে।
 *
 * ⚠️ Figma-র hint-লেখাগুলো ("Restaurant Management", "Kitchen Team",
 * "Service Staff", "Delivery Staff") এখানে ব্যবহার করা হয়নি — ওগুলো
 * staff কার্ড থেকে copy করার সময় রয়ে যাওয়া, গ্রাহকের সংখ্যার সাথে
 * ওদের কোনো সম্পর্ক নেই। তার বদলে প্রতিটা সংখ্যা কীভাবে গোনা হলো
 * সেটাই লেখা, কারণ "Active" শব্দটা নিজে থেকে কিছু বোঝায় না।
 *
 * ── period ছাঁকনি ────────────────────────────────────────────────────
 *
 * শিরোনামের পাশের pill (All / This Month / Previous Month) কেবল এই
 * চারটে সংখ্যা বদলায়, নিচের তালিকা নয় — বিস্তারিত lib/overview-period.ts-এ।
 *
 * ⚠️ period বাছলে "Total Users" **ওই মাসে যোগ দেওয়া** নয়, বরং **ওই
 * মাস শেষ হওয়া পর্যন্ত মোট কতজন**। দুটো এক করলে Total আর New Users
 * হুবহু একই সংখ্যা দেখাত — পাশাপাশি বসা দুটো কার্ডে একই সংখ্যা,
 * অথচ আলাদা নাম। "মোট" শব্দটার মানে সঞ্চিত, আর সেটা period বদলালেও
 * বদলায় না; শুধু কোন মুহূর্ত পর্যন্ত গোনা হচ্ছে সেটা বদলায়।
 */

/** সক্রিয় বলতে গত কত দিনে অর্ডার — উপরের ব্যাখ্যা দ্রষ্টব্য। */
const ACTIVE_WINDOW_DAYS = 90;
/** নতুন বলতে গত কত দিনে যোগ দিয়েছেন। */
const NEW_WINDOW_DAYS = 30;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** প্রতিটা period-এ কার্ডের নিচের ছোট লেখা — সংখ্যাটা কীসের, সেটা
 *  সংখ্যার পাশেই থাকা দরকার (lib/overview-period.ts-এর মন্তব্য)। */
const HINTS: Record<OverviewPeriod, [string, string, string, string]> = {
  all: [
    "All registered customers",
    `Ordered in last ${ACTIVE_WINDOW_DAYS} days`,
    `No orders in ${ACTIVE_WINDOW_DAYS} days`,
    `Joined in last ${NEW_WINDOW_DAYS} days`,
  ],
  "this-month": [
    "Registered so far",
    "Ordered this month",
    "No orders this month",
    "Joined this month",
  ],
  "prev-month": [
    "Registered by month end",
    "Ordered last month",
    "No orders last month",
    "Joined last month",
  ],
};

export default async function UsersOverviewCards({ period }: { period: OverviewPeriod }) {
  const range = overviewPeriodRange(period);

  // period বাছা থাকলে সেই মাসের সীমা, নাহলে কার্ডের নিজস্ব জানালা।
  const activeWindow = range
    ? { gte: range.gte, lt: range.lt }
    : { gte: daysAgo(ACTIVE_WINDOW_DAYS) };
  const newWindow = range ? { gte: range.gte, lt: range.lt } : { gte: daysAgo(NEW_WINDOW_DAYS) };
  // "মোট" সঞ্চিত — মাস শেষ হওয়ার আগ পর্যন্ত যতজন যোগ দিয়েছেন।
  // উপরের ⚠️ মন্তব্য দ্রষ্টব্য।
  const registeredBy = range ? { createdAt: { lt: range.lt } } : {};

  // এক round-trip-এ তিনটে গণনা। `$transaction` এখানে atomicity-র
  // জন্য নয়, snapshot-এর জন্য: তিনটে আলাদা await-এর মাঝে কেউ
  // register করলে "Total" আর "Active+Inactive" এক থাকত না।
  const [total, active, newUsers] = await prisma.$transaction([
    prisma.user.count({ where: { role: "CUSTOMER", ...registeredBy } }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        ...registeredBy,
        orders: { some: { createdAt: activeWindow } },
      },
    }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: newWindow },
    }),
  ]);

  const hints = HINTS[period];

  const CARDS = [
    { label: "Total Users", value: total, hint: hints[0], icon: Users },
    { label: "Active Users", value: active, hint: hints[1], icon: CircleCheck },
    {
      label: "Inactive",
      // ⚠️ বিয়োগ, আলাদা query নয় — উপরের ব্যাখ্যা দ্রষ্টব্য।
      value: total - active,
      hint: hints[2],
      icon: CircleX,
    },
    { label: "New Users", value: newUsers, hint: hints[3], icon: UserPlus },
  ];

  return (
    /**
     * Figma Frame 2147236275: column, padding 30, gap 24, radius 20,
     * BG #FFFFFF।
     *
     * শিরোনামের পাশে Figma Frame 2147236233 — cream pill, 40 উঁচু,
     * radius 100। Figma-তে ওটার লেখা "Today", কিন্তু বিকল্পগুলো
     * All / This Month / Previous Month, কারণ "আজ" বাছলে "Total
     * Users" কী বোঝাত সেটার কোনো সঙ্গত উত্তর নেই (আজ যাঁরা register
     * করেছেন? তাহলে সেটা আর মোট নয়)। মাসের সীমা তিনটে সংখ্যার
     * প্রত্যেকটাতেই অর্থবহ — বিস্তারিত lib/overview-period.ts-এ।
     */
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40 — উচ্চতাটা
          pill-এরই, শিরোনাম 30px। */}
      <div className="flex items-center justify-between gap-4">
        {/* Figma: Frank Ruhl Libre 600, 30px, LH 100%, #000000 — tablet
            frame-এ 24। নিচের "Users" কার্ডের শিরোনামের সাথে মাপ মেলানো,
            বিস্তারিত StaffOverviewCards.tsx-এ। */}
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      {/**
       * Figma Frame 2147236226: row, gap 20, প্রতিটা কার্ড flex-grow 1
       * — অর্থাৎ চারটে সমান ভাগে।
       *
       * ⚠️ এখানে StaffOverviewCards-এর ৩+২ ভাগাভাগিটা লাগে না, আর
       * সেটাই সরলতা: চারটে কার্ড ২ আর ৪ — দুটোরই গুণিতক, তাই সরু
       * পর্দায় ২×২ আর চওড়ায় ১×৪, কোনো col-span কসরত ছাড়াই।
       *
       * ৪৮০-এর নিচে এক কলাম, কারণ দুই কলামে প্রতিটা কার্ড ~১৩০px
       * হতো আর "Active Users" (Frank Ruhl 20px) icon-বৃত্তের নিচ
       * দিয়ে বেরিয়ে যেত — StaffOverviewCards-এ ধরা পড়া একই সমস্যা।
       */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          /**
           * Figma Card: column, padding 16, gap 20, radius 16,
           * BG #F9F6F3, উচ্চতা 140।
           *
           * ১৪০-টা hug — ভেতরের জিনিস থেকেই আসে:
           *   16 + 40 (উপরের সারি) + 20 (gap) + 48 (নিচের ব্লক) + 16 = 140
           * তাই কোথাও উচ্চতা লিখে দেওয়ার দরকার নেই।
           */
          <div
            key={card.label}
            className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4"
          >
            {/* Frame 2147232365: row, space-between, উচ্চতা 40 —
                উচ্চতাটা icon-বৃত্তেরই, শিরোনাম মাত্র 20px। */}
            <div className="flex items-center justify-between gap-3">
              {/* Figma: Frank Ruhl Libre 500, 20px, LH 100%, #000000।
                  `truncate` শেষ রক্ষাকবচ — "Active Users" ভাঙতে পারে
                  না, তাই জায়গা কম পড়লে লেখাটা icon-এর উপর গিয়ে
                  পড়ত। কাটা লেখা সুন্দর নয়, তবু ওভারল্যাপের চেয়ে ভালো। */}
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {card.label}
              </h3>
              {/* Frame 2147232069: 40×40, BG #FFFFFF, radius 79.8
                  (অর্থাৎ পুরো গোল)। ভেতরের icon 18×18, stroke 1.2। */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <card.icon
                  className="h-[18px] w-[18px] text-black"
                  strokeWidth={1.2}
                  aria-hidden="true"
                />
              </span>
            </div>

            {/* Frame 2147232366: column, gap 12, উচ্চতা 48। */}
            <div className="flex flex-col gap-3">
              {/* Figma: Frank Ruhl Libre 600, 24px, LH 100%, #000000। */}
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {card.value}
              </p>
              {/* Figma: Sora 400, 12px, LH 100%, Black/70। */}
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
