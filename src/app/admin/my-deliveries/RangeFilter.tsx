"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import { PERIOD_LABELS, type DashboardPeriod } from "@/lib/dashboard-period";

/**
 * "Today ⌄" pill of the rider pages (Figma "Recent Deliveries"). Writes the
 * choice to the URL (`?range=week`), so the page re-renders on the server
 * with the new period and Export Report downloads the same period.
 *
 * The page's default period is left out of the URL — a clean link.
 */
const OPTIONS = (["today", "week", "month", "all"] as const).map((value) => ({
  value,
  label: value === "all" ? "All Time" : PERIOD_LABELS[value],
}));

export default function RangeFilter({
  value,
  defaultValue,
  surface = "cream",
  param = "range",
}: {
  value: DashboardPeriod;
  defaultValue: DashboardPeriod;
  surface?: "cream" | "white";
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultValue) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      className="shrink-0"
      surface={surface}
      value={value}
      options={OPTIONS}
      onSelect={select}
      ariaLabel="Period"
    />
  );
}
