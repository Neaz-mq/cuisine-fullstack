/**
 * src/lib/dashboard-period.ts
 *
 * Dashboard-এর "Today / This Week / This Month / All time" ছাঁকনি।
 *
 * আলাদা ফাইলে, কারণ এটা দুই জায়গায় লাগে: /admin page (যে তালিকাটা
 * দেখায়) আর /api/admin/insights/export (যেটা সেই একই তালিকা CSV করে
 * দেয়)। দুই জায়গায় দুরকম হিসাব থাকলে export-এ পর্দার চেয়ে বেশি বা কম
 * order চলে আসত, আর কেউ সেটা ধরতে পারত না — সংখ্যা দুটো তো আলাদা
 * পর্দায়।
 *
 * ⚠️ Prisma-মুক্ত রাখা হয়েছে ইচ্ছে করেই — client component
 * (DashboardFilters) এখান থেকে PERIOD_OPTIONS আর label পড়ে, আর Prisma
 * import করলে সেটা browser bundle-এ `node:module` টেনে আনত।
 * lib/currency-format.ts-এ একই সতর্কতা, আর এই প্রজেক্টে সেটা একবার
 * `next build` থামিয়েছিল।
 */

export const DASHBOARD_PERIODS = ["today", "week", "month", "all"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All time",
};

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return !!value && (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

/**
 * এই period-এর শুরু, নাকি null যদি "all" হয় (তখন কোনো তারিখ-শর্তই
 * বসে না)।
 *
 * ⚠️ সীমানাগুলো server-এর নিজের timezone ধরে হিসাব হয়, browser-এর নয়।
 * রেস্তোরাঁর "আজ" মানে রেস্তোরাঁর ঘড়ির আজ — কোনো গ্রাহক বা কর্মী
 * অন্য অঞ্চল থেকে দেখলেও হিসাবটা এক থাকা দরকার, নাহলে একই "Today"
 * দুজনের কাছে দুই রকম সংখ্যা দেখাত। Vercel-এ deploy করলে server UTC-তে
 * চলে, তাই রেস্তোরাঁ বাংলাদেশে হলে TZ env var সেট করা (Asia/Dhaka)
 * নাহলে "আজ" ভোর ৬টায় শুরু হবে।
 */
export function periodStart(period: DashboardPeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "today") return start;

  if (period === "week") {
    // "গত ৭ দিন", ক্যালেন্ডারের সপ্তাহ নয় — সপ্তাহ কোন দিনে শুরু সেটা
    // দেশভেদে আলাদা (শনি/রবি/সোম), আর মালিকের আসল প্রশ্নটা প্রায়
    // সবসময়ই "এই ক'দিনে কেমন গেল"।
    start.setDate(start.getDate() - 6);
    return start;
  }

  // month
  start.setDate(start.getDate() - 29);
  return start;
}