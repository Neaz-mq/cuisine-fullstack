import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { getKitchenInventoryAttention } from "@/lib/kitchen-dashboard-data";
import { STOCK_STATE_STYLE } from "@/lib/inventory-status";
import StockBar from "@/components/admin/StockBar";

export const metadata = { title: "Inventory" };

/**
 * src/app/admin/kitchen/inventory/page.tsx
 *
 * The kitchen's read-only look at what is running out — the target of the
 * Dashboard's "View Emergency Items" button and its Inventory card, and
 * the "Inventory" item in the kitchen sidebar.
 *
 * ⚠️ Deliberately NOT /admin/inventory. That page edits stock, costs,
 * suppliers and purchases, and sits behind the "inventory" scope, which
 * KITCHEN does not (and should not) hold. This page is behind "kitchen",
 * lists only ingredients that need attention, and shows no cost, supplier
 * or edit control — exactly the "narrow read-only glance" permissions.ts
 * leaves room for.
 */
export default async function KitchenInventoryPage() {
  await requireStaff("kitchen");
  const { rows, total } = await getKitchenInventoryAttention();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="flex w-fit items-center gap-2 font-sora text-[14px] font-medium leading-none text-black/70 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Inventory
          </h1>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {rows.length} of {total} need attention
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            Every ingredient is well stocked.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row) => {
              const style = STOCK_STATE_STYLE[row.state];
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 md:flex-row md:items-center md:justify-between md:gap-8"
                >
                  <div className="flex min-w-0 flex-col gap-2 md:w-[260px] md:shrink-0">
                    <p className="truncate font-frank-ruhl text-[18px] font-medium leading-none text-black">
                      {row.name}
                    </p>
                    {row.category && (
                      <p className="truncate font-sora text-[12px] leading-none text-black/70">
                        {row.category}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 md:max-w-[360px]">
                    <StockBar
                      state={row.state}
                      currentStock={row.currentStock}
                      maxCapacity={row.maxCapacity}
                      unit={row.unit}
                    />
                  </div>

                  <span
                    className={`flex h-9 w-fit shrink-0 items-center rounded-full px-3 font-sora text-[14px] font-normal leading-none ${style.className}`}
                  >
                    {style.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
