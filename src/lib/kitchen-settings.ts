/**
 * src/lib/kitchen-settings.ts
 *
 * Kitchen panel → Settings (Figma "Settings" + "Notifications" cards).
 * Plain values only — no database code — so the page, the client form, the
 * API and the export route all share one definition.
 *
 * These five values live on the restaurant's single RestaurantSettings row,
 * the same columns the owner edits in Admin → Settings, so a change here is
 * a real change for the whole restaurant:
 *
 *   Restaurant Time zone   what "today", the kitchen hours and every time on
 *                          the Live Orders board are measured in
 *   Kitchen Opens/Closes   when the kitchen takes orders (landing page,
 *                          menu and reservation form read these)
 *   Low Stock Alerts       a notification when an ingredient reaches its
 *                          reorder threshold (kitchen + admin feeds)
 *   Emergency Stock Alerts a notification when it reaches its emergency level
 *
 * ⚠️ Nothing else from RestaurantSettings (tax, currency, delivery fee,
 * tipping, deposits) is reachable from the kitchen panel — see the API route.
 */

export type KitchenSettings = {
  timezone: string;
  kitchenOpenHour: number;
  kitchenCloseHour: number;
  lowStockAlerts: boolean;
  emergencyStockAlerts: boolean;
};

/** Same list the owner's Settings page offers, so both screens agree. */
export const KITCHEN_TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Malta",
  "Europe/Berlin",
  "Europe/Rome",
  "Asia/Tokyo",
  "America/New_York",
  "America/Los_Angeles",
] as const;

/** "10:00 AM", "12:00 PM", "12:00 AM" — Figma's format. */
export function formatKitchenHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export const KITCHEN_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: formatKitchenHour(hour),
}));

/**
 * The time-zone dropdown's options. The restaurant's current zone is always
 * included, even when the owner chose one outside the list above — otherwise
 * the dropdown would silently show the first entry instead of what is
 * actually saved, and "Save Change" would overwrite it with Asia/Dhaka.
 */
export function timezoneOptions(current: string): { value: string; label: string }[] {
  const zones: string[] = [...KITCHEN_TIMEZONES];
  if (current && !zones.includes(current)) zones.unshift(current);
  return zones.map((zone) => ({ value: zone, label: zone }));
}

/** true when the browser/Node knows this IANA zone name. */
export function isValidTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The one rule the form and the API share. null = fine. */
export function kitchenHoursError(openHour: number, closeHour: number): string | null {
  return openHour === closeHour ? "Kitchen open and close time can't be the same" : null;
}

/** Rows of the "Export Report" CSV — one line per setting, as shown on screen. */
export function kitchenSettingsRows(settings: KitchenSettings): [string, string][] {
  return [
    ["Restaurant Time zone", settings.timezone],
    ["Kitchen Opens", formatKitchenHour(settings.kitchenOpenHour)],
    ["Kitchen Closes", formatKitchenHour(settings.kitchenCloseHour)],
    ["Low Stock Alerts", settings.lowStockAlerts ? "On" : "Off"],
    ["Emergency Stock Alerts", settings.emergencyStockAlerts ? "On" : "Off"],
  ];
}
