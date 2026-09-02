import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import UsersOverviewCards from "@/components/admin/UsersOverviewCards";
import { DEFAULT_OVERVIEW_PERIOD, isOverviewPeriod } from "@/lib/overview-period";
import UserAvatar from "@/components/admin/UserAvatar";
import InfoField from "@/components/admin/InfoField";
import { formatJoinDate } from "@/lib/format-date";
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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string; period?: string }>;
}) {
  // layout-এও গেট আছে; এখানে session লাগে শুধু শিরোনামের নামটার জন্য।
  const session = await requireStaff("staff");

  const params = await searchParams;
  const q = params.q?.trim();
  const category: CustomerCategory | null = isCustomerCategory(params.category)
    ? params.category
    : null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  // অচেনা মান চুপচাপ ডিফল্টে নামে — URL হাতে বদলে দিলে error নয়,
  // শুধু ছাঁকনিটা "All"-এ ফেরে। বাকি ছাঁকনিগুলোরও একই আচরণ।
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;

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

  const [total, users] = await Promise.all([
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

  const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const rangeStart = total === 0 ? 0 : (page - 1) * USERS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * USERS_PER_PAGE, total);

  return (
    <div className="space-y-4">
      {/* --- Welcome header — dashboard-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        {/**
         * ⚠️ md-তে মাপটা ৩০ থেকে ২২-এ **নেমে** যায়, আর সেটাই এখানকার
         * আসল কথা।
         *
         * md-এর নিচে শিরোনাম নিজের সারিতে একা থাকে (উপরে flex-col),
         * তাই পুরো প্রস্থ তার — ৬৪০px-এ ২৬ দিব্যি আঁটে। md থেকে
         * layout সারিতে বদলায়, আর তখনই তাকে date + Export-এর সাথে
         * জায়গা ভাগ করতে হয়: ওই দুটো মিলে ~৩৫০px, অর্থাৎ ৭৬৮px পর্দায়
         * শিরোনামের জন্য পড়ে থাকে ~৩৮০।
         *
         * "Welcome Back, Md. Neaz Morshed!" ৩০px-এ ~৫০০px চওড়া — তাই
         * নামের মাঝখানে ভেঙে দু'লাইন হয়ে যেত। designer-এর tablet
         * frame-এও ঠিক এই কারণেই মাপটা ২২ (CSS export: Sora 600 22px,
         * LH 100%), ৩০ নয়।
         *
         * ৩০-এ ফেরা হয় xl (১২৮০) থেকে, যেখানে সারিতে সত্যিই জায়গা
         * আছে। মাঝের ধাপ lg-তে ২৬।
         *
         * ⚠️ তবু নিশ্চয়তা নয়, আর সেটা মেনে নেওয়া হয়েছে: নামটা
         * ব্যবহারকারীর ডেটা, দৈর্ঘ্যের কোনো সীমা নেই। designer মেপেছেন
         * "Ridoy Ahmed" দিয়ে (১১ অক্ষর), বাস্তবে "Md. Neaz Morshed"
         * (১৬)। যথেষ্ট লম্বা নামে ২২px-এও দু'লাইন হবে — কিন্তু
         * `min-w-0` থাকায় সেটা কেবল লাইন সংখ্যা বাড়ায়, বোতামকে
         * কিনারার বাইরে ঠেলে দেয় না। ভাঙা layout আর দু'লাইনের শিরোনাম
         * এক জিনিস নয়।
         */}
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
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
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {/* ⚠️ ৩২০px-এও পুরো তারিখ, বছর সহ — আগে সেখানে "Sep 2"
                দেখানো হতো, জায়গা বাঁচানোর জন্য।
                
                কিন্তু জায়গার টানটা ছিল **মাপের**, লেখার নয়। Figma-র
                ৩২০px frame (Frame 2147232352) বলছে: সারিটা ২৮৮ চওড়া,
                দুটো pill ১৩৯ করে, gap ১০ — আর pill-এর ভেতরে
                padding 12 + icon 20 + gap 8 + লেখা ৭৯ = ১৩১, অর্থাৎ
                ১৩৯-এ আঁটে। শর্ত একটাই: লেখাটা ১২px হতে হবে, ১৪ নয়।

                বছর বাদ দিলে "Sep 2" কোন বছরের তা বোঝার উপায় থাকে না —
                একটা report-এর পাতায় সেটা ঠিক ওই তথ্যটাই যেটা লাগে। */}
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
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

      {/* ⚠️ এটা আগে `<StaffOverviewCards />` ছিল — অর্থাৎ গ্রাহকের
          পাতার মাথায় কর্মীর হিসাব বসত। কারণটা component-টার নিজের
          মন্তব্যে লেখা আছে (দুই পাতায় একই ব্লক কপি না রাখা), কিন্তু
          দুই পাতার Figma আসলে আলাদা: staff-এ পাঁচটা role-কার্ড,
          users-এ চারটে গ্রাহক-কার্ড। বিস্তারিত UsersOverviewCards-এ। */}
      <UsersOverviewCards period={period} />

      {/* --- Users --- */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
        {/* ⚠️ `items-center`, `items-start` নয়।

            শিরোনামটা `leading-none`, অর্থাৎ তার line box ঠিক অক্ষরের
            উচ্চতা (২৪px)। পাশের pill ৪০px উঁচু। `items-start`-এ দুটোর
            **উপরের কিনারা** মেলে, তাই ৪০px pill-এর ভেতরে লেখাটা
            মাঝখানে বসে আর শিরোনামটা তার চেয়ে ~৮px উপরে থেকে যায় —
            চোখে ধরা পড়ে, কিন্তু কারণটা ধরা পড়ে না।

            Suppliers আর Inventory-র একই সারিতে `items-center` ছিল,
            তাই ওখানে সমস্যাটা কখনো দেখা যায়নি। */}
        <div className="flex items-center justify-between gap-3">
          {/* Overview-এর শিরোনামের সাথে মাপ মেলানো — ব্যাখ্যা ওখানে। */}
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
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
                    <UserAvatar src={user.image} name={user.name ?? user.email} />

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
                  {/**
                   * Figma-র ৩২০px frame (Frame 2147236677): column,
                   * gap 20; প্রতিটা সারি (2147236675) row, gap 40,
                   * ভেতরে দুটো ৮৮px মাঠ।
                   *
                   * ⚠️ মাঠের **ক্রমটা** Figma-র, আর সেটা আগে ভুল ছিল।
                   * designer সাজিয়েছেন পড়ার ক্রমে:
                   *
                   *   Member Since  |  Reward Points
                   *   Phone Number  |  Total Orders
                   *   Customer Category (একাই, পুরো চওড়া)
                   *
                   * অর্থাৎ বাঁ কলামে "কবে থেকে, কীভাবে যোগাযোগ", ডান
                   * কলামে "কত কিনেছেন"। আগের ক্রমে (Member Since,
                   * Phone, Category, Points, Orders) দুটো সংখ্যা দুই
                   * সারিতে ছড়িয়ে যেত আর Category মাঝখানে পড়ে দুটো
                   * দলকে ভেঙে দিত।
                   *
                   * ⚠️ "Customer Category" শেষে আর `col-span-2` — Figma-তেও
                   * ওটা একা নিজের সারিতে। কারণটা মাপেরও: ১২px-এ
                   * শিরোনামটা লাগে ~১০৫px, অথচ দুই কলামে প্রতিটা মাঠ
                   * পায় ~১০০। একা রাখলে পুরো ২২৪ পায়, তাই দু'লাইনে
                   * ভাঙে না।
                   *
                   * ৫৬০ থেকে তিন কলাম, তখন প্রতিটা ~১৬৫px — সেখানে
                   * span-টা আর লাগে না।
                   */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5 min-[560px]:grid-cols-3 min-[560px]:gap-4 xl:flex xl:min-w-0 xl:flex-1 xl:gap-[30px]">
                    <InfoField label="Member Since" value={formatJoinDate(user.createdAt)} />
                    <InfoField label="Reward Points" value={`${user.loyaltyPoints} Points`} />
                    {/* ফোন নম্বর ঐচ্ছিক — Google দিয়ে sign in করলে কখনোই
                        আসে না (schema-র মন্তব্য দ্রষ্টব্য)। */}
                    <InfoField label="Phone Number" value={user.phone ?? "—"} />
                    <InfoField
                      label="Total Orders"
                      value={`${orderCount} ${orderCount === 1 ? "Order" : "Orders"}`}
                    />
                    <InfoField
                      className="col-span-2 min-[560px]:col-span-1 xl:flex-1"
                      label="Customer Category"
                      value={CATEGORY_LABELS[userCategory]}
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