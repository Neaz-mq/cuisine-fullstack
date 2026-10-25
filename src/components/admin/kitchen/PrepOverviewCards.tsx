import { ClipboardCheck, ClipboardList, RotateCw } from "lucide-react";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import type { OverviewPeriod } from "@/lib/overview-period";

/**
 * src/components/admin/kitchen/PrepOverviewCards.tsx
 *
 * Figma Overview on the Prep List: white card (padding 30, gap 24, radius
 * 20) · "Overview" + period pill · three cream cards (padding 16, radius
 * 16): Total Tasks · Completed (% done) · Remaining.
 *
 * Pure display — the numbers are worked out by the page (summarizePrep).
 */
const HINTS: Record<OverviewPeriod, { total: string; remaining: string }> = {
  all: { total: "For today’s shift", remaining: "Still to prepare" },
  "this-month": { total: "Added this month", remaining: "Not ticked off yet" },
  "prev-month": { total: "Added last month", remaining: "Never ticked off" },
};

export default function PrepOverviewCards({
  period,
  total,
  completed,
  remaining,
  percentDone,
}: {
  period: OverviewPeriod;
  total: number;
  completed: number;
  remaining: number;
  percentDone: number;
}) {
  const hints = HINTS[period];
  const cards = [
    { label: "Total Tasks", value: total, hint: hints.total, Icon: ClipboardList },
    { label: "Completed", value: completed, hint: `${percentDone}% done`, Icon: ClipboardCheck },
    { label: "Remaining", value: remaining, hint: hints.remaining, Icon: RotateCw },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>
        <OverviewPeriodFilter value={period} />
      </div>

      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, hint, Icon }) => (
          <div key={label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {label}
              </h3>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <Icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {value}
              </p>
              <p className="font-sora text-[12px] font-normal leading-none text-black/70">{hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
