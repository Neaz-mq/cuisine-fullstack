/**
 * src/lib/rider-stats.ts
 *
 * The numbers on the rider panel (DELIVERY role), as plain functions with
 * no database access so they can be tested on their own. The pages load
 * the rows (lib/rider-panel.ts) and pass them in here.
 *
 * ── What "earnings" means ────────────────────────────────────────────
 * The app has no separate rider-pay table. A rider's earning for one
 * delivery is what the customer paid *for the delivery*:
 *
 *     delivery fee + tip
 *
 * — the same split food-delivery apps show their riders. The food itself
 * (and service charge, tax …) is the restaurant's money and never counts.
 * Cancelled orders earn nothing.
 *
 * "Cash collected" is different: the full amount of every cash-on-delivery
 * order the rider handed over — money the rider is carrying and has to give
 * to the restaurant.
 */

/** Prisma's Decimal (or a plain number in tests). */
export type MoneyLike = number | { toNumber(): number };

const toNumber = (value: MoneyLike) => (typeof value === "number" ? value : value.toNumber());

/** Rounded to cents (or paisa) — sums of many decimals drift otherwise. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One delivery's earning: delivery fee + tip. */
export function deliveryEarning(order: { deliveryFee: MoneyLike; tipAmount: MoneyLike }): number {
  return roundMoney(toNumber(order.deliveryFee) + toNumber(order.tipAmount));
}

export function sumEarnings(orders: { deliveryFee: MoneyLike; tipAmount: MoneyLike }[]): number {
  return roundMoney(orders.reduce((total, order) => total + deliveryEarning(order), 0));
}

/**
 * "+4%" against an earlier figure, rounded to a whole percent. Null when
 * there is nothing to compare with (the earlier figure was 0) — "+∞%"
 * would mean nothing to a rider on their first week.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * How long one delivery took, in minutes: from pick-up (the order leaving
 * the restaurant) to the door. When the pick-up time is missing (orders
 * from before that was recorded) the assignment time stands in.
 */
export function deliveryMinutes(row: {
  pickedUpAt: Date | null;
  assignedAt: Date;
  deliveredAt: Date;
}): number {
  const start = row.pickedUpAt ?? row.assignedAt;
  return Math.max(0, (row.deliveredAt.getTime() - start.getTime()) / 60_000);
}

/** Average delivery time, whole minutes. Null when there are no deliveries. */
export function averageMinutes(
  rows: { pickedUpAt: Date | null; assignedAt: Date; deliveredAt: Date }[]
): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + deliveryMinutes(row), 0);
  return Math.round(total / rows.length);
}

/** Short words under the average-time card. */
export function paceHint(minutes: number | null): string {
  if (minutes === null) return "No deliveries yet";
  if (minutes <= 25) return "Great pace";
  if (minutes <= 40) return "Steady pace";
  return "Longer trips than usual";
}

/** "1h 5m" for long trips, "18 min" otherwise. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

type LatLng = { lat: number; lng: number };

/** Straight-line distance in km ("1.2 km remaining"). */
export function distanceKm(a: LatLng, b: LatLng): number {
  return haversine(a, b);
}

function haversine(a: LatLng, b: LatLng): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Rough minutes from the rider to the customer, for "8 min away". City
 * traffic, so 20 km/h in a straight line — an estimate, never a promise.
 * At least 1 minute.
 */
export function etaMinutes(from: LatLng, to: LatLng, speedKmh = 20): number {
  const km = haversine(from, to);
  return Math.max(1, Math.ceil((km / speedKmh) * 60));
}

/**
 * Where an order is going, short: "Uttara, Dhaka". The street line and the
 * city — the two a rider recognises — without repeats ("Bogura, Bogura").
 */
export function areaLabel(order: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const parts: string[] = [];
  for (const raw of [order.address, order.city, order.state]) {
    const part = raw?.split(",")[0]?.trim();
    if (!part) continue;
    if (parts.some((existing) => existing.toLowerCase() === part.toLowerCase())) continue;
    parts.push(part);
    if (parts.length === 2) break;
  }
  return parts.join(", ") || "Address on the order";
}

/** "1 Item" / "3 Items". */
export function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "Item" : "Items"}`;
}

/** Average star rating to one decimal ("4.9"), or null with no ratings. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10;
}

/**
 * Earnings per day, newest day first — the Payout → Earnings table. `day`
 * is the local calendar date "YYYY-MM-DD" the delivery was completed on.
 */
export function earningsByDay(
  rows: { deliveredAt: Date; deliveryFee: MoneyLike; tipAmount: MoneyLike }[]
): { day: string; deliveries: number; fees: number; tips: number; total: number }[] {
  const days = new Map<string, { deliveries: number; fees: number; tips: number }>();
  for (const row of rows) {
    const date = row.deliveredAt;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const bucket = days.get(key) ?? { deliveries: 0, fees: 0, tips: 0 };
    bucket.deliveries += 1;
    bucket.fees += toNumber(row.deliveryFee);
    bucket.tips += toNumber(row.tipAmount);
    days.set(key, bucket);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, bucket]) => ({
      day,
      deliveries: bucket.deliveries,
      fees: roundMoney(bucket.fees),
      tips: roundMoney(bucket.tips),
      total: roundMoney(bucket.fees + bucket.tips),
    }));
}

/**
 * Earnings chart on the rider Earnings page: one bar per day for the seven
 * days starting at `start` (local midnight), zero on days with nothing
 * delivered — so the chart always has seven columns.
 */
export function sevenDayTotals(
  rows: { deliveredAt: Date; deliveryFee: MoneyLike; tipAmount: MoneyLike }[],
  start: Date
): { date: Date; total: number; deliveries: number }[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return { date, total: 0, deliveries: 0 };
  });
  for (const row of rows) {
    const index = days.findIndex((day, i) => {
      const next = days[i + 1]?.date;
      return row.deliveredAt >= day.date && (!next || row.deliveredAt < next);
    });
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    if (index === -1 || row.deliveredAt >= end) continue;
    days[index].total += toNumber(row.deliveryFee) + toNumber(row.tipAmount);
    days[index].deliveries += 1;
  }
  return days.map((day) => ({ ...day, total: roundMoney(day.total) }));
}
