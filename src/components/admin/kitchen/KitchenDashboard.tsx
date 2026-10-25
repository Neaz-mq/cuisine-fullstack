import Link from "next/link";
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  Box,
  Calendar,
  Clock,
  Gavel,
  ReceiptText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import PrepSnapshot from "@/components/admin/kitchen/PrepSnapshot";
import { formatOrderId } from "@/lib/format-order-id";
import { PREP_TARGET_MINUTES, joinNames, plural } from "@/lib/kitchen-dashboard";
import type { KitchenDashboardData } from "@/lib/kitchen-dashboard-data";

/**
 * src/components/admin/kitchen/KitchenDashboard.tsx
 *
 * The KITCHEN role's Dashboard — Figma "Welcome Back" screen (frame
 * 2147236227): header → four stat cards → alert banner → four summary
 * cards → Today's Prep Snapshot.
 *
 * A server component: it only draws what getKitchenDashboardData() hands
 * it. No numbers are made up here — where the data doesn't exist (e.g.
 * "chefs on break") the Figma line is simply left out.
 */

const MAX_PREP_ROWS = 4;

const SUB_TEXT = "font-sora text-[12px] font-normal leading-none text-black/70";

export default function KitchenDashboard({
  name,
  now,
  data,
}: {
  name: string;
  now: Date;
  data: KitchenDashboardData;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Frame 2147236232 — Welcome + date pill + Export Report */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {name}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-[50px] min-[480px]:px-4 min-[480px]:text-[16px]">
            <Calendar
              className="h-4 w-4 shrink-0 min-[480px]:h-5 min-[480px]:w-5"
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
            forwardParams={[]}
            fallbackFilename="cuisine-kitchen.csv"
          />
        </div>
      </div>

      {/* Frame 2147236230 — four stat cards */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Orders"
          icon={Gavel}
          value={String(data.totalOrdersWeek)}
          pill={<ChangePill change={data.totalOrdersChange} />}
          hint="VS last Week"
        />
        <StatCard
          label="Avg. Prep Time"
          icon={Clock}
          value={data.avgPrepMinutes === null ? "—" : `${data.avgPrepMinutes} min`}
          hint={`Target: ${PREP_TARGET_MINUTES} min`}
        />
        <StatCard
          label="Waiting"
          icon={AlarmClock}
          value={String(data.waiting)}
          hint="Needs attention"
        />
        <StatCard
          label="Emergency Stock"
          icon={Box}
          value={String(data.inventory.urgent)}
          hint="Need urgent restocking"
        />
      </div>

      <AlertBanner data={data} />

      {/* Frame 2147236277 — four summary cards */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Live Orders"
          href="/admin/kitchen"
          text={
            data.liveOrders === 0
              ? "No live orders right now"
              : `${data.liveOrders} ${plural(data.liveOrders, "order", "orders")} across Placed, Preparing, and Ready`
          }
        />
        <SummaryCard
          label="Prep List"
          href="/admin/kitchen/prep"
          text={
            data.prep.length === 0
              ? "No prep tasks right now"
              : `${data.prepRemaining} of ${data.prep.length} daily preparation ${plural(data.prep.length, "task", "tasks")} still remaining`
          }
        />
        <SummaryCard
          label="Inventory"
          href="/admin/kitchen/inventory"
          text={
            data.inventory.attention === 0
              ? "Every ingredient is well stocked"
              : `${data.inventory.attention} ${plural(data.inventory.attention, "item needs", "items need")} attention, ${data.inventory.urgent} ${plural(data.inventory.urgent, "is", "are")} urgent`
          }
        />
        <SummaryCard
          label="Staff on Duty"
          text={
            data.chefsTotal === 0
              ? "No kitchen staff added yet"
              : `${data.chefsOnShift} ${plural(data.chefsOnShift, "Chef", "Chefs")} on shift${
                  data.chefsTotal > data.chefsOnShift
                    ? `, ${data.chefsTotal - data.chefsOnShift} off shift`
                    : ""
                }`
          }
        />
      </div>

      {/* Frame 2147236256 — Today's Prep Snapshot */}
      <PrepSnapshot
        title="Today’s Prep Snapshot"
        rows={data.prep}
        limit={MAX_PREP_ROWS}
        viewAllHref="/admin/kitchen/prep"
      />
    </div>
  );
}

/** Figma "Card": white, padding 16, radius 16, title + 40px icon circle, big number (+pill), hint. */
function StatCard({
  label,
  icon: Icon,
  value,
  pill,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  pill?: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="flex min-h-[142px] flex-col gap-5 rounded-[16px] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
          {label}
        </h3>
        <IconCircle icon={Icon} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
            {value}
          </p>
          {pill}
        </div>
        <p className={SUB_TEXT}>{hint}</p>
      </div>
    </div>
  );
}

function IconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
      <Icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
    </span>
  );
}

