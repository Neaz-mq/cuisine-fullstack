/**
 * Plain, serialisable shapes the /admin/coupons page hands to its client
 * pieces (the modal and row buttons).
 */
export type CouponFormValues = {
  id: string | null;
  code: string;
  label: string;
  headline: string;
  description: string;
  isActive: boolean;
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: string;
  minOrderValue: string;
  usageLimit: string;
  maxDiscountAmount: string;
  perCustomerLimit: string;
  /** "2026-08-01", restaurant time zone. */
  startDate: string;
  /** Last day it works, or "". */
  endDate: string;
  audience: "ALL" | "NEW_CUSTOMERS" | "MEMBERS";
  restrictedCategoryIds: string[];
  /** Item restriction set earlier (the modal shows it, can clear it). */
  restrictedItems: { id: string; title: string }[];
  /** Times used — a used code can't be renamed. */
  usageCount: number;
};

export type CategoryOption = { id: string; name: string };
