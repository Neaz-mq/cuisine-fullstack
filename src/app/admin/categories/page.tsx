import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import {
  DEFAULT_CATEGORY_FILTER,
  isCategoryFilter,
  type CategoryFilter,
} from "@/lib/category-filter";
import {
  DEFAULT_CATEGORY_SCOPE,
  isCategoryScope,
  type CategoryScope,
} from "@/lib/category-scope";
import CategoriesOverviewCards from "@/components/admin/CategoriesOverviewCards";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import CategoriesToolbar from "./CategoriesToolbar";
import CategoryListFilter from "./CategoryListFilter";
import CategoryRow from "./CategoryRow";

export const metadata = { title: "Categories" };

/**
 * src/app/admin/categories/page.tsx
 *
 * Figma Frame 2147236227 — Welcome header → search + Add → Overview →
 * Categories তালিকা → pagination।
 *
 * ⚠️ এই পাতাটাও Kitchen-এর মতো অ্যাপের নকশা-ব্যবস্থার বাইরে ছিল:
 * `max-w-3xl mx-auto px-4 py-8`, `text-gray-800`, `border-gray-200`,
 * `rounded-md` — অর্থাৎ নিজের একটা container আর Tailwind-এর ডিফল্ট
 * ধূসর, যেখানে বাকি সব admin পাতা AdminShell-এর ভেতরে cream/orange
 * ব্যবস্থায় চলে।
 */
const PAGE_SIZE = 5;

