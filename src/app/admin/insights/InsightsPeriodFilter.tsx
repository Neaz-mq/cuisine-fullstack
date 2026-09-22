"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";
import {
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

/**
 * The "Today ⌄" pill in the top-right of every Insights card.
 *
 * Each card owns one URL key (`overview`, `top`, `slow`, `never`, `cat`),
 * so changing Top Selling to "This Week" leaves the other cards alone —
 * same idea as the dashboard's RangeSelect (`?revenue=` / `?top=`).
 * "Today" is the default, so it is simply left out of the URL.
 */
const OPTIONS: readonly FilterMenuOption<DashboardPeriod>[] = DASHBOARD_PERIODS.map(
  (value) => ({ value, label: PERIOD_LABELS[value] })
);

export default function InsightsPeriodFilter({
  param,
  value,
}: {
  param: string;
  value: DashboardPeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") params.delete(param);
    else params.set(param, next);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      className="shrink-0"
      value={value}
      options={OPTIONS}
      onSelect={select}
      ariaLabel="Period"
    />
  );
}
