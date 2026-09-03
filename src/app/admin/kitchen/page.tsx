import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { minutesAgo } from "@/lib/time";
import { orderIdSearchToken } from "@/lib/format-order-id";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import KitchenOverviewCards from "@/components/admin/KitchenOverviewCards";
import {
  DEFAULT_KITCHEN_STATUS,
  KITCHEN_STATUS_TO_ORDER_STATUS,
  isKitchenStatus,
} from "@/lib/kitchen-status";
import KitchenToolbar from "./KitchenToolbar";
import KitchenBoard from "./KitchenBoard";

export const metadata = { title: "Kitchen Display" };

/**
 * src/app/admin/kitchen/page.tsx
 *
 * Figma Frame 2147236230 — Welcome header → search + ছাঁকনি → Overview
 * → Kitchen Display।
 *
 * ⚠️ এই পাতাটা আগে অ্যাপের নকশা-ব্যবস্থার বাইরে ছিল: `bg-gray-100`,
 * `rounded-md`, `text-gray-800`, `max-w-6xl mx-auto` — অর্থাৎ Tailwind-এর
 * ডিফল্ট ধূসর রঙ আর নিজের একটা container, যেখানে বাকি সব admin পাতা
 * AdminShell-এর ভেতরে cream/orange ব্যবস্থায় চলে। তাই এটা "একটু
 * সাজানো" নয়, পুরো খোলসটাই বদলাতে হয়েছে।
 */
const READY_COLUMN_WINDOW_MINUTES = 15;

export default async function KitchenDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  // layout.tsx-ও `requireStaff("kitchen")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("kitchen");
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = isKitchenStatus(params.status) ? params.status : DEFAULT_KITCHEN_STATUS;
  const readySince = minutesAgo(READY_COLUMN_WINDOW_MINUTES);
  const now = new Date();

  /**
   * "আজ" মানে স্থানীয় দিনের শুরু, UTC-র মধ্যরাত নয়।
   *
   * ⚠️ `new Date(Date.UTC(...))` লিখলে বাংলাদেশে (UTC+6) দিন বদলাত
   * সকাল ৬টায় — অর্থাৎ ভোরের অর্ডারগুলো "গতকাল"-এ পড়ত। প্রজেক্টের
   * নিয়ম অনুযায়ী তারিখের হিসাব local time-এ।
   */
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const boardStatuses = {
    OR: [
      { status: { in: ["PLACED", "PREPARING"] as const } },
      { status: "OUT_FOR_DELIVERY" as const, updatedAt: { gte: readySince } },
    ],
  };

  const [rows, totalToday] = await Promise.all([
    prisma.order.findMany({
      where: boardStatuses,
      include: {
        items: { include: { menuItem: { select: { title: true } } } },
        table: { select: { label: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
  ]);

  /**
   * ⚠️ search আর status ছাঁকাটা memory-তে, DB-তে নয় — দুটো আলাদা কারণে।
   *
   * search: অর্ডার-আইডি পর্দায় দেখানো হয় শেষ ছয় অক্ষর দিয়ে
   * (`formatOrderId`), আর `endsWith`-এ index কাজে লাগে না। বোর্ডে
   * সচল অর্ডার সবসময়ই অল্প (কয়েক ডজন), তাই এটা সস্তা।
   *
   * status: "ready" মানে `OUT_FOR_DELIVERY` **এবং** শেষ ১৫ মিনিটে
   * বদলানো — উপরের query-তে ওটা আগেই ধরা, তাই এখানে শুধু ভাগ করা।
   */
  const token = orderIdSearchToken(q);
  const visible = rows.filter((row) => {
    // ⚠️ তিনটে আলাদা `if` নয়, একটাই মানচিত্র — নতুন কোনো কলাম যোগ
    // হলে `lib/kitchen-status.ts`-এ একবার লিখলেই পাতা আর export
    // দুটোই সেটা মানে।
    if (status !== "all" && row.status !== KITCHEN_STATUS_TO_ORDER_STATUS[status]) return false;

    if (!q) return true;
    // আইডি বলে মনে হলে আইডিতেই খোঁজা, নাহলে খদ্দেরের নামে।
    if (token) return row.id.toLowerCase().endsWith(token.toLowerCase());
    const name = `${row.firstName} ${row.lastName}`.toLowerCase();
    return name.includes(q.toLowerCase());
  });

  // Overview-র সংখ্যাগুলো **ছাঁকার আগের** তালিকা থেকে — "এখন ৩টে
  // অর্ডার ঝুলে আছে" সত্যটা search box-এ কী লেখা তার উপর নির্ভর
  // করা উচিত নয়। Inventory-র Overview-তেও একই নিয়ম।
  const pending = rows.filter((row) => row.status === "PLACED").length;
  const preparing = rows.filter((row) => row.status === "PREPARING").length;
  const readyToServe = rows.filter((row) => row.status === "OUT_FOR_DELIVERY").length;

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Staff/Users পাতার হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          <ExportReportButton
            endpoint="/api/admin/kitchen/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-kitchen.csv"
          />
        </div>
      </div>

      <KitchenToolbar status={status} />

      <KitchenOverviewCards
        totalToday={totalToday}
        readyToServe={readyToServe}
        preparing={preparing}
        pending={pending}
      />

      {/* --- Kitchen Display — Frame 2147236276: column, padding 30,
              gap 24, radius 20, সাদা। --- */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Kitchen Display
        </h2>

        {/**
         * ⚠️ `JSON.parse(JSON.stringify(...))` — Prisma-র Date আর
         * Decimal সরাসরি client component-এ পাঠানো যায় না। আগের
         * কোডেও এটাই ছিল, ইচ্ছাকৃতভাবে রাখা।
         */}
        <KitchenBoard initialOrders={JSON.parse(JSON.stringify(visible))} />
      </div>
    </div>
  );
}
