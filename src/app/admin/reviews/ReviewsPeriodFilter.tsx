"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";
import {
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

/**
 * The "Today ⌄" pill on the Overview and Reviews cards. Each card has its
 * own URL key (`overview` / `period`), same as the Insights page. "Today"
 * is the default, so it is left out of the URL.
 *
 * The list card's filter also drops ?page= — a new period means a new
 * list, and page 4 of the old one may not exist any more.
 */
const OPTIONS: readonly FilterMenuOption<DashboardPeriod>[] = DASHBOARD_PERIODS.map(
  (value) => ({ value, label: PERIOD_LABELS[value] })
);

export default function ReviewsPeriodFilter({
  param,
  value,
  resetPage = false,
}: {
  param: string;
  value: DashboardPeriod;
  resetPage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") params.delete(param);
    else params.set(param, next);
    if (resetPage) params.delete("page");
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
