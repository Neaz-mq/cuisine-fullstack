import { Calendar, CalendarCheck, CheckCircle2, LayoutGrid, Table2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import {
  DEFAULT_TABLE_PERIOD,
  isTablePeriod,
  tablePeriodCaptions,
  tablePeriodRange,
} from "@/lib/table-period";
import TablesBoard, { type TableRow } from "./TablesBoard";
import TablesToolbar from "./TablesToolbar";
import TablePeriodFilter from "./TablePeriodFilter";

/**
 * src/app/admin/tables/page.tsx
 *
 * Figma "Tables" — Welcome শিরোনাম, Overview-র চারটে সংখ্যা, তারপর
 * টেবিলের গ্রিড।
 *
 * ⚠️ পুরোনো পাতাটা `max-w-4xl mx-auto px-4 py-8` দিয়ে নিজের একটা
 * container বানাত আর `border-gray-200` সারিতে টেবিল দেখাত — অর্থাৎ
 * অ্যাপের নকশা-ব্যবস্থার বাইরে। Settings-এর ক্ষেত্রেও ঠিক এটাই
 * হয়েছিল, আর সারানোটাও একই ছাঁদে।
 *
 * ⚠️ পুরোনো `/admin/tables/new` আর `/admin/tables/[id]/edit` পাতা
 * দুটো **মুছিনি**। এখন যোগ/সম্পাদনা modal-এ হয় (Figma তাই বলে), তাই
 * ওখানে যাওয়ার কোনো লিঙ্ক আর নেই — কিন্তু route দুটো কাজ করে, আর
 * `TableForm.tsx`-ও অক্ষত। নিশ্চিত হয়ে পরে আলাদা commit-এ সরানোই
 * নিরাপদ।
 */
export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() ?? "";

  // অচেনা মান চুপচাপ ডিফল্ট হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  // তালিকাটা lib/table-period.ts থেকে, এখানে আবার লেখা হয়নি।
  const period = isTablePeriod(params.period) ? params.period : DEFAULT_TABLE_PERIOD;
  const range = tablePeriodRange(period);
  const captions = tablePeriodCaptions(period);

  const [session, settings] = await Promise.all([
    requireStaff("tables"),
    getRestaurantSettings(),
  ]);

  const now = new Date();

  const rawTables = await prisma.restaurantTable.findMany({
    include: {
      _count: { select: { reservations: true } },
      /**
       * ⚠️ শুধু **আসন্ন** reservation, সবগুলো নয়, আর মোটে দুটো।
       *
       * কার্ডে দেখানো হয় একটা সংখ্যা আর পরেরটার সময় — গত বছরের
       * তিনশো reservation টেনে আনার কোনো কারণ নেই। `take: 2` কারণ
       * প্রথমটা দেখানো হয়, আর দ্বিতীয়টার অস্তিত্ব বলে দেয় "আরও
       * আছে" কিনা।
       */
      reservations: {
        where: { reservedAt: { gte: now }, status: { not: "CANCELLED" } },
        orderBy: { reservedAt: "asc" },
        take: 2,
        select: { id: true, reservedAt: true },
      },
    },
  });

  /**
   * ⚠️ Prisma-র string sort "T-10"-কে "T-1"-এর ঠিক পরে বসায়
   * (lexicographic), কিন্তু চাই T-1, T-2 … T-10। label থেকে সংখ্যাটা
   * বের করে তার উপর সাজানো — এটা পুরোনো পাতা থেকেই আনা, কারণ
   * সমস্যাটা নকশা বদলালেও বদলায় না।
   */
  const sorted = [...rawTables].sort((a, b) => {
    const numA = parseInt(a.label.replace(/\D/g, ""), 10);
    const numB = parseInt(b.label.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.label.localeCompare(b.label);
  });

  /**
   * ⚠️ তারিখটা **server-এ** সাজানো হয়, তাও রেস্তোরাঁর নিজের timezone-এ।
   *
   * client-এ `toLocaleString()` ডাকলে সেটা **দর্শকের** ঘড়ি ধরত —
   * ছুটিতে থাকা একজন ম্যানেজারের কাছে রাত ৯টার bookingটা অন্য সময়ে
   * দেখাত। রেস্তোরাঁর সময় ছাড়া অন্য কিছু এখানে অর্থহীন।
   */
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: settings.timezone,
  });

  const allTables: TableRow[] = sorted.map((table) => ({
    id: table.id,
    label: table.label,
    name: table.name,
    capacity: table.capacity,
    isActive: table.isActive,
    imageUrl: table.imageUrl,
    upcomingCount: table.reservations.length,
    nextReservationLabel: table.reservations[0]
      ? timeFormatter.format(table.reservations[0].reservedAt)
      : null,
  }));

  /**
   * ⚠️ খোঁজাটা **server-এ**, URL-এর `?q=` থেকে — client state-এ নয়।
   *
   * তিনটে কারণে: লিঙ্কটা share/bookmark করা যায়, back বোতাম কাজ করে,
   * আর Export বোতাম একই `q` forward করে বলে ফাইলে ঠিক পর্দার তালিকাটাই
   * নামে। Categories, Staff, Suppliers, Inventory আর Kitchen — পাঁচটা
   * পাতাতেই এটাই।
   */
  const tables = q
    ? allTables.filter(
        (table) =>
          table.label.toLowerCase().includes(q) ||
          (table.name ?? "").toLowerCase().includes(q)
      )
    : allTables;

  /**
   * Overview-র চারটে সংখ্যা — বাছা period-এর জানালায়।
   *
   * ⚠️ আলাদা একটা groupBy, উপরের `reservations` থেকে গোনা নয়। ওখানে
   * `take: 2` (কার্ডে একটা সংখ্যা আর পরেরটার সময় দেখানোর জন্য যথেষ্ট),
   * তাই ওটা দিয়ে গুনলে ছয়টা বুকিং থাকা টেবিলও "2" দেখাত। সীমাটা
   * তোলা যেত, কিন্তু তাতে প্রতিটা পাতা-লোডে বছরের সব reservation
   * টেনে আনতে হতো — অথচ দরকার কেবল একটা সংখ্যা।
   */
  const bookedGroups = await prisma.reservation.groupBy({
    by: ["tableId"],
    where: { reservedAt: { gte: range.gte, lt: range.lt }, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });

  const bookedByTable = new Map(bookedGroups.map((g) => [g.tableId, g._count._all]));

  /**
   * ⚠️ `allTables` থেকে, `tables` থেকে নয় — অর্থাৎ খোঁজায় সংখ্যাগুলো
   * বদলায় না। "Overview" মানে গোটা রেস্তোরাঁর ছবি; "T-3" লিখলে
   * "Total Tables: 1" দেখানো একটা overview নয়, একটা search result।
   *
   * ⚠️ "Available" আর "Booked" মিলে "Active"-এর সমান — অর্থাৎ
   * নিষ্ক্রিয় টেবিল কোনোটাতেই গোনা হয় না। সেটাই ঠিক: একটা নিষ্ক্রিয়
   * টেবিল খালিও নয়, বুকডও নয়, ব্যবহারের বাইরে।
   *
   * ⚠️ `total` একমাত্র সংখ্যা যা period-এ বদলায় না। ২৪টা টেবিল আজও
   * ২৪টা, আগামী সপ্তাহেও — ওটা সঞ্চিত, জানালার হিসাব নয়।
   */
  const total = allTables.length;
  const activeTables = allTables.filter((t) => t.isActive);
  const booked = activeTables.filter((t) => (bookedByTable.get(t.id) ?? 0) > 0).length;
  const available = activeTables.length - booked;
  const reserved = bookedGroups.reduce((sum, g) => sum + g._count._all, 0);

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Orders/Settings-এর একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-end">
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

          {/**
            * ⚠️ forwardParams-এ শুধু `q` — `page` নেই, ইচ্ছাকৃতভাবে।
            * Export মানে পুরো ছাঁকা তালিকা, পর্দায় দেখা পনেরোটা কার্ড
            * নয়। Categories-এর ExportReportButton-এও একই কথা লেখা।
            */}
          <ExportReportButton
            endpoint="/api/admin/tables/export"
            forwardParams={["q"]}
            fallbackFilename="cuisine-tables.csv"
          />
        </div>
      </div>

      {/* Figma Frame 2147236264 — search + "Add Table", header-এর নিচে। */}
      <TablesToolbar />

      {/* --- Overview --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        {/* Figma: শিরোনামের ডানে একটা period pill ("Today")। */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[20px] font-semibold leading-none text-black min-[480px]:text-[24px]">
            Overview
          </h2>

          <TablePeriodFilter value={period} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Table2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            label="Total Tables"
            value={total}
            caption="All restaurant tables"
          />
          {/* ⚠️ নিচের তিনটে caption period-ভেদে বদলায় — সংখ্যাটা
              কীসের, সেটা সংখ্যার পাশেই লেখা থাকা দরকার। শুধু উপরের
              pill দেখে অনুমান করতে হলে ভুল হবেই। */}
          <StatCard
            icon={<LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            label="Available Tables"
            value={available}
            caption={captions.available}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            label="Booked Tables"
            value={booked}
            caption={captions.booked}
          />
          <StatCard
            icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            label="Reserved Tables"
            value={reserved}
            caption={captions.reserved}
          />
        </div>
      </section>

      <TablesBoard tables={tables} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-frank-ruhl text-[13px] font-medium leading-[1.3] text-black min-[480px]:text-[14px]">
          {label}
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black/70">
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-sora text-[22px] font-semibold leading-none text-black min-[480px]:text-[26px]">
          {value}
        </span>
        <span className="font-sora text-[11px] leading-[1.4] text-black/50">{caption}</span>
      </div>
    </div>
  );
}
