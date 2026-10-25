import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getPrepList } from "@/lib/kitchen-dashboard-data";
import {
  DEFAULT_PREP_STATUS,
  filterPrepRows,
  isPrepStatusFilter,
  summarizePrep,
  summarizePrepCounts,
} from "@/lib/kitchen-dashboard";
import {
  DEFAULT_OVERVIEW_PERIOD,
  isOverviewPeriod,
  overviewPeriodRange,
} from "@/lib/overview-period";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import PrepOverviewCards from "@/components/admin/kitchen/PrepOverviewCards";
import PrepToolbar from "./PrepToolbar";
import PrepTaskList from "./PrepTaskList";

export const metadata = { title: "Prep List" };

const TASKS_PER_PAGE = 10;
const BASE_PATH = "/admin/kitchen/prep";

/**
 * src/app/admin/kitchen/prep/page.tsx
 *
 * "Prep List" in the kitchen sidebar and "View All" on the Dashboard's
 * Today's Prep Snapshot. Figma order: header (Welcome · date · Export
 * Report) · search + status + Add Task · Overview · Today's Prep Snapshot.
 *
 * The list = tasks added here today + rows computed from the live orders
 * (getPrepList). Search and the status filter apply to that list; the
 * Overview counts follow its period pill:
 *   • All          → exactly today's list (the same rows as below, before
 *                    search / status narrow them),
 *   • This / Previous Month → saved tasks added in that month (computed
 *                    rows are not stored, so they cannot be counted back).
 *
 * layout.tsx one level up already calls requireStaff("kitchen"); it is
 * called again here for the session (the layout's result isn't passed down).
 */
export default async function KitchenPrepListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; period?: string }>;
}) {
  const session = await requireStaff("kitchen");

  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = isPrepStatusFilter(params.status) ? params.status : DEFAULT_PREP_STATUS;
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;
  const requestedPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();
  const allRows = await getPrepList(now);

  const range = overviewPeriodRange(period);
  let overview = summarizePrep(allRows);
  if (range) {
    const where = { createdAt: { gte: range.gte, lt: range.lt } };
    const [total, completed] = await prisma.$transaction([
      prisma.prepTask.count({ where }),
      prisma.prepTask.count({ where: { ...where, done: true } }),
    ]);
    overview = summarizePrepCounts(total, completed);
  }

  const rows = filterPrepRows(allRows, { q, status });
  const totalPages = Math.max(1, Math.ceil(rows.length / TASKS_PER_PAGE));
  // A stale ?page=7 after tasks were removed shows the last page, not a blank.
  const page = Math.min(requestedPage, totalPages);
  const shown = rows.slice((page - 1) * TASKS_PER_PAGE, page * TASKS_PER_PAGE);
  const firstOnPage = rows.length === 0 ? 0 : (page - 1) * TASKS_PER_PAGE + 1;
  const lastOnPage = Math.min(page * TASKS_PER_PAGE, rows.length);

  const filtered = Boolean(q) || status !== DEFAULT_PREP_STATUS;

  return (
    <div className="flex flex-col gap-6">
      {/* Frame 2147236232 — "Welcome Back, <name>!" + date pill + Export Report. */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
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
            {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>

          {/* No `page` forwarded: the export is the whole filtered list. */}
          <ExportReportButton
            endpoint="/api/admin/kitchen/prep-tasks/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-prep-list.csv"
          />
        </div>
      </div>

      <PrepToolbar status={status} />

      <PrepOverviewCards period={period} {...overview} />

      <PrepTaskList
        title="Today’s Prep Snapshot"
        rows={shown}
        emptyText={
          filtered
            ? "No prep tasks match your search."
            : "Nothing to prepare yet — add a task, or new orders will show up here."
        }
      />

      {rows.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <span className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-black/70">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing{" "}
            <strong className="font-semibold text-black">
              {firstOnPage}–{lastOnPage}
            </strong>{" "}
            of <strong className="font-semibold text-black">{rows.length}</strong> Tasks
          </span>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath={BASE_PATH}
          />
        </div>
      )}
    </div>
  );
}