/** "+4% week" — green up / red down; renders nothing without a last-week base. */
function ChangePill({ change }: { change: number | null }) {
  if (change === null) return null;
  const down = change < 0;
  const Arrow = down ? ArrowDown : ArrowUp;
  return (
    <span
      className={`flex h-[26px] w-fit items-center gap-1 rounded-full px-1.5 font-sora text-[14px] font-normal leading-none ${
        down ? "bg-[#FAE7EC] text-[#D72A37]" : "bg-[#F1FEF3] text-[#0ECF00]"
      }`}
    >
      <Arrow className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden="true" />
      {change > 0 ? "+" : ""}
      {change}% week
    </span>
  );
}

/**
 * Frame 2147236305 — the orange→pink alert strip.
 *
 * Urgent ingredients → "N ingredients need urgent restocking" with a
 * "View Emergency Items" button (Figma). Nothing urgent → the newest
 * waiting order instead, with a button to the Live Orders board. Neither
 * → no banner at all rather than an empty coloured bar.
 */
function AlertBanner({ data }: { data: KitchenDashboardData }) {
  const urgent = data.inventory.urgentItems;

  let title: string;
  let text: string;
  let cta: { href: string; label: string };
  if (urgent.length > 0) {
    const names = joinNames(urgent.map((item) => item.name));
    title = `${urgent.length} ${plural(urgent.length, "ingredient needs", "ingredients need")} urgent restocking`;
    text =
      `${names} ${plural(urgent.length, "is", "are")} almost out` +
      (data.ordersNeedingUrgentStock > 0
        ? ` — ${data.ordersNeedingUrgentStock} pending ${plural(data.ordersNeedingUrgentStock, "order needs it", "orders need them")}.`
        : ".");
    cta = { href: "/admin/kitchen/inventory/emergency", label: "View Emergency Items" };
  } else if (data.newestOrder) {
    title = "New order placed";
    text = `${data.newestOrder.customer || "A customer"} placed order ${formatOrderId(data.newestOrder.id)}.`;
    cta = { href: "/admin/kitchen", label: "View Live Orders" };
  } else {
    return null;
  }

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-[20px] bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] p-5 md:flex-row md:items-center md:p-[30px]">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-white">
          <AlarmClock className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-frank-ruhl text-[20px] font-medium leading-[1.2] text-white">
            {title}
          </p>
          <p className="font-sora text-[14px] leading-[1.7] text-white/70">{text}</p>
        </div>
      </div>

      <Link
        href={cta.href}
        className="flex h-[50px] shrink-0 items-center justify-center rounded-full bg-white px-4 font-sora text-[16px] font-normal leading-none text-black transition-opacity hover:opacity-90"
      >
        {cta.label}
      </Link>
    </div>
  );
}

/** Figma "Card" (128px): title + icon circle, grey text. A link only when it goes somewhere. */
function SummaryCard({ label, text, href }: { label: string; text: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
          {label}
        </h3>
        <IconCircle icon={ReceiptText} />
      </div>
      <p className="font-sora text-[12px] font-normal leading-[1.5] text-black/70">{text}</p>
    </>
  );
  const base = "flex min-h-[128px] flex-col gap-5 rounded-[16px] bg-white p-4";
  return href ? (
    <Link href={href} className={`${base} transition-opacity hover:opacity-90`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
