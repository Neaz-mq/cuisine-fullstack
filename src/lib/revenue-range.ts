/**
 * src/lib/revenue-range.ts
 *
 * Revenue chart-এর "This Week / This Month / This Year" ছাঁকনি, আর
 * প্রতিটার জন্য খোপগুলো কীভাবে কাটা হবে।
 *
 * ⚠️ lib/dashboard-period.ts থেকে আলাদা, ইচ্ছাকৃতভাবে। ওটা Recent
 * Orders তালিকার ছাঁকনি — ওখানে "Today" আর "All time" দুটোই অর্থবহ,
 * কারণ তালিকা যত খুশি লম্বা হতে পারে। Chart-এ দুটোর কোনোটাই নয়:
 * একদিনের chart মানে একটাই কলাম, আর "সব সময়" মানে অসীম অক্ষ — কলাম
 * সংখ্যা নির্দিষ্ট এমন নকশায় সেটা আঁকাই যায় না। Stripe, Shopify,
 * Square — সবাই এখানে Week/Month/Year-ই দেয়।
 *
 * দুটোকে এক করে দিলে এক পাশ ঠিক করতে গিয়ে অন্য পাশ নীরবে ভাঙত।
 *
 * ⚠️ Prisma-মুক্ত, dashboard-period.ts-এর মতোই — client component
 * এখান থেকে label পড়ে, আর Prisma import করলে সেটা browser bundle-এ
 * `node:module` টেনে আনত। এই প্রজেক্টে ওটা একবার `next build`
 * থামিয়েছিল।
 */

export const REVENUE_RANGES = ["week", "month", "year"] as const;

export type RevenueRange = (typeof REVENUE_RANGES)[number];

export const REVENUE_RANGE_LABELS: Record<RevenueRange, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

export function isRevenueRange(value: string | null | undefined): value is RevenueRange {
  return !!value && (REVENUE_RANGES as readonly string[]).includes(value);
}

export interface RevenueBucket {
  /** খোপের শুরু (অন্তর্ভুক্ত)। */
  start: Date;
  /** খোপের শেষ (বহির্ভূত) — অর্থাৎ পরের খোপের শুরু। */
  end: Date;
  /** অক্ষের নিচে ছোট লেখা: "Sat", "15", "Aug"। */
  label: string;
  /** Tooltip-এর মাথায় পুরো কথাটা: "Aug 28, 2026", "Aug 1 – Aug 5"। */
  fullLabel: string;
}

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const dayMonth = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * প্রতিটা range-এর জন্য ঠিক কতগুলো খোপ, আর কত চওড়া।
 *
 * সংখ্যাটা ৭-১২-এর মধ্যে রাখা হয়েছে সব ক্ষেত্রেই। Figma-র pill ৫২px
 * চওড়া; ৩০টা দিন আলাদা কলামে আঁকলে প্রতিটা ১৫px-এ নেমে আসত আর pill
 * বলে কিছু থাকত না — তাই মাসটা ৫ দিনের ৬টা খোপে ভাঙা।
 *
 *   week  → ৭টা দিন
 *   month → ৫ দিনের ৬টা খোপ (মোট ৩০ দিন)
 *   year  → ১২টা পঞ্জিকা-মাস
 *
 * সব ক্ষেত্রেই শেষ খোপটা "এখন" — অর্থাৎ চলতি দিন/খোপ/মাস।
 */
export function buildRevenueBuckets(range: RevenueRange, now: Date = new Date()): RevenueBucket[] {
  const today = startOfDay(now);

  if (range === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const start = addDays(today, i - 6);
      return {
        start,
        end: addDays(start, 1),
        label: start.toLocaleDateString("en-US", { weekday: "short" }),
        fullLabel: start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    });
  }

  if (range === "month") {
    // শেষ খোপটা আজকে দিয়েই শেষ হয়, তাই পেছন থেকে গোনা।
    return Array.from({ length: 6 }, (_, i) => {
      const start = addDays(today, (i - 5) * 5 - 4);
      const end = addDays(start, 5);
      // label-এ কেবল তারিখের সংখ্যা — ৫২px-এ "Aug 5" আঁটে না, আর
      // পুরো কথাটা tooltip-এ তো আছেই।
      return {
        start,
        end,
        label: String(addDays(end, -1).getDate()),
        fullLabel: `${dayMonth(start)} – ${dayMonth(addDays(end, -1))}`,
      };
    });
  }

  // year — পঞ্জিকা-মাস, কারণ মালিক মাস ধরেই ভাবেন ("জুলাইটা খারাপ
  // গেছে"), ৩০ দিনের টুকরো ধরে নয়।
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monthStart.getFullYear(), monthStart.getMonth() + i - 11, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      start,
      end,
      label: start.toLocaleDateString("en-US", { month: "short" }),
      fullLabel: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });
}

/**
 * একটা তারিখ কোন খোপে পড়ে, নাকি কোনোটাতেই নয় (-1)।
 *
 * সরল রৈখিক খোঁজ — খোপ কখনোই ১২টার বেশি নয়, আর binary search লিখলে
 * সেটা পড়তে বেশি সময় লাগত যতটা এটা চালাতে লাগে।
 */
export function bucketIndexOf(buckets: RevenueBucket[], date: Date): number {
  const time = new Date(date).getTime();
  return buckets.findIndex((b) => time >= b.start.getTime() && time < b.end.getTime());
}