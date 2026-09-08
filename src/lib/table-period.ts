import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/table-period.ts
 *
 * /admin/tables-এর Overview কার্ডের উপরের ছাঁকনি:
 * Today · This Week · Upcoming।
 *
 * ── কেন `overview-period.ts` পুনর্ব্যবহার করা হলো না ─────────────────
 *
 * ওটার ধাপগুলো All · This Month · Previous Month — অর্থাৎ **অতীতমুখী**,
 * "গত মাসে কতজন যোগ দিয়েছিলেন" ধরনের প্রশ্নের জন্য। Users, Staff,
 * Menu, Orders, Suppliers — পাঁচটা পাতাতেই সেটাই দরকার।
 *
 * টেবিল উল্টো দিকের জিনিস। schema.prisma-য় RestaurantTable-এর মাথায়
 * লেখা আছে: "a table is NOT a static booked/free flag… availability is
 * computed relative to a specific date/time window"। অর্থাৎ একটা টেবিল
 * "বুকড" কিনা তার উত্তর সবসময় **ভবিষ্যতের** একটা জানালার সাপেক্ষে।
 * "গত মাসে এই টেবিলটা খালি ছিল কিনা" প্রশ্নটার কোনো ব্যবহার নেই।
 *
 * তাই আলাদা তালিকা, কিন্তু হুবহু একই আকৃতি — একই FilterMenuOption,
 * একই `isX()` guard, একই "ডিফল্ট URL-এ লেখা হয় না" নিয়ম। কেউ
 * overview-period.ts পড়ে এলে এখানে নতুন কিছু শিখতে হবে না।
 *
 * ── এই ছাঁকনিটা আসলে কী ছাঁকে ───────────────────────────────────────
 *
 * ⚠️ এটা তালিকার ছাঁকনি নয়। নিচের টেবিল-কার্ডগুলো এতে বদলায় না —
 * কেবল উপরের চারটে সংখ্যা বদলায়। প্রতিটা কার্ডের নিচের ছোট লেখাটা
 * period-এর সাথে বদলায় ("Booked today" → "Booked this week"), কারণ
 * সংখ্যাটা কীসের সেটা সংখ্যার পাশেই লেখা থাকা দরকার; শুধু উপরের pill
 * দেখে অনুমান করতে হলে ভুল হবেই।
 *
 * ⚠️ "Total Tables" কোনো period-এই বদলায় না। রেস্তোরাঁয় ২৪টা টেবিল
 * আজও ২৪টা, আগামী সপ্তাহেও — ওটা সঞ্চিত সংখ্যা, জানালার হিসাব নয়।
 * বাকি তিনটে বদলায়।
 */

export const TABLE_PERIODS = ["today", "week", "upcoming"] as const;

export type TablePeriod = (typeof TABLE_PERIODS)[number];

/** Figma-র pill-এ "Today" লেখা, তাই সেটাই ডিফল্ট। */
export const DEFAULT_TABLE_PERIOD: TablePeriod = "today";

export function isTablePeriod(value: unknown): value is TablePeriod {
  return typeof value === "string" && (TABLE_PERIODS as readonly string[]).includes(value);
}

export const TABLE_PERIOD_OPTIONS: FilterMenuOption<TablePeriod>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "upcoming", label: "All Upcoming", triggerLabel: "Upcoming" },
];

/**
 * period → তারিখের সীমা, `[gte, lt)`।
 *
 * ⚠️ তিনটেই **এখন** থেকে শুরু, দিনের শুরু থেকে নয়। "Booked today"
 * মানে "আজ আর কোনো বুকিং আছে কিনা" — সকাল ১০টার বুকিংটা রাত ৮টায়
 * দাঁড়িয়ে আর প্রাসঙ্গিক নয়, ওটা হয়ে গেছে। অতীতের বুকিং গুনলে রাতের
 * দিকে প্রতিটা টেবিলই "booked" দেখাত, অথচ সবগুলো খালি।
 *
 * ⚠️ `upcoming`-এর কোনো শেষ প্রান্ত নেই, তাই `lt` হিসেবে বসানো হয়
 * একটা দূর ভবিষ্যৎ — `null` ফেরত দিলে প্রতিটা caller-কে আলাদা করে
 * সেই ক্ষেত্রটা সামলাতে হতো, আর একজন ভুলে গেলেই তার সংখ্যাটা নীরবে
 * ভুল হতো।
 *
 * ⚠️ দিনের সীমানা **server-এর স্থানীয় সময়ে**, রেস্তোরাঁর timezone-এ
 * নয় — আর এই app-এ server UTC। অর্থাৎ ঢাকার সন্ধ্যা ৬টার পরের বুকিং
 * UTC-র হিসাবে পরের দিনে পড়ে।
 *
 * সেটা জেনেশুনেই: lib/overview-period.ts-এ ঠিক একই আপস, একই ব্যাখ্যা
 * সহ, আর Order.createdAt থেকে dashboard-এর প্রতিটা হিসাব সেই একই UTC
 * ভিত্তিতে চলে। এখানে একা ঢাকার সময় ধরলে এই চারটে কার্ডই বাকি পাতার
 * সাথে অমিল দেখাত — যেটা ছ'ঘণ্টার সরণের চেয়ে খারাপ। ঠিক করতে হলে
 * পুরো app-এ একসাথে করতে হবে।
 */
export function tablePeriodRange(period: TablePeriod): { gte: Date; lt: Date } {
  const now = new Date();

  if (period === "upcoming") {
    const farFuture = new Date(now);
    farFuture.setFullYear(farFuture.getFullYear() + 50);
    return { gte: now, lt: farFuture };
  }

  if (period === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { gte: now, lt: end };
  }

  // today — আজ রাত ১২টা পর্যন্ত।
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  return { gte: now, lt: endOfDay };
}

/**
 * কার্ডের নিচের ছোট লেখাগুলো — period-ভেদে বদলায়।
 *
 * ⚠️ এক জায়গায় রাখা হয়েছে যাতে চারটে কার্ডের লেখা একে অপরের সাথে
 * মিলিয়ে পড়া যায়। page.tsx-এ ছড়িয়ে রাখলে একটা period-এ "today"
 * আর অন্যটায় "this week" লিখে ফেলা সহজ হতো।
 */
export function tablePeriodCaptions(period: TablePeriod): {
  available: string;
  booked: string;
  reserved: string;
} {
  if (period === "week") {
    return {
      available: "Free all week",
      booked: "Booked this week",
      reserved: "Reservations this week",
    };
  }
  if (period === "upcoming") {
    return {
      available: "No bookings ahead",
      booked: "Booked at some point",
      reserved: "All upcoming reservations",
    };
  }
  return {
    available: "Free for the rest of today",
    booked: "Booked later today",
    reserved: "Reservations left today",
  };
}
