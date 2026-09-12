import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/payment-filters.ts
 *
 * /admin/payment পাতার দুটো ছাঁকনি: চালানের অবস্থা আর সারাংশের সময়সীমা।
 *
 * ⚠️ Orders পাতার `order-status-filter.ts`-এর সাথে গুলিয়ে ফেলবেন না —
 * ওটা অর্ডারের অগ্রগতি (PLACED → DELIVERED), এটা টাকার অবস্থা
 * (PENDING → PAID → REFUNDED)। একটা অর্ডার DELIVERED হয়েও REFUNDED
 * হতে পারে, তাই দুটোকে এক করা যেত না।
 */

export const PAYMENT_STATUSES = [
  "ALL",
  "PAID",
  "PENDING",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type PaymentStatusFilter = (typeof PAYMENT_STATUSES)[number];

export const DEFAULT_PAYMENT_STATUS: PaymentStatusFilter = "ALL";

export function isPaymentStatus(value: unknown): value is PaymentStatusFilter {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export const PAYMENT_STATUS_OPTIONS: FilterMenuOption<PaymentStatusFilter>[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  // pill-এ ছোট নাম — পুরোটা বসালে pill-টা পাশের শিরোনামের ঘাড়ে উঠত।
  { value: "PARTIALLY_REFUNDED", label: "Partially Refunded", triggerLabel: "Partial" },
  { value: "REFUNDED", label: "Refunded" },
];

/**
 * Figma-র "Payment Summary" আর "Shipping Summary" কার্ডের ডান পাশের
 * "Today" pill।
 *
 * ⚠️ উপরের Overview-র সংখ্যাগুলো এই ছাঁকনি মানে না, ইচ্ছাকৃতভাবে।
 * Overview হলো "এই মাসে ব্যবসা কেমন", আর summary দুটো হলো "আজ কোন
 * মাধ্যমে কত এল" — দুটো আলাদা প্রশ্ন, তাই আলাদা URL parameter।
 */
export const SUMMARY_RANGES = ["today", "week", "month", "all"] as const;

export type SummaryRange = (typeof SUMMARY_RANGES)[number];

export const DEFAULT_SUMMARY_RANGE: SummaryRange = "today";

export function isSummaryRange(value: unknown): value is SummaryRange {
  return typeof value === "string" && (SUMMARY_RANGES as readonly string[]).includes(value);
}

export const SUMMARY_RANGE_OPTIONS: FilterMenuOption<SummaryRange>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

/**
 * সময়সীমাটাকে Prisma-র শর্তে বদলায়। `all` → null, অর্থাৎ কোনো শর্তই নয়।
 *
 * ⚠️ দিনের শুরু স্থানীয় সময়ে (`setHours(0,0,0,0)`), UTC-তে নয়। server
 * UTC-তে চললে "আজ" মানে হতো UTC-র আজ, আর বাংলাদেশে বিকেল ৬টার আগ
 * পর্যন্ত "আজকের" বিক্রি গতকালের ঘরে পড়ত।
 */
export function summaryRangeStart(range: SummaryRange): Date | null {
  if (range === "all") return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (range === "today") return start;

  if (range === "week") {
    // সপ্তাহ শুরু সোমবার থেকে। getDay()-এ রবিবার = 0, তাই তার জন্য ৬ দিন
    // পিছিয়ে যেতে হয়, নাহলে রবিবারে "এই সপ্তাহ" মানে দাঁড়াত একটা দিন।
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
    return start;
  }

  start.setDate(1);
  return start;
}
