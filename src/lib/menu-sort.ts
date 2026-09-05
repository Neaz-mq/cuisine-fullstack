import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/menu-sort.ts
 *
 * প্রতিটা শ্রেণি-কার্ডের শিরোনামের পাশের pill (Figma Frame 2147236234,
 * 91×40, BG #F9F6F3, radius 100, লেখা Sora 400 14px)।
 *
 * ── Figma-তে ওখানে "This Week" আঁকা, কিন্তু ওটা বসানো হয়নি ──────────
 *
 * ⚠️ দুটো কারণ, আর দুটোই বাস্তব।
 *
 * এক, ওটা এই পাতায় **দ্বিতীয় বার** একই কাজ করত। উপরে Overview-র
 * মাথায় ইতিমধ্যেই একটা সময়ের ছাঁকনি আছে (All · This Month · Previous
 * Month), আর `MenuItem.createdAt` ধরে ছাঁকলে এই pill-টা হুবহু সেটাই
 * করত — শুধু একটা শ্রেণির মধ্যে সীমাবদ্ধ থেকে।
 *
 * দুই, আর এটাই আসল: মেনু জিনিসটা **সময়ের তালিকা নয়**। একটা বার্গার
 * গত বছর যোগ হয়েছে বলে সে "পুরনো খবর" নয় — সে এখনো বিক্রি হচ্ছে।
 * "This Week" বাছলে প্রায় প্রতিটা শ্রেণি খালি দেখাত, আর সেটা কোনো
 * কাজে আসত না।
 *
 * তার বদলে যেটা বসেছে সেটা ওই একই জায়গার, একই মাপের pill — কিন্তু
 * কাজটা এই কার্ডের জন্য সত্যিই প্রাসঙ্গিক: **সাজানো**। একটা শ্রেণিতে
 * ২০টা পদ থাকলে "সবচেয়ে দামিটা কোনটা", "কোনগুলো নতুন যোগ হলো" —
 * এগুলোই আসল প্রশ্ন, আর উত্তরটা এক ক্লিকে পাওয়া যায়।
 *
 * ⚠️ ছাঁকনি নয়, সাজানো — অর্থাৎ একটা পদও লুকোয় না। তাই এটা URL-এ যায়
 * না, প্রতিটা কার্ডের নিজের state-এ থাকে। ১৪টা শ্রেণির জন্য ১৪টা
 * query param রাখা মানে URL-টা অপাঠ্য করে ফেলা, অথচ share করার মতো
 * কিছুই ওতে নেই।
 */
export type MenuSort = "name" | "price-asc" | "price-desc" | "newest";

export const DEFAULT_MENU_SORT: MenuSort = "name";

export const MENU_SORT_OPTIONS: FilterMenuOption<MenuSort>[] = [
  { value: "name", label: "Name (A–Z)", triggerLabel: "A–Z" },
  // triggerLabel ছোট — pill-টা ৯১px, পুরো নামটা বসালে শিরোনামের ঘাড়ে
  // চেপে বসত। popup-এ পুরো নামই থাকে।
  { value: "price-asc", label: "Price: Low to High", triggerLabel: "Price ↑" },
  { value: "price-desc", label: "Price: High to Low", triggerLabel: "Price ↓" },
  { value: "newest", label: "Newest First", triggerLabel: "Newest" },
];

/**
 * সাজানোর তুলনা-function।
 *
 * ⚠️ `sort()` জায়গায় বসেই সাজায় (mutating), তাই caller-কে সবসময় একটা
 * অনুলিপির উপর চালাতে হয় — নাহলে prop হিসেবে আসা array-টাই বদলে যেত,
 * আর React-এর দৃষ্টিতে সেটা "একই" array হওয়ায় পুনরায় render হতো না।
 */
export function compareMenuItems<
  T extends { title: string; price: number; createdAt: string },
>(sort: MenuSort) {
  return (a: T, b: T) => {
    switch (sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "newest":
        // নতুনটা আগে। ISO string-এর তুলনা তারিখের তুলনার সমান, কারণ
        // ছাঁদটা (YYYY-MM-DDTHH:mm:ss) অক্ষরক্রমেই কালক্রম।
        return b.createdAt.localeCompare(a.createdAt);
      default:
        // localeCompare, `<` নয় — নাহলে "Éclair" সব ইংরেজি নামের
        // পরে গিয়ে বসত (Unicode code point অনুযায়ী É > Z)।
        return a.title.localeCompare(b.title);
    }
  };
}
