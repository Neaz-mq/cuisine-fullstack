import { LayoutDashboard, CircleCheck, Package, CircleAlert } from "lucide-react";

/**
 * src/components/admin/CategoriesOverviewCards.tsx
 *
 * Figma Frame 2147236297 — Categories পাতার Overview।
 *
 * খোলসটা Staff/Users/Suppliers/Inventory/Kitchen-এর Overview-এর হুবহু
 * নকল (কার্ড: column, padding 16, gap 20, radius 16, #F9F6F3; আইকনের
 * ঘর 40×40 সাদা গোল)।
 *
 * ── "Featured" কার্ডটা নেই, আর কেন ──────────────────────────────────
 *
 * ⚠️ Figma-তে তৃতীয় কার্ড "Featured / Highlighted Categories"। কিন্তু
 * schema-য় `Category`-র মাঠ মাত্র তিনটে: `id`, `name`, `menuItems` —
 * কোনো `isFeatured` নেই। কলামটা যোগ করে দিলে সেটা সেট করার কোনো
 * উপায় থাকত না (form-এ toggle নেই, API-তে মাঠ নেই), অর্থাৎ কার্ডটা
 * চিরকাল "0" দেখাত। একটা মিথ্যা শূন্যের চেয়ে সত্যি সংখ্যা ভালো।
 *
 * তাই ওই ঘরে বসেছে "Menu Items" — সব শ্রেণি মিলিয়ে মোট কতগুলো পদ।
 * সংখ্যাটা এমনিতেই আছে, আর প্রশ্নটাও কাছাকাছি: "মেনুতে জিনিস কতটা"।
 *
 * সত্যিকারের Featured চাইলে তিনটে জিনিস লাগবে — `isFeatured` কলাম +
 * migration, CategoryForm-এ একটা toggle, আর API-তে মাঠটা নেওয়া।
 * বললেই করে দেব; আন্দাজে schema বদলাইনি।
 *
 * ── এখানে ছাঁকনি নেই, আর সেটাও ইচ্ছাকৃত ─────────────────────────────
 *
 * ⚠️ Figma-তে শিরোনামের পাশে "Today ⌄" আঁকা। `Category`-তে কোনো
 * তারিখের মাঠই নেই (`createdAt` পর্যন্ত না), তাই সময় দিয়ে ছাঁকা
 * অসম্ভব। আর অবস্থা দিয়ে ছাঁকাটা এখানে চক্রাকার হতো: "Active"
 * বাছলে কার্ডগুলো দাঁড়াত Total 5 · Active 5 · Empty 0 — অর্থাৎ
 * ছাঁকনিটা নিজের উত্তরটাই আবার দেখাত।
 *
 * সেই ছাঁকনিটা তাই নিচের তালিকার শিরোনামে বসেছে, যেখানে ওটা
 * সত্যিই কাজে লাগে।
 */
export default function CategoriesOverviewCards({
  total,
  active,
  menuItems,
  empty,
}: {
  /** মোট শ্রেণি। */
  total: number;
  /** যেগুলোতে অন্তত একটা পদ **এখন পাওয়া যাচ্ছে**। */
  active: number;
  /** সব শ্রেণি মিলিয়ে মোট পদ। */
  menuItems: number;
  /** যেগুলোতে একটাও পদ নেই। */
  empty: number;
}) {
  const CARDS = [
    {
      label: "Total Categories",
      value: total,
      hint: "All Menu Categories",
      icon: LayoutDashboard,
    },
    {
      label: "Active",
      value: active,
      hint: "Currently Available",
      icon: CircleCheck,
    },
    {
      label: "Menu Items",
      value: menuItems,
      hint: "Across All Categories",
      icon: Package,
    },
    {
      label: "Empty",
      value: empty,
      hint: "No Items Added",
      icon: CircleAlert,
    },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
        Overview
      </h2>

      {/* Figma Frame 2147236226: row, gap 20, চারটে কার্ড সমান ভাগে। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <div key={card.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {card.label}
              </h3>
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
