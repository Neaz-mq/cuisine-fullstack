/**
 * src/lib/kitchen-dashboard.ts
 *
 * The numbers behind the KITCHEN role's Dashboard (Figma "Welcome Back"
 * screen). Pure functions only — no Prisma, no React — so every rule here
 * is unit-tested (lib/__tests__/kitchen-dashboard.test.ts) and the loader
 * (kitchen-dashboard-data.ts) stays a thin "fetch rows, call these" layer.
 */
import { BASE_PREP_MINUTES } from "@/lib/kitchen-eta";
import { formatQuantity, stockStateOf } from "@/lib/inventory-status";

/** A PLACED order older than this is "waiting — needs attention". */
export const WAITING_ATTENTION_MINUTES = 10;

/** Same window the Live Orders board keeps finished orders in its Ready column. */
export const READY_WINDOW_MINUTES = 15;

/** Avg. Prep Time is measured over the last 7 days (today alone is too jumpy). */
export const PREP_TIME_WINDOW_DAYS = 7;

/** "Target: 15 min" — the same base prep time the customer-facing ETA uses. */
export const PREP_TARGET_MINUTES = BASE_PREP_MINUTES;

/** Prep durations outside (0, 4h] are bad data (a forgotten order), not cooking time. */
const MAX_PLAUSIBLE_PREP_MINUTES = 240;

/** Week-on-week change in whole percent, or null when last week had nothing to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Mean of (dispatchedAt − preparingAt) in whole minutes, or null if no usable order. */
export function averagePrepMinutes(
  rows: { preparingAt: Date | null; dispatchedAt: Date | null }[]
): number | null {
  const minutes: number[] = [];
  for (const row of rows) {
    if (!row.preparingAt || !row.dispatchedAt) continue;
    const diff = (row.dispatchedAt.getTime() - row.preparingAt.getTime()) / 60000;
    if (diff > 0 && diff <= MAX_PLAUSIBLE_PREP_MINUTES) minutes.push(diff);
  }
  if (minutes.length === 0) return null;
  return Math.round(minutes.reduce((sum, m) => sum + m, 0) / minutes.length);
}

/* ── Inventory glance ─────────────────────────────────────────────── */

export type InventoryGlanceItem = {
  id: string;
  name: string;
  currentStock: number;
  reorderThreshold: number;
  emergencyThreshold: number;
};

export type InventoryGlance = {
  /** Low stock + emergency + out of stock. */
  attention: number;
  /** Emergency + out of stock — same set as /admin/inventory/emergency. */
  urgent: number;
  /** The urgent items, emptiest first. */
  urgentItems: { id: string; name: string }[];
};

export function summarizeInventory(items: InventoryGlanceItem[]): InventoryGlance {
  const states = items.map((item) => ({ item, state: stockStateOf(item) }));
  const urgent = states
    .filter(({ state }) => state === "emergency" || state === "out")
    .sort((a, b) => a.item.currentStock - b.item.currentStock);
  return {
    attention: states.filter(({ state }) => state !== "in-stock").length,
    urgent: urgent.length,
    urgentItems: urgent.map(({ item }) => ({ id: item.id, name: item.name })),
  };
}

/* ── Today's Prep Snapshot ────────────────────────────────────────── */

export type PrepOrder = {
  status: string;
  items: {
    quantity: number;
    menuItem: {
      ingredients: {
        quantityRequired: number;
        inventoryItem: { id: string; name: string; unit: string };
      }[];
    };
  }[];
};

export type PrepRow = {
  id: string;
  /** "Prepare Chicken Breast" */
  label: string;
  /** "12 Kg" */
  quantityLabel: string;
  done: boolean;
  /**
   * Set only on a hand-added task (PrepTask.id). Rows derived from orders
   * have none — their "done" follows the orders and cannot be ticked by
   * hand, while a task row can be ticked, unticked and deleted.
   */
  taskId?: string;
};

