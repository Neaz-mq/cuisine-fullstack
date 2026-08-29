import {
  Banknote,
  Bike,
  Briefcase,
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
 * ⚠️ চারটে মিলেছে, পঞ্চমটা মেলেনি — এই app-এ "Cleaner" বলে কোনো role
 * নেই (দেখুন schema-র enum Role)। ওই কার্ডটা রাখলে সেটা চিরকাল ০
 * দেখাত, আর একটা সংখ্যা যেটা কখনো বদলায় না সেটা তথ্য নয়, আসবাব।
 * তার জায়গায় Cashiers — role-টা সত্যিই আছে, আর গুনে দেখার মতোও।
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
  { label: "Cashiers", roles: ["CASHIER"] as const, hint: "Front Desk", icon: Banknote },
];

/** "Jul 3, 2026" — Figma-র Member Since কলামের গড়ন। */
function formatJoinDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * নামের আদ্যক্ষর — ছবির বিকল্প।
 *
 * ⚠️ Figma-তে প্রতিটা সারিতে গ্রাহকের ছবি, কিন্তু User model-এ কোনো
 * `image` কলামই নেই (Google দিয়ে sign in করলেও NextAuth-এর callback
 * সেটা রাখে না)। ছবি দেখাতে হলে আগে একটা কলাম, upload route আর
 * storage bucket লাগবে — সেটা আলাদা কাজ।
 *
 * ততক্ষণ আদ্যক্ষর, কারণ শূন্য একটা ধূসর চৌকো সারিগুলোকে একটার সাথে
 * আরেকটা মিলিয়ে দিত; অন্তত অক্ষরটা চোখকে সারি চিনতে সাহায্য করে।
 */
function initialsOf(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
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

      {/* --- Overview — Figma card: radius 20, padding 30, gap 24 --- */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
            Overview
          </h2>

          {/**
           * ⚠️ Figma-তে এখানে "Today ⌄" — বসানো হয়নি, ঠিক যে কারণে
           * dashboard-এর Kitchen Inventory কার্ডেও বসানো হয়নি।
           *
           * নিচের পাঁচটা সংখ্যাই *এই মুহূর্তে* কতজন কর্মী আছেন, কোনো
           * সময়কালের হিসাব নয়। "This Year" বাছলে সংখ্যা এক চুলও বদলাত
           * না, অথচ ব্যবহারকারী ভাবতেন বদলেছে।
           */}
        </div>

        {/* Figma: row, gap 20, পাঁচটা কার্ড সমান ভাগে। */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:gap-5">
          {STAFF_GROUPS.map((group) => (
            <div
              key={group.label}
              className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
                  {group.label}
                </h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <group.icon
                    className="h-[18px] w-[18px] text-black"
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {countFor(group.roles)}
                </p>
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
                <div
                  key={user.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-6"
                >
                  {/* পরিচয় — Figma: ছবি 56×56 radius 8, তারপর নাম ও ইমেইল। */}
                  <div className="flex min-w-0 items-center gap-3 xl:w-[230px] xl:shrink-0">
                    <span
                      aria-hidden="true"
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-frank-ruhl text-[18px] font-semibold text-white"
                    >
                      {initialsOf(user.name, user.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-frank-ruhl text-[18px] font-semibold leading-tight text-black">
                        {user.name ?? "Unnamed"}
                      </p>
                      <p className="truncate font-sora text-[12px] leading-tight text-black/70">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:min-w-0 xl:flex-1 xl:gap-6">
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
          <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-black/70">
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
    <div className="min-w-0 xl:flex-1">
      <p className="truncate font-sora text-[13px] font-normal leading-none text-black/70 xl:text-[14px]">
        {label}
      </p>
      <p className="mt-2 truncate font-frank-ruhl text-[15px] font-medium leading-none text-black xl:text-[16px]">
        {value}
      </p>
    </div>
  );
}