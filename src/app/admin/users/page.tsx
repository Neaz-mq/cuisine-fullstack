import {
  Bike,
  Briefcase,
  Brush,
  Calendar,
  ChefHat,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import UsersToolbar from "./UsersToolbar";
import {
  CATEGORY_LABELS,
  categoryFor,
  isCustomerCategory,
  pointsRangeFor,
  type CustomerCategory,
} from "@/lib/customer-category";

export const metadata = { title: "Users" };

const USERS_PER_PAGE = 10;

/**
 * Figma-র Overview সারি: Managers · Chefs · Waiters · Rider · Cleaners।
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

/** "Jul 3, 2026" — Figma-র Member Since কলামের গড়ন। */
function formatJoinDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * সারির ছবি — Figma: 60×60, radius 12, BG #F9F6F3।
 *
 * Google দিয়ে login করলে তাঁর প্রোফাইল ছবিটা দেখানো হয় (auth.ts-এর
 * signIn callback ওটা User.image-এ রাখে)। ইমেইল-পাসওয়ার্ড দিয়ে তৈরি
 * account-এ কোনো ছবি থাকে না, আর upload করার ব্যবস্থাও নেই — সেখানে
 * একটা নিরপেক্ষ silhouette।
 *
 * ⚠️ next/image নয়, সাধারণ <img>।
 *
 * next/image ব্যবহার করলে next.config-এ lh3.googleusercontent.com-কে
 * remotePatterns-এ যোগ করতে হতো, নাহলে runtime-এ ছবির বদলে error।
 * একটা ৬০px avatar-এ optimization-এর লাভ সামান্য, অথচ config ঠিকমতো
 * না বসলে পুরো পাতাটাই ভেঙে পড়ত। Google-এর CDN এমনিতেও ছোট মাপে
 * ছবি পাঠায়।
 *
 * `referrerPolicy="no-referrer"` — Google মাঝে মাঝে referrer দেখে
 * ছবি আটকে দেয় (403), আর তখন সব সারিতে ভাঙা ছবির চিহ্ন আসত।
 */
function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name}-এর প্রোফাইল ছবি`}
        width={60}
        height={60}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-[60px] w-[60px] shrink-0 rounded-[12px] object-cover"
      />
    );
  }

  return (
    /**
     * পটভূমি সাদা, #F9F6F3 নয় — যদিও Figma-তে বাক্সটা cream।
     *
     * Figma-তে ওর উপরে সবসময় একটা ছবি বসে, তাই রঙটা কখনো দেখাই
     * যায় না। আমাদের এখানে ছবি না থাকলে সেটাই দেখা যাবে — আর সারির
     * পটভূমিও #F9F6F3 হওয়ায় বাক্সটা একেবারে মিলিয়ে যেত, ফলে
     * silhouette-টা শূন্যে ভাসত। সাদা রাখায় জায়গাটা একটা "খালি
     * ছবির ঘর" বলে বোঝা যায়।
     */
    <span
      aria-hidden="true"
      className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-white"
    >
      <UserRound className="h-8 w-8 text-black/25" fill="currentColor" strokeWidth={1.2} />
    </span>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  // layout-এও গেট আছে; এখানে session লাগে শুধু শিরোনামের নামটার জন্য।
  const session = await requireStaff("staff");

  const params = await searchParams;
  const q = params.q?.trim();
  const category: CustomerCategory | null = isCustomerCategory(params.category)
    ? params.category
    : null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();

  /**
   * তালিকাটা কেবল গ্রাহকদের, কর্মীদের নয়।
   *
   * Figma-র প্রতিটা কলামই গ্রাহকের তথ্য — Member Since, Reward Points,
   * Total Orders, Customer Category। কর্মীর ক্ষেত্রে এর একটাও অর্থবহ
   * নয়, আর কর্মীদের নিজের পাতা /admin/staff-এ আলাদা করে আছে (সেখানে
   * employeeId, department, hire date — যেগুলো আবার গ্রাহকের নেই)।
   */
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category === "new"
      ? // "New" মানে এখনো একটাও order করেননি — পয়েন্টের হিসাব নয়।
        { orders: { none: {} } }
      : category
        ? {
            // বাকিগুলো tier, অর্থাৎ পয়েন্টের সীমা। সাথে `some: {}` —
            // নাহলে শূন্য-order গ্রাহকেরা Bronze-এও এসে পড়তেন, আর তখন
            // "New" আর "Bronze" দুটোতেই একই লোক দেখা যেত।
            orders: { some: {} },
            loyaltyPoints: (() => {
              const { min, max } = pointsRangeFor(category);
              return max === null ? { gte: min } : { gte: min, lt: max };
            })(),
          }
        : {}),
  };

  const [staffCounts, total, users] = await Promise.all([
    /**
     * এক query-তে পাঁচটা কার্ডের সংখ্যা।
     *
     * নিষ্ক্রিয় কর্মী বাদ, কিন্তু StaffProfile নেই এমন কেউ বাদ নয় —
     * seed-এ বানানো OWNER account-টার কোনো StaffProfile নেই, অথচ
     * তিনিই মালিক। শুধু `staffProfile.isActive` দেখলে তিনি গোনায়
     * ধরা পড়তেন না।
     */
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: {
        role: { not: "CUSTOMER" },
        OR: [{ staffProfile: { is: null } }, { staffProfile: { isActive: true } }],
      },
    }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        loyaltyPoints: true,
        image: true,
        // ⚠️ বাতিল order-ও এতে গোনা হয়। "কতবার order করেছেন" প্রশ্নের
        // উত্তরে সেটাই ঠিক — বাতিল হওয়া মানে তো তিনি চেষ্টা করেননি এমন
        // নয়। টাকার হিসাবে বাতিল বাদ যায় (dashboard দ্রষ্টব্য), কিন্তু
        // এটা টাকার হিসাব নয়।
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const countFor = (roles: readonly string[]) =>
    staffCounts
      .filter((row) => roles.includes(row.role))
      .reduce((sum, row) => sum + row._count._all, 0);

  const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const rangeStart = total === 0 ? 0 : (page - 1) * USERS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * USERS_PER_PAGE, total);

  return (
    <div className="space-y-4">
      {/* --- Welcome header — dashboard-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 sm:text-[26px] md:text-[30px] md:leading-none">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        {/**
         * তারিখ + Export — dashboard-এর হুবহু একই গড়ন, একই breakpoint
         * আচরণ। ৩২০px-এ `flex-wrap` লাগে: দুটো মিলে ~৩২২px, অথচ
         * ওখানে padding বাদে থাকে ২৮৮।
         */}
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 font-sora text-[14px] leading-none text-black">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span className="sm:hidden">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="hidden sm:inline">
              {now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>

          {/**
           * ⚠️ একই বোতাম, ভিন্ন গন্তব্য।
           *
           * ডিফল্টে এটা /api/admin/insights/export-এ যায় — অর্থাৎ
           * order-এর হিসাব। এই পাতায় সেটা নামলে নাম এক হতো, ফল ভুল:
           * গ্রাহকের তালিকা চেয়ে order-এর CSV পাওয়া যেত। তাই route-টা
           * prop, আর এখানে গ্রাহক-তালিকার নিজের route।
           *
           * forwardParams-এ `page` নেই, ইচ্ছাকৃতভাবে — export মানে
           * পুরো ছাঁকা তালিকা, পর্দায় দেখা দশটা সারি নয়।
           */}
          <ExportReportButton
            endpoint="/api/admin/users/export"
            forwardParams={["q", "category"]}
            fallbackFilename="cuisine-customers.csv"
          />
        </div>
      </div>

      <UsersToolbar category={category} />

      {/**
       * --- Overview ---
       *
       * Figma Frame 2147236275: column, padding 30, gap 24, radius 20,
       * BG #FFFFFF, উচ্চতা 264 (hug)।
       *
       * ⚠️ শিরোনামের পাশে Figma-তে একটা "This Week ⌄" pill আঁকা
       * (Frame 2147236233 — 91×40, padding 12, gap 8, BG #F9F6F3,
       * radius 100)। বসানো হয়নি, আর CSS export নিজেই এই সিদ্ধান্তের
       * পক্ষে তিনটে প্রমাণ দেয়:
       *
       *   ১। শিরোনামের layer-এর নাম এখনো "Resent Orders" — অর্থাৎ
       *      পুরো frame-টা dashboard-এর Recent Orders কার্ড থেকে copy
       *      করা, ওখানে ছাঁকনিটার মানে ছিল।
       *   ২। প্রতিটা কার্ডের ভেতরে একটা delta pill আছে যেটা
       *      `display: none` — ওটাও copy-র উচ্ছিষ্ট।
       *   ৩। hint-এর layer-লেখা "VS last Week", অথচ মকআপে সত্যিকারের
       *      লেখা "Restaurant Management"।
       *
       * আসল কারণটা অবশ্য উদ্দেশ্যের: নিচের পাঁচটা সংখ্যাই *এই
       * মুহূর্তে* কতজন কর্মী আছেন — গুদামের stock-এর মতোই বর্তমান
       * অবস্থা, কোনো সময়কালের হিসাব নয়। "This Year" বাছলে সংখ্যা এক
       * চুলও বদলাত না, অথচ ব্যবহারকারী ভাবতেন বদলেছে। Dashboard-এর
       * Kitchen Inventory কার্ডেও ঠিক এই যুক্তিতেই ওটা বাদ গেছে।
       */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        {/* Figma: Frank Ruhl Libre 600, 30px, LH 100%, #000000। */}
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
          Overview
        </h2>

        {/* Figma Frame 2147236226: row, gap 20, উচ্চতা 140, পাঁচটা
            কার্ড `flex-grow: 1` — অর্থাৎ সমান ভাগে। */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {STAFF_GROUPS.map((group) => (
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
              className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4"
            >
              {/* Frame 2147232365: row, space-between, উচ্চতা 40 —
                  উচ্চতাটা icon-বৃত্তেরই, শিরোনাম মাত্র 20px। */}
              <div className="flex items-center justify-between gap-3">
                {/* Figma: Frank Ruhl Libre 500, 20px, LH 100%, #000000। */}
                <h3 className="min-w-0 font-frank-ruhl text-[20px] font-medium leading-none text-black">
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
                {/* Figma: Sora 400, 12px, LH 100%, Black/70। */}
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                  {group.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Users --- */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
            Users
          </h2>

          {/**
           * ⚠️ Figma-তে এখানে আরেকটা "All ⌄" dropdown — উপরের
           * "All Statuses"-এর ঠিক পাশেই, একই কার্ডে।
           *
           * দুটো ছাঁকনির জন্য দুটো আলাদা অক্ষ দরকার, কিন্তু গ্রাহকের
           * ক্ষেত্রে ছাঁকার মতো অক্ষ একটাই — তাঁর শ্রেণি। দুটো control
           * একই জিনিস ছাঁকলে ব্যবহারকারীকে ভাবতে হয় "এই দুটোর তফাত
           * কী", আর একটা বদলে অন্যটা না বদলালে সেটা ভাঙা মনে হয়।
           *
           * তাই ছাঁকনিটা উপরে (যেখানে search-এর পাশে থাকা স্বাভাবিক),
           * আর এই জায়গাটায় pill-এর গড়ন রেখে ভেতরে সংখ্যা — কারণ
           * "কতজন দেখছি" প্রশ্নটার উত্তর এখানেই খোঁজা হয়।
           */}
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {total} {total === 1 ? "customer" : "customers"}
          </span>
        </div>

        {users.length === 0 ? (
          <p className="py-10 text-center font-sora text-[14px] text-black/70">
            {q || category
              ? "No customers match this filter."
              : "No customers yet."}
          </p>
        ) : (
          /* Figma: column, gap 16। */
          <div className="flex flex-col gap-4">
            {users.map((user) => {
              const orderCount = user._count.orders;
              const userCategory = categoryFor(user.loyaltyPoints, orderCount);

              return (
                /**
                 * Figma row: radius 16, padding 16, BG #F9F6F3, ছ'টা
                 * কলাম এক সারিতে।
                 *
                 * ⚠️ এক সারিতে ছ'টা কলাম কেবল xl থেকে। ৩২০px-এ শুধু
                 * "Phone Number" শিরোনামটাই ~১১০px, ছ'টা মিলে ৭০০-র
                 * বেশি — কোনো কৌশলেই ওটা ২৪৮px-এ ঢোকে না। তাই ছোট
                 * পর্দায় পরিচয়টা উপরে, বাকি পাঁচটা মাঠ নিচে দুই
                 * কলামে। প্রতিটা মাঠের নিজের শিরোনাম সাথেই থাকে, তাই
                 * সারি ভাঙলেও কোন সংখ্যা কীসের সেটা হারায় না — table-এর
                 * header সারি হলে সেটা হারাত।
                 */
                /* Figma Frame 2147236316: row, padding 16, gap 30,
                   উচ্চতা 92, radius 16, BG #F9F6F3।
                   ৯২ = 16 + 60 (ছবি) + 16 — অর্থাৎ ছবিটাই উচ্চতা ঠিক করে। */
                <div
                  key={user.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-[30px]"
                >
                  {/* Frame 2147236287: row, gap 16, চওড়া 203, উচ্চতা 60। */}
                  <div className="flex min-w-0 items-center gap-4 xl:w-[203px] xl:shrink-0">
                    <Avatar src={user.image} name={user.name ?? user.email} />

                    {/* Frame 2147236286: column, gap 4। */}
                    <div className="flex min-w-0 flex-col gap-1">
                      {/* Figma: Frank Ruhl Libre 500, 20px, LH 120%, #000000। */}
                      <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                        {user.name ?? "Unnamed"}
                      </p>
                      {/* Figma: Sora 400, 12px, LH 170%, Black/70। */}
                      <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Frame 2147236376: row, space-between, gap 30,
                      উচ্চতা 42, flex-grow 1। */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:min-w-0 xl:flex-1 xl:gap-[30px]">
                    <Field label="Member Since" value={formatJoinDate(user.createdAt)} />
                    {/* ফোন নম্বর ঐচ্ছিক — Google দিয়ে sign in করলে কখনোই
                        আসে না (schema-র মন্তব্য দ্রষ্টব্য)। */}
                    <Field label="Phone Number" value={user.phone ?? "—"} />
                    <Field label="Customer Category" value={CATEGORY_LABELS[userCategory]} />
                    <Field label="Reward Points" value={`${user.loyaltyPoints} Points`} />
                    <Field
                      label="Total Orders"
                      value={`${orderCount} ${orderCount === 1 ? "Order" : "Orders"}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Figma: row, space-between — বাঁয়ে গণনা, ডানে pagination। */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Figma Frame 2147232338: gap 6, বিন্দু 6px #FF9540, লেখা
              Sora 400 12px LH 15px rgba(18,18,18,0.6)। */}
          <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing{" "}
            <span className="font-semibold text-black">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-black">{total}</span>{" "}
            {/* ⚠️ Figma-তে লেখা "Transactions" — Recent Orders কার্ড থেকে
                frame copy করার চিহ্ন। এখানে সারিগুলো মানুষ, লেনদেন নয়। */}
            Customers
          </p>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath="/admin/users"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * সারির একটা মাঠ — উপরে শিরোনাম, নিচে মান।
 *
 * Figma: শিরোনাম Sora 400 14px Black/70, মান Frank Ruhl 500 16px
 * #000000, মাঝে 8px।
 */
