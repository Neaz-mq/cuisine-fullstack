"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";

/**
 * Delivery History → "All Statuses ⌄" (Figma). Writes `?status=` to the
 * URL so the server filters the list and Export Report downloads the same
 * rows. "ALL" is the default and stays out of the URL.
 */
export type HistoryStatus = "ALL" | "DELIVERED" | "CANCELLED";

const OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
] as const satisfies readonly { value: HistoryStatus; label: string }[];

export default function StatusFilter({ value }: { value: HistoryStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: HistoryStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("status");
    else params.set("status", next);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return <FilterMenu surface="white" value={value} options={OPTIONS} onSelect={select} ariaLabel="Filter by status" />;
}
