"use client";

import { useState } from "react";

/**
 * Earnings page → "Total Earning" chart (Figma): seven hatched pill bars.
 *
 *   ░░ grey pill above the dashed line   the same weekday one week earlier
 *   ▓▓ orange pill below the line        the week being looked at
 *
 * Hover (or keyboard focus) on a day shows the black tooltip with its date
 * and earning; the day starts on today (or the week's last day), which is
 * the column Figma draws highlighted. Plain CSS — no chart library.
 */
export type ChartDay = {
  /** "Sat" */
  day: string;
  /** "Sep 23, 2026" */
  date: string;
  value: number;
  valueText: string;
  deliveries: number;
  previous: number;
  previousText: string;
};

const TOP = 64; // grey zone height (px)
const BOTTOM = 92; // orange zone height (px)
const MIN = 14; // a zero day still shows a small pill

const ORANGE =
  "bg-[repeating-linear-gradient(135deg,#F59A4E_0px,#F59A4E_4px,#F8B274_4px,#F8B274_7px)]";
const GREY =
  "bg-[repeating-linear-gradient(135deg,#F3EFEB_0px,#F3EFEB_4px,#FBF9F7_4px,#FBF9F7_7px)]";

export default function EarningsChart({
  days,
  initialIndex,
  currentLabel,
  previousLabel,
}: {
  days: ChartDay[];
  initialIndex: number;
  currentLabel: string;
  previousLabel: string;
}) {
  const [active, setActive] = useState(initialIndex);
  const max = Math.max(1, ...days.map((d) => Math.max(d.value, d.previous)));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative" onMouseLeave={() => setActive(initialIndex)}>
        {/* dashed baseline between the two weeks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-black/15"
          style={{ top: TOP + 4 }}
        />
        <ul className="grid grid-cols-7 gap-1.5 min-[480px]:gap-3">
          {days.map((d, index) => {
            const isActive = index === active;
            const top = d.previous > 0 ? Math.max(MIN, (d.previous / max) * TOP) : MIN;
            const bottom = d.value > 0 ? Math.max(MIN, (d.value / max) * BOTTOM) : MIN;
            // Tooltip anchored so it never leaves the card on the edges.
            const align = index <= 1 ? "left-0" : index >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <li key={d.date} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-label={`${d.date}: ${d.valueText} from ${d.deliveries} ${d.deliveries === 1 ? "delivery" : "deliveries"}; ${previousLabel.toLowerCase()} ${d.previousText}`}
                  className="flex w-full flex-col items-center rounded-[12px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                >
                  <span className="flex w-full items-end justify-center" style={{ height: TOP }}>
                    <span
                      className={`block w-full max-w-[42px] rounded-full ${GREY} ${d.previous > 0 ? "" : "opacity-60"}`}
                      style={{ height: top }}
                    />
                  </span>
                  <span className="h-2" />
                  <span className="flex w-full items-start justify-center" style={{ height: BOTTOM }}>
                    <span
                      className={`relative block w-full max-w-[42px] rounded-full ${ORANGE} ${d.value > 0 ? "" : "opacity-40"} ${
                        isActive ? "ring-2 ring-[#FF7100]/25" : ""
                      }`}
                      style={{ height: bottom }}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white"
                        />
                      )}
                    </span>
                  </span>
                </button>

                <span
                  className={`mt-3 font-sora text-[11px] leading-none min-[480px]:text-[12px] ${
                    isActive ? "font-semibold text-black" : "text-black/70"
                  }`}
                >
                  {d.day}
                </span>

                {isActive && (
                  <span
                    role="status"
                    className={`pointer-events-none absolute top-0 z-10 flex w-max flex-col gap-1.5 rounded-[8px] bg-black p-1.5 font-sora text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${align}`}
                  >
                    <span className="w-max rounded-full bg-white px-2 py-0.5 text-[9px] leading-[1.4] text-black">{d.date}</span>
                    <span className="flex items-center gap-3 px-1 text-[10px] leading-none">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FF3F5C]" aria-hidden="true" />
                        Earning
                      </span>
                      <span className="font-semibold">{d.valueText}</span>
                    </span>
                    <span className="px-1 pb-0.5 text-[9px] leading-none text-white/65">
                      {d.deliveries} {d.deliveries === 1 ? "delivery" : "deliveries"}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-sora text-[12px] leading-none text-black/70">
        <span className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${ORANGE}`} aria-hidden="true" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full border border-black/10 ${GREY}`} aria-hidden="true" />
          {previousLabel}
        </span>
      </div>
    </div>
  );
}
