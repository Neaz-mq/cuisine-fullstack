import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/overview-period.ts
 *
 * /admin/users আর /admin/staff — দুই পাতার Overview কার্ডের উপরের
 * ছাঁকনি: All · This Month · Previous Month।
 *
 * ── এই ছাঁকনিটা আসলে কী ছাঁকে ───────────────────────────────────────
 *
 * ⚠️ এটা তালিকার ছাঁকনি নয়। নিচের Users/Staff তালিকাটা এতে বদলায়
 * না — কেবল উপরের কার্ডের সংখ্যাগুলো বদলায়। দুটো আলাদা জিনিস একই
 * পাতায় থাকায় এটা গুলিয়ে যাওয়া সহজ, তাই কার্ডের নিচের ছোট লেখাটা
 * (hint) প্রতিটা period-এ বদলে যায় — "Ordered in last 90 days" থেকে
 * "Ordered this month"। সংখ্যাটা কীসের, সেটা সংখ্যার পাশেই লেখা
 * থাকা দরকার; শুধু উপরের pill দেখে অনুমান করতে হলে ভুল হবেই।
 *
 * ── "All" মানে প্রতিটা কার্ডে আলাদা, আর সেটাই ঠিক ───────────────────
 *
 * চারটে সংখ্যার সবগুলোর একই সময়সীমা হয় না। "Total Users" সবসময়ই
 * সঞ্চিত (যতজন এ পর্যন্ত যোগ দিয়েছেন), অথচ "Active Users" স্বভাবতই
 * একটা জানালার হিসাব। তাই All-এ প্রতিটা কার্ড তার নিজের স্বাভাবিক
 * সংজ্ঞা ব্যবহার করে (৯০ দিন / ৩০ দিন), আর period বাছলে সবগুলো ওই
 * মাসে গিয়ে বসে। এটাই একমাত্র পাঠ যেখানে চারটে সংখ্যাই অর্থবহ থাকে।
 */

export const OVERVIEW_PERIODS = ["all", "this-month", "prev-month"] as const;

export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export const DEFAULT_OVERVIEW_PERIOD: OverviewPeriod = "all";

export function isOverviewPeriod(value: unknown): value is OverviewPeriod {
  return typeof value === "string" && (OVERVIEW_PERIODS as readonly string[]).includes(value);
}

export const OVERVIEW_PERIOD_OPTIONS: FilterMenuOption<OverviewPeriod>[] = [
  { value: "all", label: "All" },
  { value: "this-month", label: "This Month" },
  // pill-এ ছোট নাম — "Previous Month" পুরোটা বসালে pill-টা পাশের
  // শিরোনামের দিকে অনেকটা এগিয়ে আসত। FilterMenu-র `triggerLabel`
  // ঠিক এই কাজের জন্যই (Users page-এ "Platinum Customer" → "Platinum")।
  { value: "prev-month", label: "Previous Month", triggerLabel: "Prev Month" },
];

/**
 * period → তারিখের সীমা। `all`-এ `null`, অর্থাৎ কোনো সীমা নেই।
 *
 * সীমাটা `[gte, lt)` — শেষ প্রান্ত **বাদ**। `lte` দিয়ে মাসের শেষ দিন
 * ধরলে ওই দিনের ০০:০০:০০.০০০-এর পরের সবকিছু বাদ পড়ত, অর্থাৎ ৩১
 * তারিখের প্রায় পুরো দিনটাই হারাত। পরের মাসের ১ তারিখ ০০:০০ থেকে
 * "ছোট" বললে সেই ফাঁকটা থাকে না।
 *
 * ⚠️ মাসের সীমানা **server-এর স্থানীয় সময়ে** — আর এই app-এ server
 * UTC, রেস্তোরাঁ ঢাকায় (UTC+৬)। তাই ১ তারিখ ভোর ৬টার আগে করা
 * অর্ডারগুলো ঢাকার হিসাবে নতুন মাসের, কিন্তু এখানে আগের মাসে পড়ে।
 * মাসিক সংখ্যায় ছ'ঘণ্টার এই সরণ ধর্তব্য নয়, আর পুরো app-টাই
 * (Order.createdAt, hireDate, dashboard-এর সব হিসাব) একই UTC ভিত্তিতে
 * চলে — এখানে আলাদা করে ঢাকার সময় ধরলে বরং এই কার্ডগুলোই বাকি
 * পাতার সাথে অমিল দেখাত।
 */
export function overviewPeriodRange(period: OverviewPeriod): { gte: Date; lt: Date } | null {
  if (period === "all") return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // `new Date(y, m, 1)` — m = 12 বা −1 দিলেও JS নিজেই বছর সামলায়,
  // তাই ডিসেম্বর/জানুয়ারির জন্য আলাদা শর্ত লাগে না।
  if (period === "this-month") {
    return { gte: new Date(year, month, 1), lt: new Date(year, month + 1, 1) };
  }
  return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
}
