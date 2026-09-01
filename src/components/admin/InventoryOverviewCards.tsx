import { AlarmClock, CircleAlert, Info, Triangle } from "lucide-react";
import { stockStateOf } from "@/lib/inventory-status";

/**
 * src/components/admin/InventoryOverviewCards.tsx
 *
 * Figma-র "Kitchen Inventory" — Total Items · Low Stock · Out of Stock ·
 * Emergency।
 *
 * ── কেন এখানে period ছাঁকনি নেই ─────────────────────────────────────
 *
 * Users/Staff/Suppliers-এর Overview-তে All / This Month / Previous Month
 * আছে, কিন্তু এখানে নেই — আর Figma-তেও নেই (ওখানে "Today ⌄" আঁকা,
 * যেটা dashboard থেকে copy করা)।
 *
 * কারণটা এই সংখ্যাগুলোর স্বভাবে: "এখন কত জিনিস কম আছে" একটা **বর্তমান
 * অবস্থা**, গুদামের stock-এর মতো। "গত মাসে কত জিনিস কম ছিল" প্রশ্নটার
 * উত্তর দিতে হলে প্রতিদিনের stock-এর ইতিহাস রাখতে হতো, যেটা schema-য়
 * নেই (StockMovement আছে, কিন্তু সেটা নড়াচড়ার তালিকা, প্রতিদিনের
 * স্থিরচিত্র নয়)। ছাঁকনিটা বসালে সেটা হয় কিছুই বদলাত না, নয়তো ভুল
 * সংখ্যা দেখাত।
 *
 * ⚠️ সংখ্যাগুলো **সব সক্রিয় উপকরণ** ধরে — উপরের search/status ছাঁকনি
 * এদের বদলায় না। ইচ্ছাকৃত: "৩টে জিনিস ফুরিয়ে গেছে" সত্যটা search box-এ
 * কী লেখা আছে তার উপর নির্ভর করা উচিত নয়।
 */
export default function InventoryOverviewCards({
  items,
}: {
  items: {
    currentStock: number;
    reorderThreshold: number;
    emergencyThreshold: number;
    category: string | null;
  }[];
}) {
  // ⚠️ গণনাটা এখানে, DB-তে নয় — আর সেটা বাধ্য হয়েই। "currentStock <=
  // reorderThreshold" একটা column-বনাম-column তুলনা, যেটা Postgres
  // indexed WHERE-এ করতে পারে না (schema-র @@index([isActive])-এর
  // মন্তব্যে এই tradeoff-টা আগে থেকেই লেখা আছে)। তাই সক্রিয় উপকরণের
  // ছোট তালিকাটা এনে memory-তে ছাঁকা — একই সিদ্ধান্ত
  // /api/admin/inventory?lowStock=true-তেও।
  let low = 0;
  let out = 0;
  let emergency = 0;
  for (const item of items) {
    const state = stockStateOf(item);
    if (state === "low") low += 1;
    else if (state === "out") out += 1;
    else if (state === "emergency") emergency += 1;
  }

  const categories = new Set(items.map((item) => item.category).filter(Boolean));

  const CARDS = [
    {
      label: "Total Items",
      value: items.length,
      hint: `Across ${categories.size} ${categories.size === 1 ? "category" : "categories"}`,
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
      <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
        Kitchen Inventory
      </h2>

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