/**
 * One row per ingredient the live orders need.
 *
 * There is no separate prep-task table, so the list is derived from what
 * the kitchen actually has to cook: for every open order (and today's
 * finished ones) each dish's recipe × quantity, summed per ingredient.
 *
 * A row is done once NO order that needs the ingredient is still PLACED —
 * i.e. every one of them has been started (PREPARING) or finished. Open
 * rows come first (most still to do first), done rows after.
 */
export function buildPrepSnapshot(orders: PrepOrder[]): PrepRow[] {
  const byIngredient = new Map<
    string,
    { name: string; unit: string; total: number; remaining: number }
  >();

  for (const order of orders) {
    const waiting = order.status === "PLACED";
    for (const line of order.items) {
      for (const ing of line.menuItem.ingredients) {
        const amount = ing.quantityRequired * line.quantity;
        if (!(amount > 0)) continue;
        const entry = byIngredient.get(ing.inventoryItem.id) ?? {
          name: ing.inventoryItem.name,
          unit: ing.inventoryItem.unit,
          total: 0,
          remaining: 0,
        };
        entry.total += amount;
        if (waiting) entry.remaining += amount;
        byIngredient.set(ing.inventoryItem.id, entry);
      }
    }
  }

  const rows = [...byIngredient.entries()].map(([id, entry]) => ({
    id,
    name: entry.name,
    remaining: entry.remaining,
    row: {
      id,
      label: `Prepare ${entry.name}`,
      quantityLabel: formatQuantity(Math.round(entry.total * 100) / 100, entry.unit),
      done: entry.remaining <= 0,
    } satisfies PrepRow,
  }));

  rows.sort((a, b) => {
    if (a.row.done !== b.row.done) return a.row.done ? 1 : -1;
    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
    return a.name.localeCompare(b.name);
  });

  return rows.map((entry) => entry.row);
}

/** A hand-added task as stored (PrepTask) — only the columns the list needs. */
export type PrepTaskRecord = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  done: boolean;
};

export function prepTaskToRow(task: PrepTaskRecord): PrepRow {
  return {
    id: `task-${task.id}`,
    taskId: task.id,
    label: task.name,
    quantityLabel: formatQuantity(task.quantity, task.unit),
    done: task.done,
  };
}

/**
 * Hand-added tasks + order-derived rows as ONE list: everything still open
 * first (the cook's own tasks above the computed ones — they typed them
 * for a reason), everything done after. Order inside each group is kept.
 */
export function mergePrepRows(orderRows: PrepRow[], taskRows: PrepRow[]): PrepRow[] {
  const all = [...taskRows, ...orderRows];
  return [...all.filter((row) => !row.done), ...all.filter((row) => row.done)];
}

export const PREP_STATUSES = ["all", "pending", "completed"] as const;
export type PrepStatusFilter = (typeof PREP_STATUSES)[number];
export const DEFAULT_PREP_STATUS: PrepStatusFilter = "all";

export function isPrepStatusFilter(value: unknown): value is PrepStatusFilter {
  return typeof value === "string" && (PREP_STATUSES as readonly string[]).includes(value);
}

/** Search by item name (case-insensitive) + Pending / Completed filter. */
export function filterPrepRows(
  rows: PrepRow[],
  { q, status }: { q?: string; status: PrepStatusFilter }
): PrepRow[] {
  const needle = q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (status === "pending" && row.done) return false;
    if (status === "completed" && !row.done) return false;
    return !needle || row.label.toLowerCase().includes(needle);
  });
}

/** Total / completed / remaining + whole-percent done, from two counts. */
export function summarizePrepCounts(total: number, completed: number) {
  return {
    total,
    completed,
    remaining: total - completed,
    percentDone: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function summarizePrep(rows: { done: boolean }[]) {
  return summarizePrepCounts(rows.length, rows.filter((row) => row.done).length);
}

/* ── Wording ──────────────────────────────────────────────────────── */

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** "Chicken Breast", "A and B", "A, B and 3 more". */
export function joinNames(names: string[], max = 2): string {
  if (names.length <= max) return names.join(" and ");
  const shown = names.slice(0, max).join(", ");
  return `${shown} and ${names.length - max} more`;
}
