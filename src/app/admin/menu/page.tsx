import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import {
  DEFAULT_OVERVIEW_PERIOD,
  isOverviewPeriod,
  type OverviewPeriod,
} from "@/lib/overview-period";
import {
  DEFAULT_MENU_STATUS,
  isMenuStatus,
  type MenuStatusFilter,
} from "@/lib/menu-status-filter";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import MenuOverviewCards from "@/components/admin/MenuOverviewCards";
import MenuToolbar from "./MenuToolbar";
import MenuCategorySection, { type MenuSectionItem } from "./MenuCategorySection";

export const metadata = { title: "Menu" };

/**
 * src/app/admin/menu/page.tsx
 *
 * Figma Frame 2147236227 — Welcome header → search + status + Add Item
 * → Overview → প্রতিটা শ্রেণির নিজের কার্ড।
 *
 * ⚠️ এই পাতাটা আগে অ্যাপের নকশা-ব্যবস্থার সম্পূর্ণ বাইরে ছিল:
 * `max-w-5xl mx-auto px-4 py-8`, `text-gray-800`, `border-gray-200`,
 * `rounded-md` — নিজের একটা container আর Tailwind-এর ডিফল্ট ধূসর,
 * যেখানে বাকি সব admin পাতা AdminShell-এর ভেতরে cream/orange
 * ব্যবস্থায় চলে। Kitchen আর Categories-এর ক্ষেত্রেও ঠিক এটাই হয়েছিল,
 * আর সারানোটাও একই ছাঁদে।
 *
 * ── এই পাতায় তিনটে আলাদা ছাঁকনি, আর তিনটে তিন জিনিস করে ────────────
 *
 * গুলিয়ে যাওয়া সহজ, তাই এক জায়গায় লিখে রাখা:
 *
 *   toolbar-এর "All Statuses"  → **তালিকা** ছাঁকে (URL: ?status=)
 *   Overview-র "All/This Month" → **উপরের চারটে সংখ্যা** (URL: ?period=)
 *   কার্ডের "A–Z / Price ↑"     → কেবল **সাজায়**, কিছু লুকোয় না
 *                                 (URL-এ নেই, কার্ডের নিজের state)
 *
 * search ঘরটা (?q=) তালিকা ছাঁকে, Overview-কে ছোঁয় না — Overview
 * সবসময় পুরো মেনুর হিসাব দেয়, নাহলে "Total Items" খুঁজতে খুঁজতে
 * বদলে যেত আর সংখ্যাটার আর কোনো মানে থাকত না।
 */
