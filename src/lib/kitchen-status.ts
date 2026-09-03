import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/kitchen-status.ts
 *
 * Kitchen বোর্ডের status-ছাঁকনির একমাত্র উৎস।
 *
 * ⚠️ এটা আলাদা ফাইল হওয়ার কারণটা কেবল গোছানো নয়, বাধ্যতা। জিনিসগুলো
 * প্রথমে `KitchenToolbar.tsx`-এ ছিল, আর সেই ফাইলের মাথায়
 * `"use client"` — তাতে `page.tsx` (server component) থেকে
 * `isKitchenStatus()` ডাকতেই Next.js থামিয়ে দেয়:
 *
 *   Attempted to call isKitchenStatus() from the server but
 *   isKitchenStatus is on the client.
 *
 * `"use client"` ফাইল থেকে কেবল **component** সীমা পেরোতে পারে;
 * সাধারণ function বা ধ্রুবক নয় (build-এ ওগুলো client bundle-এ চলে
 * যায়, server-এ শুধু একটা reference পড়ে থাকে)। তাই দুই দিকের
 * দরকারি জিনিস কোনো দিকেই নয় — মাঝখানে, `lib/`-এ।
 *
 * `lib/inventory-status.ts` ঠিক একই কারণে একইভাবে সাজানো।
 *
 * ⚠️ শুধু `type` import থাকলে ফাইলটা "client" হয়ে যায় না —
 * TypeScript ওটা মুছে ফেলে, তাই FilterMenuOption আনায় সমস্যা নেই।
 */
export type KitchenStatusFilter = "all" | "placed" | "preparing" | "ready";

export const DEFAULT_KITCHEN_STATUS: KitchenStatusFilter = "all";

export function isKitchenStatus(value: unknown): value is KitchenStatusFilter {
  return (
    typeof value === "string" && ["all", "placed", "preparing", "ready"].includes(value)
  );
}

