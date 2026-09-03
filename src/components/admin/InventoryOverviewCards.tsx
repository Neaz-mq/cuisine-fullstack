import { AlarmClock, CircleAlert, Info, Triangle } from "lucide-react";
import { INVENTORY_CATEGORIES, UNCATEGORISED, stockStateOf } from "@/lib/inventory-status";
import InventoryCategoryFilter from "@/components/admin/InventoryCategoryFilter";
import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/components/admin/InventoryOverviewCards.tsx
 *
 * Figma-র "Kitchen Inventory" — Total Items · Low Stock · Out of Stock ·
 * Emergency।
 *
 * ── ছাঁকনিটা period নয়, category — আর কেন ───────────────────────────
 *
 * Figma-তে এখানে "Today ⌄" আঁকা, কিন্তু সেটা বসানো যায় না। এই চারটে
 * সংখ্যাই **বর্তমান অবস্থা**, গুদামের stock-এর মতো। "গত মাসে কত জিনিস
 * কম ছিল" প্রশ্নের উত্তর দিতে হলে প্রতিদিনের stock-এর স্থিরচিত্র রাখতে
 * হতো, যেটা schema-য় নেই (StockMovement আছে, কিন্তু সেটা নড়াচড়ার
 * তালিকা, স্থিরচিত্র নয়)। period ছাঁকনি বসালে হয় কিছুই বদলাত না,
 * নয়তো ভুল সংখ্যা দেখাত।
 *
 * শ্রেণি দিয়ে ছাঁকাটা ওই একই জায়গায় সত্যিকারের কাজে লাগে, আর
 * inventory ব্যবস্থায় এটাই সবচেয়ে প্রচলিত ছাঁকনি: "প্রোটিনের অবস্থা
 * কেমন" — মোট কতটা, কতটা কম, কতটা ফুরিয়েছে। সংখ্যাগুলোর সংজ্ঞা এতে
 * বদলায় না, শুধু পরিধি ছোট হয় — অর্থাৎ Users/Staff-এর period ছাঁকনির
 * মতো এখানে "All মানে প্রতিটা কার্ডে আলাদা" জাতীয় জটিলতাও নেই।
 *
 * ⚠️ সংখ্যাগুলো **সব সক্রিয় উপকরণ** ধরে — উপরের search/status ছাঁকনি
 * এদের বদলায় না। ইচ্ছাকৃত: "৩টে জিনিস ফুরিয়ে গেছে" সত্যটা search box-এ
 * কী লেখা আছে তার উপর নির্ভর করা উচিত নয়।
 */