export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // layout.tsx-ও `requireStaff("menu")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("menu");
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status: MenuStatusFilter = isMenuStatus(params.status)
    ? params.status
    : DEFAULT_MENU_STATUS;
  const period: OverviewPeriod = isOverviewPeriod(params.period)
    ? params.period
    : DEFAULT_OVERVIEW_PERIOD;
  const now = new Date();

  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;

  /**
   * ⚠️ সব শ্রেণি ও তাদের সব পদ একবারে — page অনুযায়ী নয়, আর সেটা
   * ইচ্ছাকৃত। এই নকশায় pagination শ্রেণি-**প্রতি**, অর্থাৎ একই পর্দায়
   * ১৪টা আলাদা তালিকা, প্রতিটার নিজের page। DB-তে ওভাবে ভাগ করতে
   * গেলে শ্রেণি-প্রতি একটা করে query লাগত।
   *
   * মেনু জিনিসটা ছোট — একটা রেস্তোরাঁয় কয়েকশো পদ, হাজার নয়। তাই
   * একটাই query, তারপর memory-তে ছাঁকা আর সাজানো। Categories পাতাতেও
   * একই যুক্তি, আর সেখানেও একই কথা লেখা আছে।
   */
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      menuItems: {
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
          createdAt: true,
          // Figma-র "Nutrition & Time" আর "Ingredients" কলামের জন্য।
          //
          // ⚠️ `ingredients` relation-টা **আনা হয় না**, ইচ্ছাকৃতভাবে।
          // ওটা recipe (InventoryItem + পরিমাণ), আর এই পর্দায় ওটা আর
          // দেখানো হয় না — নকশার কলামটা `ingredientTags`, অর্থাৎ হাতে
          // লেখা তালিকা। recipe টানলে প্রতিটা পদের জন্য একটা করে
          // join লাগত, অথচ ফলটা কোথাও ব্যবহারই হত না।
          calories: true,
          fatGrams: true,
          proteinGrams: true,
          carbGrams: true,
          prepTimeMinutes: true,
          ingredientTags: true,
          foodStatus: true,
        },
      },
    },
  });

  const categoryOptions = rows.map((row) => ({ value: row.id, label: row.name }));

  const needle = q.toLowerCase();

  /**
   * DB-র সারিগুলো → client component যা বোঝে সেই আকার।
   *
   * ⚠️ এখানে তিনটে রূপান্তর বাধ্যতামূলক, সৌন্দর্যের জন্য নয়: `Decimal`
   * আর `Date` — দুটোই সরল object নয়, তাই server component থেকে
   * client-এ পাঠালে Next.js throw করে ("Only plain objects can be
   * passed to Client Components")। দাম `Number()`, তারিখ ISO string।
   *
   * দামের **লেখা** রূপটাও (`priceLabel`) এখানেই তৈরি — `formatAmount`
   * মুদ্রার minor unit জানে, আর সেটা RestaurantSettings-এ, অর্থাৎ
   * server-এ। client-এ `$` জুড়ে দিলে যে রেস্তোরাঁ ডলারে দাম রাখে না
   * তার প্রতিটা দাম ভুল দেখাত।
   */
  const sections = rows.map((row) => {
    const items: MenuSectionItem[] = row.menuItems
      .filter((item) => {
        if (status === "available" && !item.isAvailable) return false;
        if (status === "unavailable" && item.isAvailable) return false;
        if (!needle) return true;
        return (
          item.title.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle)
        );
      })
      .map((item) => {
        const price = Number(item.price);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          price,
          imageUrl: item.imageUrl,
          isAvailable: item.isAvailable,
          createdAt: item.createdAt.toISOString(),
          priceLabel: formatAmount(price.toFixed(units), settings.currency),
          calories: item.calories,
          fatGrams: item.fatGrams,
          proteinGrams: item.proteinGrams,
          carbGrams: item.carbGrams,
          prepTimeMinutes: item.prepTimeMinutes,
          ingredientTags: item.ingredientTags,
          foodStatus: item.foodStatus,
        };
      });

    return { id: row.id, name: row.name, items };
  });

  /**
   * ছাঁকনি বা খোঁজা চালু থাকলে ফলহীন শ্রেণিগুলো লুকিয়ে যায় — নাহলে
   * "pizza" খুঁজলে ১৩টা খালি কার্ডের ভেতরে একটা ফল খুঁজতে হতো।
   *
   * কিছুই ছাঁকা না থাকলে সবগুলোই থাকে, খালিগুলো সহ — ওখানে খালি হওয়াটা
   * নিজেই একটা তথ্য ("Soup শ্রেণিটা বানানো হয়েছে, কিছু যোগ করা হয়নি")।
   */
  const filtering = Boolean(q) || status !== DEFAULT_MENU_STATUS;
  const visibleSections = filtering
    ? sections.filter((section) => section.items.length > 0)
    : sections;

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Categories/Staff/Users/Kitchen-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        {/* Frame 2147232352: row, justify-end, gap 10 — তারিখ-pill (166×50)
            আর কালো "Export Report" (176×50)। */}
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          {/* forwardParams-এ `period` নেই, ইচ্ছাকৃতভাবে — ওটা কেবল
              Overview-র সংখ্যা বদলায়, তালিকার একটা সারিও নয়। */}
          <ExportReportButton
            endpoint="/api/admin/menu/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-menu.csv"
          />
        </div>
      </div>

      <MenuToolbar
        status={status}
        categories={categoryOptions}
        currency={settings.currency}
      />

      <MenuOverviewCards period={period} />

      {rows.length === 0 ? (
        <div className="rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            No categories yet. Add a category from the Categories page first — every
            menu item belongs to one.
          </p>
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            No menu items match that search or filter.
          </p>
        </div>
      ) : (
        // Frame 2147236297: column, gap 20 — শ্রেণির কার্ডগুলো।
        <div className="flex flex-col gap-5">
          {visibleSections.map((section) => (
            <MenuCategorySection
              key={section.id}
              categoryId={section.id}
              categoryName={section.name}
              items={section.items}
              categories={categoryOptions}
              currency={settings.currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
