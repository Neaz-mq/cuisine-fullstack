import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/require-admin";
import { getPrepList } from "@/lib/kitchen-dashboard-data";
import PrepSnapshot from "@/components/admin/kitchen/PrepSnapshot";

export const metadata = { title: "Prep List" };

/**
 * src/app/admin/kitchen/prep/page.tsx
 *
 * "View All" on the Dashboard's Today's Prep Snapshot, and the "Prep List"
 * item in the kitchen sidebar. The same list as the Dashboard, every row.
 *
 * layout.tsx one level up already calls requireStaff("kitchen"); calling
 * it here again is only for the same reason the Live Orders page does —
 * the layout's result isn't passed down to the page.
 */
export default async function KitchenPrepListPage() {
  await requireStaff("kitchen");
  const rows = await getPrepList(new Date());
  const remaining = rows.filter((row) => !row.done).length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="flex w-fit items-center gap-2 font-sora text-[14px] font-medium leading-none text-black/70 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="font-sora text-[22px] font-semibold leading-tight text-black/70 xl:text-[30px]">
          Prep List
        </h1>
        <p className="font-sora text-[14px] leading-[1.7] text-black/70">
          {rows.length === 0
            ? "Built from the open orders and today’s finished ones."
            : `${remaining} of ${rows.length} preparation ${rows.length === 1 ? "task" : "tasks"} still remaining — built from the open orders and today’s finished ones.`}
        </p>
      </div>

      <PrepSnapshot title="Today’s Prep Snapshot" rows={rows} />
    </div>
  );
}
