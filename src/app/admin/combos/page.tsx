import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { ZERO, toMoney } from "@/lib/money";
import { HOME_COMBO_LIMIT, comboStatuses } from "@/lib/combo-pricing";
import Pagination from "@/app/admin/orders/Pagination";
import CombosToolbar from "./CombosToolbar";
import ComboRow, { type ComboRowData } from "./ComboRow";

export const metadata = { title: "Combos" };

const PAGE_SIZE = 5;

/**
 * src/app/admin/combos/page.tsx
 *
 * Manage the home page "Combo Deals". Same shell as Categories: welcome
 * header → search + Add → list → pagination.
 *
 * A combo is a bundle of existing menu items. It has no price field: the home
 * page prices it from the items' current menu prices and live offers, so a
 * discount is set by putting an offer on the items (Offers page).
 */
export default async function AdminCombosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireStaff("menu");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [rows, menuItems, settings] = await Promise.all([
    // Same order as the home page, so the list shows what customers see first.
    prisma.combo.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            quantity: true,
            menuItem: {
              select: { id: true, title: true, price: true, imageUrl: true, isAvailable: true },
            },
          },
        },
      },
    }),
    prisma.menuItem.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, isAvailable: true },
    }),
    getRestaurantSettings(),
  ]);

  // Status is worked out on the FULL list: whether a combo makes the home page
  // depends on the combos ahead of it, not on what the search box shows.
  const statuses = comboStatuses(
    rows.map((row) => ({
      id: row.id,
      isActive: row.isActive,
      items: row.items.map((i) => ({
        title: i.menuItem.title,
        isAvailable: i.menuItem.isAvailable,
      })),
    }))
  );

  const visible = rows.filter(
    (row) => !q || row.name.toLowerCase().includes(q.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const requested = Number(params.page);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= totalPages ? requested : 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  const menuOptions = menuItems.map((item) => ({
    value: item.id,
    label: item.isAvailable ? item.title : `${item.title} (unavailable)`,
  }));

  const data: ComboRowData[] = pageRows.map((row) => {
    const total = row.items.reduce(
      (sum, i) => sum.plus(toMoney(i.menuItem.price).times(i.quantity)),
      ZERO
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      thumb: row.imageUrl ?? row.items.find((i) => i.menuItem.imageUrl)?.menuItem.imageUrl ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      items: row.items.map((i) => ({
        menuItemId: i.menuItem.id,
        title: i.menuItem.title,
        quantity: i.quantity,
      })),
      totalLabel: formatAmount(total.toFixed(settings.currencyMinorUnits), settings.currency),
      status: statuses.get(row.id)!,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <span className="flex h-10 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px] md:self-auto">
          <Calendar
            className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <CombosToolbar menuOptions={menuOptions} />

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-col gap-2">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Combos
          </h2>
          <p className="max-w-[640px] font-sora text-[12px] leading-[1.7] text-black/70 md:text-[13px]">
            The home page shows the first {HOME_COMBO_LIMIT} live combos, lowest display order first.
            A combo&apos;s price is its items&apos; current prices added up. To discount it, add an
            offer to the items on the Offers page.
          </p>
        </div>

        {data.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {q
              ? "No combos match that search."
              : "No combos yet. Add your first combo to show it on the home page."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((combo) => (
              <ComboRow key={combo.id} combo={combo} menuOptions={menuOptions} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              Showing{" "}
              <span className="font-semibold text-black">
                {start + 1}–{start + data.length}
              </span>{" "}
              of <span className="font-semibold text-black">{visible.length}</span>{" "}
              {visible.length === 1 ? "Combo" : "Combos"}
            </p>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={params}
              basePath="/admin/combos"
            />
          </div>
        )}
      </div>
    </div>
  );
}