export default async function AdminCategoriesPage({
  searchParams,
}: {
  /**
   * ⚠️ খোলা Record, নির্দিষ্ট কয়েকটা key নয় — `Pagination` বাকি সব
   * param অপরিবর্তিত রেখে শুধু `page` বদলায়, তাই ওটা একটা
   * `Record<string, string | undefined>` আশা করে।
   */
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // layout.tsx-ও `requireStaff("categories")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("categories");
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const filter: CategoryFilter = isCategoryFilter(params.filter)
    ? params.filter
    : DEFAULT_CATEGORY_FILTER;
  /**
   * Overview কার্ডের ছাঁকনি — তালিকার `filter`-এর সাথে গুলিয়ে ফেলার
   * নয়। এটা শ্রেণি ছাঁকে না, শুধু "কোনটা পদ হিসেবে গোনা হবে" বদলায়।
   * বিস্তারিত `lib/category-scope.ts`-এ।
   */
  const scope: CategoryScope = isCategoryScope(params.scope)
    ? params.scope
    : DEFAULT_CATEGORY_SCOPE;
  const now = new Date();

  /**
   * ⚠️ সব শ্রেণি একবারে আনা হচ্ছে, page অনুযায়ী নয় — আর এটা ইচ্ছাকৃত।
   *
   * "Active" মানে অন্তত একটা পদ এখন পাওয়া যাচ্ছে, অর্থাৎ শর্তটা
   * শ্রেণির নিজের কোনো কলামে নেই, তার সন্তানদের উপর নির্ভর করে।
   * DB-তে ছাঁকতে গেলে `some: { isAvailable: true }` লিখতে হতো, আর
   * তখন Overview-র চারটে সংখ্যার জন্য আলাদা তিনটে query লাগত।
   *
   * শ্রেণি জিনিসটা অল্প — একটা রেস্তোরাঁয় ১০-২০টা, কখনো ৫০। তাই
   * একটাই query, তারপর memory-তে ছাঁকা আর গোনা — সবচেয়ে সরল আর
   * সবচেয়ে কম DB-ঘা। (Inventory-র শ্রেণি-ভাগেও একই যুক্তি।)
   */
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      menuItems: {
        orderBy: { title: "asc" },
        /**
         * ⚠️ `description` আর `imageUrl` এখানে যোগ হলো — খোলা তাকের
         * নকশায় (Figma Frame 2147236295) প্রতিটা পদ একটা কার্ড:
         * ৭৮×৭৮ ছবি, নাম, আর দুই লাইনের বিবরণ। CategoryRow client
         * component, তাই ওখান থেকে আলাদা করে আনার উপায় নেই — এই
         * একটাই query, শুধু দুটো কলাম বেশি।
         */
        select: {
          id: true,
          title: true,
          description: true,
          // ⚠️ `price` কেবল সম্পাদনার modal-এর জন্য — কার্ডে দাম দেখানো
          // হয় না (Figma-তে নেই)। Decimal হিসেবে আসে, নিচে সারি বানানোর
          // সময় `Number()` করে পাঠানো হয়।
          price: true,
          imageUrl: true,
          isAvailable: true,
        },
      },
    },
  });

  // Overview-র সংখ্যাগুলো **ছাঁকার আগের** তালিকা থেকে — "৩টে শ্রেণি
  // খালি" সত্যটা search box-এ কী লেখা তার উপর নির্ভর করা উচিত নয়।
  const total = rows.length;
  const active = rows.filter((row) => row.menuItems.some((item) => item.isAvailable)).length;

  /**
   * ⚠️ শেষ দুটো সংখ্যা scope-এর উপর নির্ভর করে, প্রথম দুটো করে না।
   *
   * "Total Categories" স্বভাবতই বদলায় না। "Active"-ও নয় — ওটার
   * সংজ্ঞাই ইতিমধ্যে "অন্তত একটা পদ এখন পাওয়া যাচ্ছে", অর্থাৎ ওটা
   * সবসময়ই available-দৃষ্টিতে গোনা।
   *
   * বদলায় "Menu Items" আর "Empty"। available scope-এ Empty মানে
   * "খদ্দেরের কাছে কার্যত খালি" — পদ আছে কিন্তু সবগুলো বন্ধ, এমন
   * শ্রেণিও ওখানে ধরা পড়ে। তখন Active + Empty = Total, আর সেটাই
   * উদ্দেশ্য: মেনুর কতটা এই মুহূর্তে সত্যিই খোলা।
   */
  const availableOnly = scope === "available";
  const menuItems = rows.reduce(
    (sum, row) =>
      sum +
      (availableOnly ? row.menuItems.filter((item) => item.isAvailable).length : row.menuItems.length),
    0
  );
  const empty = rows.filter((row) =>
    availableOnly ? !row.menuItems.some((item) => item.isAvailable) : row.menuItems.length === 0
  ).length;

  const visible = rows.filter((row) => {
    if (filter === "active" && !row.menuItems.some((item) => item.isAvailable)) return false;
    if (filter === "empty" && row.menuItems.length > 0) return false;
    if (!q) return true;
    return row.name.toLowerCase().includes(q.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  /**
   * পদ সম্পাদনার modal-এর Category dropdown — **ছাঁকার আগের** পুরো
   * তালিকা থেকে। `visible` থেকে নিলে "Empty" ছাঁকনি চালু থাকা অবস্থায়
   * dropdown-এ কেবল খালি শ্রেণিগুলোই থাকত, আর একটা পদ অন্য শ্রেণিতে
   * সরানোর উপায়ই বন্ধ হয়ে যেত।
   */
  const categoryOptions = rows.map((row) => ({ value: row.id, label: row.name }));

  // দামের ঘরের গায়ে ISO code দেখানোর জন্য ("USD")। পুরনো MenuItemForm
  // এটা /api/settings থেকে client-এ আনত; এই পাতা server component, তাই
  // সরাসরি পড়ে নেওয়াই সরল আর একটা round-trip কম।
  const { currency } = await getRestaurantSettings();

  /**
   * ⚠️ URL-এর page নম্বরটা যাচাই করে নেওয়া। `?page=99` হাতে লিখলে —
   * বা কেউ পুরনো bookmark খুললে, যখন বেশি শ্রেণি ছিল — `slice` খালি
   * তালিকা দিত আর ব্যবহারকারী একটা শূন্য কার্ড দেখে বুঝতেন না কেন।
   */
  const requested = Number(params.page);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= totalPages ? requested : 1;

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Staff/Users/Kitchen পাতার হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

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

          {/**
           * ⚠️ এই বোতামটা আগে ছিল না, আর কারণটা ছিল সৎ: categories-এর
           * কোনো export endpoint ছিল না, আর যে বোতাম চাপলে 404 আসে
           * সেটা না থাকার চেয়েও খারাপ। এখন route-টা আছে
           * (`/api/admin/categories/export`), তাই বোতামটাও এলো।
           *
           * forwardParams-এ `page` নেই, ইচ্ছাকৃতভাবে — export মানে পুরো
           * ছাঁকা তালিকা, পর্দায় দেখা পাঁচটা সারি নয়। `scope`-ও নেই:
           * ওটা কেবল Overview-র সংখ্যা বদলায়, তালিকার একটা সারিও নয়।
           */}
          <ExportReportButton
            endpoint="/api/admin/categories/export"
            forwardParams={["q", "filter"]}
            fallbackFilename="cuisine-categories.csv"
          />
        </div>
      </div>

      <CategoriesToolbar />

      <CategoriesOverviewCards
        total={total}
        active={active}
        menuItems={menuItems}
        empty={empty}
        scope={scope}
      />

      {/* --- Categories — Frame 2147236295: column, padding 30, gap 24,
              radius 20, সাদা। --- */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Categories
          </h2>

          <CategoryListFilter value={filter} />
        </div>

        {pageRows.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {q || filter !== "all"
              ? "No categories match that filter."
              : "No categories yet. Add your first category to start building the menu."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pageRows.map((row) => (
              <CategoryRow
                key={row.id}
                id={row.id}
                name={row.name}
                /* Decimal → number, নাহলে client component-এ পাঠানোই
                   যায় না — CategoryRowItem-এর `price`-এ বিস্তারিত। */
                items={row.menuItems.map((item) => ({
                  ...item,
                  price: Number(item.price),
                }))}
                categories={categoryOptions}
                currency={currency}
              />
            ))}
          </div>
        )}

        {/* Frame 2147232469 — বাঁয়ে "Showing …", ডানে page বোতাম। */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]"
                aria-hidden="true"
              />
              Showing{" "}
              <span className="font-semibold text-black">
                {start + 1}–{start + pageRows.length}
              </span>{" "}
              of <span className="font-semibold text-black">{visible.length}</span>{" "}
              {visible.length === 1 ? "Category" : "Categories"}
            </p>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={params}
              basePath="/admin/categories"
            />
          </div>
        )}
      </div>
    </div>
  );
}
