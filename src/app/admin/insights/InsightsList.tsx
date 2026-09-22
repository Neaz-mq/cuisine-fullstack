"use client";

import { useState } from "react";
import LocalPagination from "@/components/admin/LocalPagination";

/**
 * One paginated list, two looks from the Figma:
 *
 *   variant "bar"  — Top Selling Items / Revenue by Category:
 *                    rank · name · coloured bar (amount inside, white) ·
 *                    optional "N sold" pill
 *   variant "rank" — Slowest / Never Selling Items:
 *                    rank · name ········ "N sold" pill
 *
 * The server does all the maths and hands over plain rows; this component
 * only pages through them. Rank numbers and bar colours follow the row's
 * position in the WHOLE list, so item #9 is still "9" and still blue on
 * page 2.
 */

// Straight from the Figma CSS export, in order.
const BAR_COLORS = [
  "#FF9540",
  "#6DCB66",
  "#AE80FF",
  "#FF80B7",
  "#FF9580",
  "#FFBB80",
  "#D580FF",
  "#80C4FF",
];

// Figma: the empty part of the track is #F9F6F3 with thin white diagonal
// slats (2px wide, rotated). Same gradient the dashboard uses.
const TRACK_STYLE = {
  backgroundColor: "#F9F6F3",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0 2px, transparent 2px 14px)",
};

export interface InsightRow {
  key: string;
  label: string;
  /** Formatted money shown inside the bar ("$250.00"). Bar variant only. */
  amount?: string;
  /** 0–1: how full the bar is. Bar variant only. */
  fraction?: number;
  /** Shown in the "N sold" pill. Leave out to hide the pill. */
  sold?: number;
}

export default function InsightsList({
  rows,
  variant,
  pageSize,
  noun,
  emptyText,
  alwaysShowFooter = false,
}: {
  rows: InsightRow[];
  variant: "bar" | "rank";
  pageSize: number;
  /** Plural word for the footer: "Showing 1-8 of 20 Items". */
  noun: string;
  emptyText: string;
  /** Top Selling / Revenue by Category always show the footer (Figma);
   *  the two small cards only need it when there is more than one page. */
  alwaysShowFooter?: boolean;
}) {
  const [page, setPage] = useState(1);

  // The parent passes a `key` built from the filters, so a new search or
  // period remounts this component and we start again on page 1.
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return <p className="font-sora text-[14px] leading-[1.3] text-black/70">{emptyText}</p>;
  }

  const showFooter = alwaysShowFooter || totalPages > 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Figma: column, gap 16; each row 32px high. */}
      <ol className="flex flex-col gap-4">
        {visible.map((row, index) => {
          const rank = start + index + 1;
          return (
            <li key={row.key} className="flex min-h-8 items-center gap-2 min-[480px]:gap-3 md:gap-5">
              {/* Rank + name. Figma: gap 16, 113px wide, name Sora 14 /
                  130% — long names wrap to two lines on purpose. */}
              <div
                className={`flex min-w-0 items-center gap-2 min-[480px]:gap-4 ${
                  variant === "bar"
                    ? "w-[92px] shrink-0 min-[480px]:w-[113px] lg:w-[140px]"
                    : "flex-1"
                }`}
              >
                <span className="w-4 shrink-0 font-frank-ruhl text-[14px] font-normal leading-none text-black">
                  {rank}
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 break-words font-sora text-[12px] font-normal leading-[1.3] text-black min-[480px]:text-[14px]">
                  {row.label}
                </span>
              </div>

              {variant === "bar" && (
                <div className="h-8 min-w-0 flex-1 overflow-hidden rounded-full" style={TRACK_STYLE}>
                  <div
                    className="flex h-8 min-w-[76px] items-center justify-end rounded-full px-2.5 min-[480px]:min-w-[92px]"
                    style={{
                      width: `${Math.max(0, Math.min(1, row.fraction ?? 0)) * 100}%`,
                      backgroundColor: BAR_COLORS[(rank - 1) % BAR_COLORS.length],
                    }}
                  >
                    <span className="whitespace-nowrap font-frank-ruhl text-[12px] font-medium leading-none text-white min-[480px]:text-[14px]">
                      {row.amount}
                    </span>
                  </div>
                </div>
              )}

              {row.sold !== undefined && (
                /* Figma: 83×32 pill, radius 100, #F9F6F3, Sora 12. */
                <span className="flex h-8 w-[64px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#F9F6F3] font-sora text-[11px] font-normal leading-none text-black min-[480px]:w-[83px] min-[480px]:text-[12px]">
                  {row.sold} sold
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {showFooter && (
        <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          {/* Figma: "● Showing 1-5 of 20 …" — Sora 12, Black/70, the
              numbers in black. */}
          <p className="flex items-center gap-2 font-sora text-[12px] leading-[15px] text-black/70">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
            <span>
              Showing{" "}
              <span className="font-semibold text-black">
                {start + 1}-{start + visible.length}
              </span>{" "}
              of <span className="font-semibold text-black">{rows.length}</span> {noun}
            </span>
          </p>
          {/* ⚠️ Up to 7 buttons × 34px + gaps = ~286px, wider than a card's
              inside at 320px. Below 480px the buttons shrink to 28px with a
              4px gap (~220px), so the row always fits. The shared
              LocalPagination is left untouched — other pages have wider
              cards and don't need this. */}
          <div className="min-w-0 max-[479px]:[&_button]:h-7 max-[479px]:[&_button]:w-7 max-[479px]:[&_nav>span]:h-7 max-[479px]:[&_nav>span]:w-7 max-[479px]:[&_nav]:gap-1">
            <LocalPagination
              currentPage={current}
              totalPages={totalPages}
              onChange={setPage}
              label={`${noun} pages`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
