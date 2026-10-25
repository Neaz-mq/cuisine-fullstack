"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Trash2 } from "lucide-react";
import type { PrepRow } from "@/lib/kitchen-dashboard";

/**
 * src/app/admin/kitchen/prep/PrepTaskList.tsx
 *
 * Figma frame 2147236256 — "Today's Prep Snapshot": white card, title,
 * one cream 66px row per task (white 40px circle with a tick · task ·
 * quantity). Done = filled tick, struck-through Black/60 label.
 *
 * Two kinds of row (PrepRow.taskId tells them apart):
 *  • a task someone ADDED — the tick is a button (done ↔ not done, saved
 *    through PATCH /api/admin/kitchen/prep-tasks/:id), and a small bin
 *    removes a task added by mistake;
 *  • a row COMPUTED from the live orders — its tick is display only,
 *    because it turns done by itself once the orders using that ingredient
 *    are started. A button there would be a lie that the next refresh
 *    undoes.
 */
export default function PrepTaskList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: PrepRow[];
  emptyText: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Ticks shown immediately, before the server round-trip finishes.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function settle(taskId: string) {
    // refresh first, then drop the local override once fresh rows arrive.
    startTransition(() => {
      router.refresh();
    });
    setBusy((prev) => ({ ...prev, [taskId]: false }));
  }

  async function request(taskId: string, init: RequestInit) {
    setError(null);
    setBusy((prev) => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`/api/admin/kitchen/prep-tasks/${taskId}`, init);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      return false;
    }
  }

  async function toggle(row: PrepRow) {
    const taskId = row.taskId;
    if (!taskId || busy[taskId]) return;
    const next = !(optimistic[taskId] ?? row.done);
    setOptimistic((prev) => ({ ...prev, [taskId]: next }));

    const ok = await request(taskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!ok) setOptimistic((prev) => ({ ...prev, [taskId]: !next }));
    settle(taskId);
  }

  async function remove(row: PrepRow) {
    const taskId = row.taskId;
    if (!taskId || busy[taskId]) return;
    if (!window.confirm(`Delete “${row.label}”?`)) return;
    await request(taskId, { method: "DELETE" });
    settle(taskId);
  }

  return (
    <section className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:rounded-[30px] md:p-[30px]">
      <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
        {title}
      </h2>

      {error && (
        <p
          role="alert"
          className="rounded-[12px] bg-red-50 px-3 py-2.5 font-sora text-[12px] leading-[1.6] text-red-600"
        >
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="font-sora text-[14px] leading-[1.7] text-black/70">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const taskId = row.taskId;
            const done = taskId ? (optimistic[taskId] ?? row.done) : row.done;
            const tick = (
              <CircleCheck
                className={`h-[18px] w-[18px] ${done ? "fill-black text-white" : "text-black"}`}
                strokeWidth={1.2}
                aria-hidden="true"
              />
            );

            return (
              <li
                key={row.id}
                className="group flex min-h-[66px] items-center justify-between gap-6 rounded-[16px] bg-[#F9F6F3] px-3 py-[13px]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {taskId ? (
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={busy[taskId]}
                      aria-pressed={done}
                      aria-label={done ? `Mark “${row.label}” as not done` : `Mark “${row.label}” as done`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white transition-transform hover:scale-105 disabled:opacity-60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                    >
                      {tick}
                    </button>
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white"
                      title="Updates automatically when the orders using it are started"
                    >
                      {tick}
                    </span>
                  )}
                  <span
                    className={`truncate font-sora text-[14px] leading-[1.3] ${
                      done ? "text-black/60 line-through" : "text-black"
                    }`}
                  >
                    {row.label}
                  </span>
                  {done && <span className="sr-only">(done)</span>}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-sora text-[14px] leading-[1.3] text-black">
                    {row.quantityLabel}
                  </span>
                  {taskId && (
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busy[taskId]}
                      aria-label={`Delete “${row.label}”`}
                      // Not in the Figma: a task typed by mistake needs a way
                      // out. Quiet until hover/focus so the rows still match.
                      className="flex h-8 w-8 items-center justify-center rounded-full text-black/50 opacity-100 transition hover:bg-white hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
