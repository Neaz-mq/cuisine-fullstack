import { Bike, Briefcase, Brush, ChefHat, UserRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import { overviewPeriodRange, type OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/StaffOverviewCards.tsx
 *
 * Overview কার্ড গ্রুপ — Managers · Chefs · Waiters · Rider · Cleaners।
 * আগে এটা শুধু admin/users/page.tsx-এ inline লেখা ছিল, কিন্তু নতুন
 * admin/staff redesign-এর Figma-তেও হুবহু একই ব্লকটা আছে (একই কার্ড,
 * একই সংখ্যা — কারণ এটা গ্রাহকের নয়, কর্মীর হিসাব)। দুই পাতাতেই কপি
 * রাখলে FilterMenu.tsx-এর মন্তব্যে বর্ণিত সমস্যাটাই আবার হতো: একটায়
 * বদল হলে অন্যটা নীরবে পিছিয়ে থাকে। তাই এখানে বের করা, নিজের Prisma
 * query-সহ — যে পাতাতেই বসুক, `<StaffOverviewCards />` লিখলেই যথেষ্ট।
 *
 * ── কেন পাঁচটাই এই role-গুলো ──────────────────────────────────────────
 *
 * পাঁচটাই মকআপ অনুযায়ী। ⚠️ কিন্তু "Cleaners"-এর জন্য schema-য়
 * CLEANER role-টা নতুন করে যোগ করতে হয়েছে — আগে ওটা ছিল না, আর
 * তাই কার্ডটা চিরকাল ০ দেখাত।
 *
 * সিদ্ধান্তটা ইচ্ছাকৃত: নকশার সাথে মেলাতে গিয়ে একটা মিথ্যে সংখ্যা
 * বসানোর বদলে সংখ্যাটাকে সত্যি করে তোলা হয়েছে। এখন /admin/staff
 * থেকে পরিচ্ছন্নতাকর্মী যোগ করা যায়, আর এই কার্ড তাঁদের গোনে।
 *
 * ⚠️ CASHIER role-টা schema-য় আছে, কিন্তু Figma-তে তার কোনো কার্ড
 * নেই — অর্থাৎ ক্যাশিয়াররা এই সারিতে গোনা হন না। মকআপ পাঁচটা কার্ড
 * চায়, ষষ্ঠটা যোগ করলে সারির মাপ ভাঙে। সম্পূর্ণ কর্মীতালিকা
 * /admin/staff-এ আছে, তাই কেউ হারিয়ে যায় না — কিন্তু এই সারির
 * যোগফল মোট কর্মীসংখ্যা নয়, সেটা জেনে রাখা দরকার।
 *
 * Managers-এ OWNER আর MANAGER দুটোই: মালিক নিজেও রেস্তোরাঁ চালান, আর
 * তাঁকে বাদ দিলে যোগফল কর্মীসংখ্যার সাথে মিলত না।
 */
const STAFF_GROUPS = [
  {
    label: "Managers",
    roles: ["OWNER", "MANAGER"] as const,
    hint: "Restaurant Management",
    icon: Briefcase,
  },
  { label: "Chefs", roles: ["KITCHEN"] as const, hint: "Kitchen Team", icon: ChefHat },
  { label: "Waiters", roles: ["WAITER"] as const, hint: "Service Staff", icon: UserRound },
  { label: "Rider", roles: ["DELIVERY"] as const, hint: "Delivery Staff", icon: Bike },
  // Figma-র icon vuesax/linear/broom — lucide-এ সবচেয়ে কাছের Brush।
  { label: "Cleaners", roles: ["CLEANER"] as const, hint: "Cleaning Staff", icon: Brush },
];

export default async function StaffOverviewCards({ period }: { period: OverviewPeriod }) {
  const range = overviewPeriodRange(period);

  /**
   * এক query-তে পাঁচটা কার্ডের সংখ্যা।
   *
   * ── All ────────────────────────────────────────────────────────────
   * নিষ্ক্রিয় কর্মী বাদ, কিন্তু StaffProfile নেই এমন কেউ বাদ নয় —
   * seed-এ বানানো OWNER account-টার কোনো StaffProfile নেই, অথচ
   * তিনিই মালিক। শুধু `staffProfile.isActive` দেখলে তিনি গোনায়
   * ধরা পড়তেন না।
   *
   * ── This Month / Previous Month ────────────────────────────────────
   * তখন প্রশ্নটা বদলে যায়: "এখন কতজন আছেন" নয়, "ওই মাসে কতজন যোগ
   * দিলেন"। তাই মাপকাঠি hireDate।
   *
   * ⚠️ দুটো তফাত ইচ্ছাকৃত। এক, StaffProfile নেই এমন কেউ তখন গোনায়
   * আসেন না — hireDate ছাড়া "কবে যোগ দিলেন" প্রশ্নের উত্তরই নেই।
   * দুই, isActive দেখা হয় না: গত মাসে যিনি যোগ দিয়ে এ মাসে চলে
   * গেছেন, তিনি গত মাসে যোগ তো দিয়েছিলেনই। নিয়োগের ইতিহাস পরে
   * বদলায় না।
   */
  const staffCounts = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
    where: {
      role: { not: "CUSTOMER" },
      ...(range
        ? { staffProfile: { hireDate: { gte: range.gte, lt: range.lt } } }
        : { OR: [{ staffProfile: { is: null } }, { staffProfile: { isActive: true } }] }),
    },
  });

  const countFor = (roles: readonly string[]) =>
    staffCounts
      .filter((row) => roles.includes(row.role))
      .reduce((sum, row) => sum + row._count._all, 0);

  return (
    /**
     * --- Overview ---
     *
     * Figma Frame 2147236275: column, padding 30, gap 24, radius 20,
     * BG #FFFFFF, উচ্চতা 264 (hug)।
     *
     * শিরোনামের পাশে Figma Frame 2147236233 — cream pill, 40 উঁচু,
     * radius 100। Figma-তে লেখা "This Week", কিন্তু বিকল্পগুলো
     * All / This Month / Previous Month।
     *
     * ⚠️ এই ছাঁকনিটা একবার ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছিল, এই
     * যুক্তিতে যে পাঁচটা সংখ্যা *এই মুহূর্তের* কর্মীসংখ্যা — গুদামের
     * stock-এর মতো বর্তমান অবস্থা, কোনো সময়কালের হিসাব নয়, তাই
     * period বাছলে সংখ্যা বদলাত না। যুক্তিটা তখনকার সংজ্ঞার জন্য
     * ঠিক ছিল, কিন্তু সংজ্ঞাটাই এখন period-ভেদে বদলায়: All-এ "এখন
     * কতজন আছেন", মাস বাছলে "ওই মাসে কতজন যোগ দিলেন"। দ্বিতীয়টা
     * সত্যিই সময়ের হিসাব, আর নিয়োগের গতি দেখার কাজে লাগে।
     */
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40 — উচ্চতাটা
          pill-এরই, শিরোনাম 30px। */}
      <div className="flex items-center justify-between gap-4">
        {/* Figma: Frank Ruhl Libre 600, 30px, LH 100%, #000000।

            Figma desktop frame-এ ৩০px, কিন্তু tablet frame-এ (708px)
            ২৪ — heading-এর মতোই। md-এ ৩০ রাখলে "Overview" শব্দটা তো
            আঁটত, কিন্তু নিচের "Users"/"Staff Information" কার্ডের
            শিরোনামের সাথে মাপ মিলত না, আর দুই কার্ডের শিরোনাম একই
            পাতায় দুই মাপে বসলে সেটা ভুল দেখায়। তাই ৩০-এ ফেরা xl
            থেকে, দুই জায়গাতেই। */}
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      {/**
       * Figma Frame 2147236226: column, gap 20 — ভেতরে **দুটো সারি**,
       * সমান একটা grid নয়:
       *
       *   Frame 2147236588 → তিনটে কার্ড, প্রতিটা 202.67px
       *   Frame 2147236589 → দুটো কার্ড, প্রতিটা 314px
       *
       * দুটো সারিই `flex-grow: 1`, অর্থাৎ যে যতগুলোই থাক, নিজেদের
       * মধ্যে পুরো প্রস্থ সমান ভাগ করে নেয়। ৬৪৮px-এ সেটাই মেলে:
       * (648 − 2×20)/3 = 202.67, আর (648 − 20)/2 = 314।
       *
       * ⚠️ md-তে ৬ কলামের grid, কারণ ৫টা কার্ডকে ৩+২ ভাগ করতে হলে
       * ৫ বা ৩ কলাম দিয়ে হয় না — ৩ কলামে শেষ সারির দুটো কার্ড এক
       * কলাম করে নিত আর ডানদিকে একটা ফাঁকা ঘর পড়ে থাকত, অথচ Figma-তে
       * ওরা জায়গাটা ভাগ করে নেয়। ৬ হলো ৩ আর ২ — দুটোরই গুণিতক, তাই
       * উপরের তিনটে ২ কলাম করে (2+2+2) আর নিচের দুটো ৩ করে (3+3),
       * দুই সারিই ঠিক ৬-এ পূর্ণ হয়।
       *
       * xl-এ পাঁচটাই এক সারিতে, তাই span আবার ১-এ ফেরে।
       */}
      {/* ⚠️ `sm:grid-cols-2` ছিল, আর globals.css-এ sm = 320px বলে সেটা
           ৩২০px-এই দুই কলাম বানাত। তখন প্রতিটা কার্ড ~১৩০px, অথচ
           ভেতরে লাগে ৩২ (padding) + ~৯৫ ("Managers", Frank Ruhl 20px)
           + ১২ (gap) + ৪০ (icon বৃত্ত) = ১৭৯ — তাই শিরোনামটা
           icon-এর নিচ দিয়ে বেরিয়ে যেত আর দুটো একে অন্যের উপর
           বসত। ৪৮০ থেকে দুই কলাম দিলে কার্ড ~২০৬px, তখন আঁটে। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 md:grid-cols-6 xl:grid-cols-5">
        {STAFF_GROUPS.map((group, index) => (
          /**
           * Figma Card: column, padding 16, gap 20, radius 16,
           * BG #F9F6F3, উচ্চতা 140।
           *
           * ১৪০-টা মিলিয়ে দেখার মতো, কারণ এটা hug — অর্থাৎ ভেতরের
           * জিনিস থেকেই আসে:
           *   16 + 40 (উপরের সারি) + 20 (gap) + 48 (নিচের ব্লক) + 16 = 140
           * তাই কোথাও উচ্চতা লিখে দেওয়ার দরকার নেই; মাপগুলো ঠিক
           * থাকলে ১৪০ আপনাআপনি আসে।
           */
          <div
            key={group.label}
            /* উপরের সারির তিনটে ২ কলাম, নিচের দুটো ৩ — উপরের
               ব্যাখ্যা দ্রষ্টব্য। ক্লাসগুলো আস্ত লেখা, `md:col-span-${n}`
               নয়: Tailwind source-এ আক্ষরিক নাম না পেলে class-টা
               তৈরিই করে না। */
            className={`flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4 xl:col-span-1 ${
              index < 3 ? "md:col-span-2" : "md:col-span-3"
            }`}
          >
            {/* Frame 2147232365: row, space-between, উচ্চতা 40 —
                উচ্চতাটা icon-বৃত্তেরই, শিরোনাম মাত্র 20px। */}
            <div className="flex items-center justify-between gap-3">
              {/* Figma: Frank Ruhl Libre 500, 20px, LH 100%, #000000। */}
              {/* `truncate` — শেষ রক্ষাকবচ। "Managers" একটাই শব্দ, তাই
                  জায়গা কম পড়লে সে ভাঙতে পারে না; `min-w-0` তাকে
                  সংকুচিত হতে দেয় বটে, কিন্তু লেখাটা তখন বাক্সের বাইরে
                  উপচে icon-এর উপর গিয়ে পড়ে। কাটা "Manag…" সুন্দর নয়,
                  তবু দুটো জিনিস একে অন্যের উপর বসার চেয়ে ভালো। */}
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {group.label}
              </h3>
              {/* Frame 2147232069: 40×40, BG #FFFFFF, radius 79.8
                  (অর্থাৎ পুরো গোল), padding 7.98। ভেতরের icon 18×18,
                  stroke 1.2, Black/100। */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <group.icon
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
                {countFor(group.roles)}
              </p>
              {/* Figma: Sora 400, 12px, LH 100%, Black/70।

                  ⚠️ period বাছলে লেখাটা বদলায়, কারণ সংখ্যার মানেই
                  বদলে যায় — "Kitchen Team 1" আর "Joined this month 1"
                  এক জিনিস নয়। সংখ্যাটা কীসের, সেটা সংখ্যার পাশেই
                  থাকা দরকার। */}
              <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                {period === "all"
                  ? group.hint
                  : period === "this-month"
                    ? "Joined this month"
                    : "Joined last month"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
