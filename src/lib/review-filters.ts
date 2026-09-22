import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/review-filters.ts
 *
 * The "All Statuses" menu on /admin/reviews. Lowercase in the URL
 * (?status=pending) like the Menu page's status filter; mapped to the
 * ReviewStatus enum only when querying.
 */
export type ReviewStatusFilter = "all" | "pending" | "approved" | "rejected";

export const DEFAULT_REVIEW_STATUS: ReviewStatusFilter = "all";

export function isReviewStatus(value: unknown): value is ReviewStatusFilter {
  return (
    typeof value === "string" && ["all", "pending", "approved", "rejected"].includes(value)
  );
}

export const REVIEW_STATUS_OPTIONS: FilterMenuOption<ReviewStatusFilter>[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function reviewStatusToDb(
  status: ReviewStatusFilter
): "PENDING" | "APPROVED" | "REJECTED" | undefined {
  if (status === "all") return undefined;
  return status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED";
}
