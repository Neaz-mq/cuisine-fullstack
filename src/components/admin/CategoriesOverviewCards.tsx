import { LayoutDashboard, CircleCheck, Package, CircleAlert } from "lucide-react";
import CategoryScopeFilter from "@/components/admin/CategoryScopeFilter";
import { CATEGORY_SCOPE_HINTS, type CategoryScope } from "@/lib/category-scope";

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
 * ── শিরোনামের পাশের ছাঁকনি ──────────────────────────────────────────
 *
 * ⚠️ এখানে আগে কোনো ছাঁকনি ছিল না — Figma-র "Today ⌄" বসানো যায়নি
 * (`Category`-তে তারিখ নেই) আর অবস্থার ছাঁকনি বসালে কার্ডগুলো
 * নিজেদের উত্তরই আবার দেখাত। এখন যেটা বসেছে সেটা তৃতীয় জিনিস:
 * শ্রেণি ছাঁকে না, **কোনটা "পদ" হিসেবে গোনা হবে** সেটা বদলায় —
 * সবগুলো, নাকি কেবল এই মুহূর্তে পাওয়া যাচ্ছে এমনগুলো। পুরো যুক্তিটা
 * `lib/category-scope.ts`-এ।
 *
 * সংখ্যা গোনার কাজটা এখানে নয়, `page.tsx`-এ — ওখানে শ্রেণির পুরো
 * তালিকাটা এমনিতেই একবার আনা হয় (তালিকা + ছাঁকনি + pagination সবই
 * ওটার উপরে চলে), তাই একই ডেটা দ্বিতীয়বার query করার কোনো কারণ নেই।
 */
export default function CategoriesOverviewCards({
  total,
  active,
  menuItems,
  empty,
  scope,
}: {
  /** মোট শ্রেণি — scope যাই হোক, এটা বদলায় না। */
  total: number;
  /** যেগুলোতে অন্তত একটা পদ **এখন পাওয়া যাচ্ছে**। */
  active: number;
  /** scope অনুযায়ী: সব পদ, নাকি কেবল পাওয়া-যাচ্ছে এমন পদ। */
  menuItems: number;
  /** scope অনুযায়ী: একটাও পদ নেই, নাকি একটাও *পাওয়া যাচ্ছে* না। */
  empty: number;
  scope: CategoryScope;
}) {
  const hints = CATEGORY_SCOPE_HINTS[scope];

  const CARDS = [
    {
      label: "Total Categories",
      value: total,
      hint: hints[0],
      icon: LayoutDashboard,
    },
    {
      label: "Active",
      value: active,
      hint: hints[1],
      icon: CircleCheck,
    },
    {
      label: "Menu Items",
      value: menuItems,
      hint: hints[2],
      icon: Package,
    },
    {
      label: "Empty",
      value: empty,
      hint: hints[3],
      icon: CircleAlert,
    },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40 — Suppliers/
          Users/Staff-এর Overview-এর হুবহু একই মাথা। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>

        <CategoryScopeFilter value={scope} />
      </div>

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