function Field({ label, value }: { label: string; value: string }) {
  return (
    // Figma Frame 2147236290: column, gap 12, উচ্চতা 42।
    <div className="flex min-w-0 flex-col gap-3 xl:flex-1">
      {/**
       * Figma: Sora 400, 14px, LH 100%, Black/70।
       *
       * ⚠️ xl-এ `whitespace-nowrap`, truncate নয় — আগে "Customer
       * Category" কেটে গিয়ে "Customer Catego…" দেখাচ্ছিল।
       *
       * কারণটা জায়গার অভাব ছিল না, হিসাবের: Figma-তে মাঠগুলোর জন্য
       * বরাদ্দ ৭৩৪px, চারটে ৩০px gap বাদ দিলে পাঁচ ভাগে ~১২৩px করে,
       * আর "Customer Category" ১৪px Sora-তে ~১২৫। অর্থাৎ শিরোনামটাই
       * সবচেয়ে চওড়া, আর ওটাই কলামের প্রস্থ ঠিক করার কথা। truncate
       * সেটা হতে দিচ্ছিল না — সে বরং চুপচাপ কেটে দিচ্ছিল।
       *
       * xl-এর নিচে wrap করতে দেওয়া হয়, কারণ সেখানে সারি ভেঙে
       * দুই/তিন কলামের grid হয়ে যায় আর প্রস্থ অনেক কম।
       */}
      <p className="font-sora text-[13px] font-normal leading-none text-black/70 xl:whitespace-nowrap xl:text-[14px]">
        {label}
      </p>
      {/* Figma: Frank Ruhl Libre 500, 16px, LH 100%, #000000। */}
      <p className="truncate font-frank-ruhl text-[15px] font-medium leading-none text-black xl:text-[16px]">
        {value}
      </p>
    </div>
  );
}