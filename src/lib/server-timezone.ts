/**
 * src/lib/server-timezone.ts
 *
 * Makes the server's clock run in the restaurant's time zone.
 *
 * ⚠️ Why: Vercel's servers run in UTC. Every date the server formatted
 * without an explicit time zone — the admin Orders list, Kitchen,
 * Payments, Staff, Menu, … about 25 places — came out 6 hours behind
 * Bangladesh time ("9:52 AM" for an order placed at 3:52 PM), while
 * pages formatted in the browser (like /track) were right. Worse, every
 * "Today" filter (`setHours(0,0,0,0)` in dashboard-period.ts and
 * revenue-range.ts) started at UTC midnight = 6:00 AM in Dhaka, so
 * orders between midnight and 6 AM counted as "yesterday".
 *
 * Node re-reads `process.env.TZ` whenever it is assigned, so setting it
 * once fixes all of those at the same time — including any date code
 * written later — instead of patching each call site.
 *
 * Source of truth: the "timezone" in Settings (RestaurantSettings,
 * default "Asia/Dhaka"). instrumentation.ts applies it when a server
 * starts, and getRestaurantSettings() re-applies it every time settings
 * are read, so changing it in Settings takes effect without a redeploy.
 */

/** Used until Settings has been read (and if Settings can't be read). */
export const DEFAULT_TIMEZONE = process.env.RESTAURANT_TIMEZONE?.trim() || "Asia/Dhaka";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function applyServerTimezone(timeZone: string | null | undefined): void {
  const zone = timeZone?.trim();
  if (!zone || process.env.TZ === zone) return;
  if (!isValidTimeZone(zone)) {
    console.warn(`[timezone] "${zone}" is not a valid time zone — keeping ${process.env.TZ ?? "UTC"}.`);
    return;
  }
  process.env.TZ = zone;
}
