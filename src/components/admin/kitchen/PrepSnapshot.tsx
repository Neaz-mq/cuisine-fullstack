import Link from "next/link";
import { CircleCheck } from "lucide-react";
import type { PrepRow } from "@/lib/kitchen-dashboard";

/**
 * src/components/admin/kitchen/PrepSnapshot.tsx
 *
 * Figma frame 2147236256 — "Today's Prep Snapshot": a white card, a title
 * (with "View All" on the right), then one cream row per prep task: a
 * white circle with a tick, the task, and the quantity on the right. Done
 * tasks get a filled tick and a struck-through, greyed label.
 *
 * Used twice: on the Dashboard (first few rows + "View All") and on the
 * Prep List page (every row, no link).
 */
export default function PrepSnapshot({
  title,
  rows,
  limit,
  viewAllHref,
  emptyText = "Nothing to prepare yet — new orders will show up here.",
}: {
  title: string;
  rows: PrepRow[];
  /** Show only the first `limit` rows. */
  limit?: number;
  /** Renders the "View All" link — only when there is more to see. */
  viewAllHref?: string;
  emptyText?: string;
}) {
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  const hasMore = rows.length > shown.length;

  return (
    <section className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:rounded-[30px] md:p-[30px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          {title}
        </h2>
        {viewAllHref && hasMore && (
          <Link
            href={viewAllHref}
            className="shrink-0 font-sora text-[14px] font-normal leading-none text-black/70 transition-colors hover:text-black"
          >
            View All
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="font-sora text-[14px] leading-[1.7] text-black/70">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((row) => (
            <li
              key={row.id}
              className="flex min-h-[66px] items-center justify-between gap-6 rounded-[16px] bg-[#F9F6F3] px-3 py-[13px]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <CircleCheck
                    className={`h-[18px] w-[18px] ${row.done ? "fill-black text-white" : "text-black"}`}
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={`truncate font-sora text-[14px] leading-[1.3] ${
                    row.done ? "text-black/60 line-through" : "text-black"
                  }`}
                >
                  {row.label}
                </span>
                {row.done && <span className="sr-only">(done)</span>}
              </div>
              <span className="shrink-0 font-sora text-[14px] leading-[1.3] text-black">
                {row.quantityLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
