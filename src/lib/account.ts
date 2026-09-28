/**
 * src/lib/account.ts
 *
 * Small, pure helpers for the customer panel (/account). No database
 * access here, so the client components can import them too and the
 * rules are unit-tested (lib/__tests__/account.test.ts).
 */

export type OrderStatusValue = "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export type OrderTypeValue = "DELIVERY" | "DINE_IN";

/** Orders the customer is still waiting for — shown as "live" cards. */
export const ACTIVE_ORDER_STATUSES: OrderStatusValue[] = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"];

export function isActiveOrder(status: string): boolean {
  return (ACTIVE_ORDER_STATUSES as string[]).includes(status);
}

/**
 * The four steps shown on a live order card, in the customer's words.
 * A dine-in order is never "on the way" — it's brought to the table.
 */
export function orderSteps(orderType: OrderTypeValue): string[] {
  return orderType === "DINE_IN"
    ? ["Placed", "Preparing", "Ready to serve", "Served"]
    : ["Placed", "Preparing", "On the way", "Delivered"];
}

/** 0-based index of the step the order is on; -1 for a cancelled order. */
export function orderStepIndex(status: string): number {
  switch (status) {
    case "PLACED":
      return 0;
    case "PREPARING":
      return 1;
    case "OUT_FOR_DELIVERY":
      return 2;
    case "DELIVERED":
      return 3;
    default:
      return -1;
  }
}

/** The "My Orders" tabs. */
export type OrdersTab = "all" | "active" | "completed" | "cancelled";

export const ORDERS_TABS: { value: OrdersTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function parseOrdersTab(value: string | undefined): OrdersTab {
  return ORDERS_TABS.some((tab) => tab.value === value) ? (value as OrdersTab) : "all";
}

/** Which statuses each tab shows (undefined = every status). */
export function statusesForTab(tab: OrdersTab): OrderStatusValue[] | undefined {
  switch (tab) {
    case "active":
      return ACTIVE_ORDER_STATUSES;
    case "completed":
      return ["DELIVERED"];
    case "cancelled":
      return ["CANCELLED"];
    default:
      return undefined;
  }
}

/**
 * "Your favourites" — the dishes this customer orders most, from their own
 * order history (no extra table, nothing to keep in sync). Cancelled
 * orders don't count: an order they didn't get isn't a favourite.
 * Ties go to the dish ordered most recently.
 */
export function topDishes(
  lines: { menuItemId: string; quantity: number; orderedAt: Date; orderStatus: string }[],
  limit = 4
): { menuItemId: string; timesOrdered: number }[] {
  const byDish = new Map<string, { count: number; last: number }>();
  for (const line of lines) {
    if (line.orderStatus === "CANCELLED") continue;
    const entry = byDish.get(line.menuItemId) ?? { count: 0, last: 0 };
    entry.count += line.quantity;
    entry.last = Math.max(entry.last, line.orderedAt.getTime());
    byDish.set(line.menuItemId, entry);
  }
  return [...byDish.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([menuItemId, entry]) => ({ menuItemId, timesOrdered: entry.count }));
}

/** "Good morning" / "Good afternoon" / "Good evening" in the restaurant's timezone. */
export function greetingFor(date: Date, timeZone: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date),
    10
  );
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First name for greetings — "Md. Neaz Morshed" → "Neaz" (skips "Md."/"Mr." style prefixes). */
export function firstNameOf(name: string | null | undefined, email?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const PREFIXES = /^(md\.?|mohd\.?|mr\.?|mrs\.?|ms\.?|dr\.?|sheikh|sk\.?)$/i;
  const first = parts.find((part) => !PREFIXES.test(part)) ?? parts[0];
  if (first) return first;
  return email?.split("@")[0] ?? "there";
}

/**
 * Figma "Target Progress" — how close the customer is to the next loyalty
 * level, as "points / points needed" (the Figma mock shows money; this
 * restaurant's levels are reached with points, so points it is).
 *
 * `percent` is of the whole target (10 of 80 → 13%), which reads naturally
 * next to "10 / 80". At the top level there's no next target: 100%.
 */
export function targetProgress(
  points: number,
  tiers: { label: string; minPoints: number; discountPercent: number; pointsMultiplier: number }[]
): {
  target: number | null;
  percent: number;
  nextLabel: string | null;
  reward: string | null;
} {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const next = sorted.find((tier) => tier.minPoints > points) ?? null;
  if (!next) return { target: null, percent: 100, nextLabel: null, reward: null };

  const perks: string[] = [];
  if (next.discountPercent > 0) perks.push(`${next.discountPercent}% off every order`);
  const bonus = Math.round((next.pointsMultiplier - 1) * 100);
  if (bonus > 0) perks.push(`${bonus}% bonus points`);

  return {
    target: next.minPoints,
    percent: Math.min(100, Math.max(0, Math.floor((points / next.minPoints) * 100))),
    nextLabel: next.label,
    reward: perks.length ? perks.join(" + ") : null,
  };
}

/**
 * Page buttons like Figma: 1 2 3 … 6 — first, last, and the pages around
 * the current one; `null` is a "…" gap.
 */
export function pageList(current: number, total: number): (number | null)[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 1, total - 2].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push(null);
    out.push(page);
  });
  return out;
}

/**
 * "Last password change" on Change Password: "today", "3 days ago",
 * "3 months ago", "2 years ago". Rounded down, like people say it.
 */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.floor(days / 7), "week");
  if (days < 365) return plural(Math.max(1, Math.floor(days / 30)), "month");
  return plural(Math.floor(days / 365), "year");
}