export const KITCHEN_STATUS_OPTIONS: FilterMenuOption<KitchenStatusFilter>[] = [
  // Figma-র pill-এ "All Statuses", popup-এ শুধু "All" — বাকি
  // পাতাগুলোর ছাঁকনির সাথে একই আচরণ।
  { value: "all", label: "All", triggerLabel: "All Statuses" },
  { value: "placed", label: "Placed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
];

/**
 * বোর্ডের কলাম কোন OrderStatus-এ পড়ে।
 *
 * ⚠️ "ready" = `OUT_FOR_DELIVERY`, আর সেটা আমাদের মডেলে "রান্না শেষ,
 * তুলে নেওয়ার অপেক্ষায়" — রাইডার রওনা দিয়েছে এমন নয়। নামটা
 * বিভ্রান্তিকর, কিন্তু enum-টা পুরনো আর অনেক জায়গায় ব্যবহৃত।
 */
export const KITCHEN_STATUS_TO_ORDER_STATUS: Record<
  Exclude<KitchenStatusFilter, "all">,
  "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY"
> = {
  placed: "PLACED",
  preparing: "PREPARING",
  ready: "OUT_FOR_DELIVERY",
};

/* ── Overview-র ছাঁকনি: অর্ডারের ধরন ──────────────────────────────── */

/**
 * ⚠️ Figma-তে Overview-র শিরোনামের পাশে "Today ⌄" আঁকা, কিন্তু সেটা
 * বসানো যায় না — নিচের চারটের মধ্যে তিনটে (Ready to Serve · Preparing
 * · Pending) **এই মুহূর্তের অবস্থা**। "গত সপ্তাহে কতগুলো ঝুলছিল"
 * প্রশ্নের উত্তর দিতে হলে প্রতিদিনের status-এর স্থিরচিত্র রাখতে হতো,
 * যা schema-য় নেই। ছাঁকনিটা বসালে তিনটে সংখ্যা অনড় থাকত আর একটা
 * বদলাত — ব্যবহারকারী ধরে নিতেন চারটেই বদলেছে, যা নীরব মিথ্যা।
 *
 * ধরন দিয়ে ছাঁকলে **চারটেই** বদলায়, আর প্রশ্নটাও রান্নাঘরের নিজের:
 * "টেবিলের অর্ডার কটা ঝুলছে, ডেলিভারির কটা"। রান্নাঘরে দুটোর
 * তাড়াও আলাদা — টেবিলের খদ্দের সামনে বসে আছেন, ডেলিভারির রাইডার
 * এখনো আসেননি।
 *
 * (Inventory-র Overview-তেও ঠিক এই কারণেই period-এর বদলে শ্রেণি।)
 */
export type KitchenTypeFilter = "all" | "dine-in" | "delivery";

export const DEFAULT_KITCHEN_TYPE: KitchenTypeFilter = "all";

export function isKitchenType(value: unknown): value is KitchenTypeFilter {
  return typeof value === "string" && ["all", "dine-in", "delivery"].includes(value);
}

export const KITCHEN_TYPE_OPTIONS: FilterMenuOption<KitchenTypeFilter>[] = [
  // pill-এ "All Orders", popup-এ শুধু "All" — বাকি ছাঁকনিগুলোর একই আচরণ।
  { value: "all", label: "All", triggerLabel: "All Orders" },
  { value: "dine-in", label: "Dine in" },
  { value: "delivery", label: "Delivery" },
];

export const KITCHEN_TYPE_TO_ORDER_TYPE: Record<
  Exclude<KitchenTypeFilter, "all">,
  "DINE_IN" | "DELIVERY"
> = {
  "dine-in": "DINE_IN",
  delivery: "DELIVERY",
};

/* ── Kitchen Display-র dropdown: সাজানোর ক্রম ─────────────────────── */

/**
 * ⚠️ এটা ছাঁকনি নয়, **সাজানোর ক্রম** — আর সেটা ইচ্ছাকৃত।
 *
 * Figma-তে "Kitchen Display"-র শিরোনামের পাশেও একটা pill আঁকা
 * ("Today ⌄"), কিন্তু বোর্ডে সময়-ছাঁকনির কোনো মানে নেই: বোর্ডে
 * এমনিতেই কেবল **সচল** অর্ডার থাকে (এখনো ধরা হয়নি, চুলায় আছে, বা
 * সদ্য তৈরি) — "গত সপ্তাহের সচল অর্ডার" বলে কিছু হয় না।
 *
 * বাকি যে দুটো মাত্রায় সত্যিই ছাঁকা যেত, দুটোই ইতিমধ্যে আছে:
 *
 *   status (Placed/Preparing/Ready) → toolbar-এর "All Statuses"
 *   ধরন (Dine in/Delivery)         → Overview-র "All Orders"
 *
 * তৃতীয় একটা ছাঁকনি বসালে হয় ওদেরই পুনরাবৃত্তি হতো, নয়তো বোর্ড থেকে
 * অর্ডার **লুকিয়ে** ফেলত — আর রান্নাঘরের পর্দায় লুকিয়ে ফেলা মানে
 * ভুলে যাওয়া, অর্থাৎ কারও খাবার দেরি হওয়া।
 *
 * তাই ওখানে যা বসল সেটা সব অর্ডার দেখায়, শুধু **ক্রম** বদলায় — আর
 * এটাই বাণিজ্যিক KDS (Toast, Square, Lightspeed) গুলোর বোর্ডেও থাকে।
 */
export type KitchenSort = "oldest" | "newest" | "dine-in";

export const DEFAULT_KITCHEN_SORT: KitchenSort = "oldest";

export function isKitchenSort(value: unknown): value is KitchenSort {
  return typeof value === "string" && ["oldest", "newest", "dine-in"].includes(value);
}

export const KITCHEN_SORT_OPTIONS: FilterMenuOption<KitchenSort>[] = [
  /**
   * ⚠️ ডিফল্ট "Oldest first", আর এটা নিছক পছন্দ নয় — রান্নাঘরের
   * ন্যায্যতার নিয়ম। যে আগে অর্ডার দিয়েছেন তিনি আগে পাবেন। ডিফল্ট
   * উল্টো হলে ব্যস্ত সময়ে পুরনো অর্ডারগুলো তলায় চাপা পড়ে থাকত।
   */
  { value: "oldest", label: "Oldest first" },
  // নতুনগুলো উপরে — সদ্য আসা অর্ডার চোখে পড়ার জন্য, ঝিমিয়ে থাকা সময়ে।
  { value: "newest", label: "Newest first" },
  /**
   * টেবিলের অর্ডার আগে। খদ্দের সামনে বসে অপেক্ষা করছেন, আর
   * ডেলিভারির রাইডার এখনো আসেননি — তাই তাড়া এক নয়। ভেতরে
   * আবার পুরনোটাই আগে, অর্থাৎ ন্যায্যতা প্রতিটা দলের ভেতরে বজায় থাকে।
   */
  { value: "dine-in", label: "Dine in first" },
];
