import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { stockStateOf } from "@/lib/inventory-status";
import InventoryRow from "@/app/admin/inventory/InventoryRow";
import Pagination from "@/app/admin/orders/Pagination";
import {
  KITCHEN_INVENTORY_API,
  KITCHEN_INVENTORY_PATH,
  loadKitchenInventory,
} from "../data";

export const metadata = { title: "Emergency stock" };

/**
 * src/app/admin/kitchen/inventory/emergency/page.tsx
 *
 * Where "View Emergency Items" goes — from the Dashboard's banner and from
 * the Inventory page's banner. Figma "View Emergency": an "Emergency" card
 * listing the urgent ingredients, each with Restock, and pagination below.
 *
 * It is its own page, not a filter on the Inventory page: a warning button
 * should land somewhere definite (a filter change looks like nothing
 * happened), and the address can be sent to someone.
 *
 * "Out of stock" items are included with the emergency ones. Same job — order
 * now — and leaving them out would show "almost out" but hide "completely
 * out", which is backwards. Same set as the Dashboard's Emergency Stock card.
 *
 * Mirror of /admin/inventory/emergency/page.tsx, for the "kitchen" scope:
 * modals use the kitchen API, and there is no Edit button.
 */

/** Figma: "Showing 1–10 of …" */
const ITEMS_PER_PAGE = 10;

/** Worst first. Not by raw quantity: 2 Kg of flour and 2 pcs of eggs are not comparable. */
const SEVERITY = { out: 0, emergency: 1 } as const;

export default async function KitchenEmergencyInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireStaff("kitchen");

  const params = await searchParams;
  const { items, suppliers, currency } = await loadKitchenInventory();

  const urgent = items
    .filter((item) => {
      const state = stockStateOf(item);
      return state === "emergency" || state === "out";
    })
    .sort((a, b) => {
      const sa = SEVERITY[stockStateOf(a) as keyof typeof SEVERITY];
      const sb = SEVERITY[stockStateOf(b) as keyof typeof SEVERITY];
      return sa - sb || a.name.localeCompare(b.name);
    });

  const total = urgent.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  // A hand-edited or stale ?page= (99, abc) falls back to page 1 rather than an empty card.
  const requested = Number(params.page);
  const page =
    Number.isInteger(requested) && requested >= 1 && requested <= totalPages ? requested : 1;
  const start = (page - 1) * ITEMS_PER_PAGE;
  const pageItems = urgent.slice(start, start + ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={KITCHEN_INVENTORY_PATH}
        className="flex w-fit items-center gap-2 font-sora text-[14px] font-medium leading-none text-black/70 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to Inventory
      </Link>

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Emergency
          </h1>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {total} {total === 1 ? "item" : "items"}
          </span>
        </div>

        {total === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            Nothing urgent right now — every ingredient is above its emergency threshold.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pageItems.map((item) => (
              <InventoryRow
                key={item.id}
                item={item}
                suppliers={suppliers}
                currency={currency}
                apiBase={KITCHEN_INVENTORY_API}
                canEdit={false}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              Showing{" "}
              <span className="font-semibold text-black">
                {start + 1}–{start + pageItems.length}
              </span>{" "}
              of <span className="font-semibold text-black">{total}</span>{" "}
              {total === 1 ? "Item" : "Items"}
            </p>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={params}
              basePath={`${KITCHEN_INVENTORY_PATH}/emergency`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