export default function InventoryOverviewCards({
  items,
  category = "all",
}: {
  items: {
    currentStock: number;
    reorderThreshold: number;
    emergencyThreshold: number;
    category: string | null;
  }[];
  /** URL-এর `cat` param। "all" বা কোনো একটা শ্রেণির নাম। */
  category?: string;
}) {
  /**
   * ⚠️ ছাঁকনির তালিকাটা **ছাঁকার আগের** items থেকে — নাহলে "Proteins"
   * বাছার পরে তালিকায় আর কোনো শ্রেণি থাকত না, আর ব্যবহারকারী আটকে
   * যেতেন (ফেরার পথ শুধু "All Categories")।
   *
   * ক্রমটা INVENTORY_CATEGORIES-এর, বর্ণানুক্রমিক নয় — নিচের ভাগগুলো
   * যে ক্রমে সাজে, ছাঁকনির তালিকাও সেই ক্রমেই থাকা উচিত।
   */
  const present = new Set(items.map((item) => item.category ?? UNCATEGORISED));
  const ordered = [
    ...INVENTORY_CATEGORIES.filter((name) => present.has(name)),
    ...(present.has(UNCATEGORISED) ? [UNCATEGORISED] : []),
  ];

  const options: FilterMenuOption<string>[] = [
    // pill-এ ছোট নাম — "All Categories" পুরোটা বসালে pill-টা শিরোনামের
    // দিকে অনেকটা এগিয়ে আসত। OVERVIEW_PERIOD_OPTIONS-এও একই কৌশল।
    { value: "all", label: "All Categories", triggerLabel: "All" },
    ...ordered.map((name) => ({ value: name, label: name })),
  ];

  /**
   * ⚠️ URL-এর মানটা যাচাই করে নেওয়া। `?cat=Sauces` হাতে লিখলে — বা
   * কোনো শ্রেণির শেষ জিনিসটা মুছে ফেলার পর পুরনো bookmark খুললে —
   * ছাঁকনিটা এমন একটা নামে আটকে থাকত যেটা তালিকায় নেই, আর চারটে
   * শূন্য দেখাত। তখন চুপচাপ "সব" দেখানোই সৎ।
   */
  const selected = present.has(category) ? category : "all";
  const visible =
    selected === "all"
      ? items
      : items.filter((item) => (item.category ?? UNCATEGORISED) === selected);
  // ⚠️ গণনাটা এখানে, DB-তে নয় — আর সেটা বাধ্য হয়েই। "currentStock <=
  // reorderThreshold" একটা column-বনাম-column তুলনা, যেটা Postgres
  // indexed WHERE-এ করতে পারে না (schema-র @@index([isActive])-এর
  // মন্তব্যে এই tradeoff-টা আগে থেকেই লেখা আছে)। তাই সক্রিয় উপকরণের
  // ছোট তালিকাটা এনে memory-তে ছাঁকা — একই সিদ্ধান্ত
  // /api/admin/inventory?lowStock=true-তেও।
  let low = 0;
  let out = 0;
  let emergency = 0;
  for (const item of visible) {
    const state = stockStateOf(item);
    if (state === "low") low += 1;
    else if (state === "out") out += 1;
    else if (state === "emergency") emergency += 1;
  }

  const categories = new Set(visible.map((item) => item.category).filter(Boolean));

  const CARDS = [
    {
      label: "Total Items",
      value: visible.length,
      // একটা শ্রেণি বাছা থাকলে "Across 1 category" লেখাটা অর্থহীন
      // পুনরাবৃত্তি — pill-এ নামটা তো দেখাই যাচ্ছে। তখন বরং নামটাই।
      hint:
        selected === "all"
          ? `Across ${categories.size} ${categories.size === 1 ? "category" : "categories"}`
          : `In ${selected}`,
      icon: Info,
    },
    {
      label: "Low Stock",
      value: low,
      hint: "At or below reorder level",
      icon: CircleAlert,
    },
    {
      label: "Out of Stock",
      value: out,
      hint: "Blocking menu items",
      icon: Triangle,
    },
    {
      label: "Emergency",
      value: emergency,
      hint: "Needed for today's orders",
      icon: AlarmClock,
    },
  ];

  return (
    /* Figma Frame 2147236275: column, padding 30, gap 24, radius 20,
       BG #FFFFFF — বাকি পাতাগুলোর Overview-এর হুবহু একই খোলস। */
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
      {/* Figma: শিরোনাম বাঁয়ে, ছাঁকনির pill ডান কিনারায়। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Kitchen Inventory
        </h2>

        {/* ⚠️ একটার বেশি শ্রেণি না থাকলে ছাঁকনিটাই দেখানো হয় না।
            একটামাত্র বিকল্পের dropdown ক্লিক করার মতো কিছু দেয় না,
            শুধু "এখানে কিছু একটা আছে" ভাবিয়ে সময় নষ্ট করে। */}
        {ordered.length > 1 && (
          <InventoryCategoryFilter value={selected} options={options} />
        )}
      </div>

      {/* Figma Frame 2147236226: row, gap 20, চারটে কার্ড সমান ভাগে। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          /* Card: column, padding 16, gap 20, radius 16, BG #F9F6F3। */
          <div key={card.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {card.label}
              </h3>
              {/* Frame 2147232069: 40×40, BG #FFFFFF, পুরো গোল,
                  icon 18×18 stroke 1.2। */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <card.icon
                  className="h-[18px] w-[18px] text-black"
                  strokeWidth={1.2}
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {card.value}
              </p>
              <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                {card.hint}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
