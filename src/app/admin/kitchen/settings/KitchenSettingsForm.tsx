"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "react-toastify";
import { SelectField } from "@/components/admin/modal-ui";
import { GRADIENT_BG } from "@/app/admin/my-deliveries/rider-ui";
import {
  KITCHEN_HOUR_OPTIONS,
  kitchenHoursError,
  timezoneOptions,
  type KitchenSettings,
} from "@/lib/kitchen-settings";

/**
 * Kitchen panel → Settings, everything below the "Welcome Back" header
 * (Figma frame 1059 wide, gap 24):
 *
 *   search pill (white, 50)  ·  "Save Change" (gradient pill, 50)
 *   Settings card            white, radius 20, padding 30, title 30
 *   Notifications card       white, radius 30, padding 30, title 36
 *
 * Every control really changes something — PATCH /api/admin/kitchen/settings
 * writes the restaurant's RestaurantSettings row (lib/kitchen-settings.ts
 * lists what each value drives).
 *
 * The search box filters what is on this page: type "close", "stock" or
 * "time zone" and only the matching rows stay. A card's own title ("Settings",
 * "Notifications") keeps all of its rows.
 */

const CARD_PADDING = "p-4 min-[480px]:p-5 md:p-[30px]";
const SEARCH_INPUT =
  "h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";
const SAVE_BUTTON = `inline-flex h-[50px] w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full ${GRADIENT_BG} px-4 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[560px]:w-auto`;

/** What the search looks at: the visible label plus a few words people try. */
const SETTINGS_CARD_TITLE = "Settings";
const NOTIFICATIONS_CARD_TITLE = "Notifications";

const FIELD_SEARCH = {
  timezone: "Restaurant Time zone timezone region clock",
  opens: "Kitchen Opens open opening hours start time",
  closes: "Kitchen Closes close closing hours end time",
} as const;

const ALERTS = {
  low: {
    id: "kitchen-low-stock-alerts",
    title: "Low Stock Alerts",
    description: "Notify when an ingredient crosses its low threshold",
  },
  emergency: {
    id: "kitchen-emergency-stock-alerts",
    title: "Emergency Stock Alerts",
    description: "Notify instantly when an item hits emergency level",
  },
} as const;

/** Every word typed must appear somewhere in the text. Empty search = match. */
function matches(query: string, text: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export default function KitchenSettingsForm({ initial }: { initial: KitchenSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const dirty = (Object.keys(values) as (keyof KitchenSettings)[]).some((key) => values[key] !== saved[key]);

  const change = (next: Partial<KitchenSettings>) => {
    setValues((prev) => ({ ...prev, ...next }));
    setError("");
  };

  const save = async () => {
    if (!dirty) {
      toast.info("No changes to save");
      return;
    }
    const hoursError = kitchenHoursError(values.kitchenOpenHour, values.kitchenCloseHour);
    if (hoursError) {
      setError(hoursError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/kitchen/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save your settings.");
        return;
      }
      setSaved(values);
      toast.success("Settings saved");
      // The sidebar badge, the bell and the Live Orders clock all read these.
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // --- search -------------------------------------------------------------
  const settingsCardMatches = matches(query, SETTINGS_CARD_TITLE);
  const showTimezone = settingsCardMatches || matches(query, FIELD_SEARCH.timezone);
  const showOpens = settingsCardMatches || matches(query, FIELD_SEARCH.opens);
  const showCloses = settingsCardMatches || matches(query, FIELD_SEARCH.closes);
  const showSettingsCard = showTimezone || showOpens || showCloses;

  const notificationsCardMatches = matches(query, NOTIFICATIONS_CARD_TITLE);
  const showLow =
    notificationsCardMatches || matches(query, `${ALERTS.low.title} ${ALERTS.low.description}`);
  const showEmergency =
    notificationsCardMatches || matches(query, `${ALERTS.emergency.title} ${ALERTS.emergency.description}`);
  const showNotificationsCard = showLow || showEmergency;

  const nothingFound = !showSettingsCard && !showNotificationsCard;

  return (
    <>
      {/* --- search + Save Change (Figma Frame 2147236295) --- */}
      <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-start min-[560px]:gap-6">
        <div className="relative h-[50px] min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className={SEARCH_INPUT}
          />
        </div>

        <button type="button" onClick={save} disabled={saving} className={SAVE_BUTTON}>
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Save Change"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
          {error}
        </p>
      )}

      {/* --- Settings card (Figma Frame 2147236294) --- */}
      {showSettingsCard && (
        <section
          aria-labelledby="kitchen-settings-title"
          className={`flex flex-col gap-6 rounded-[20px] bg-white ${CARD_PADDING}`}
        >
          <h2
            id="kitchen-settings-title"
            className="font-frank-ruhl text-[24px] font-semibold leading-none text-black min-[480px]:text-[26px] md:text-[30px]"
          >
            {SETTINGS_CARD_TITLE}
          </h2>

          <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[640px]:grid-cols-2">
            {showTimezone && (
              <SelectField
                id="kitchen-timezone"
                label="Restaurant Time zone"
                value={values.timezone}
                onChange={(value) => change({ timezone: value })}
                options={timezoneOptions(saved.timezone)}
                className="min-w-0 min-[640px]:col-span-2"
              />
            )}
            {showOpens && (
              <SelectField
                id="kitchen-opens"
                label="Kitchen Opens"
                value={String(values.kitchenOpenHour)}
                onChange={(value) => change({ kitchenOpenHour: Number.parseInt(value, 10) })}
                options={KITCHEN_HOUR_OPTIONS}
                className="min-w-0"
              />
            )}
            {showCloses && (
              <SelectField
                id="kitchen-closes"
                label="Kitchen Closes"
                value={String(values.kitchenCloseHour)}
                onChange={(value) => change({ kitchenCloseHour: Number.parseInt(value, 10) })}
                options={KITCHEN_HOUR_OPTIONS}
                className="min-w-0"
              />
            )}
          </div>
        </section>
      )}

      {/* --- Notifications card (Figma Frame 2147236234) --- */}
      {showNotificationsCard && (
        <section
          aria-labelledby="kitchen-notifications-title"
          className={`flex flex-col gap-6 rounded-[20px] bg-white ${CARD_PADDING} md:rounded-[30px]`}
        >
          <h2
            id="kitchen-notifications-title"
            className="font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[32px] xl:text-[36px]"
          >
            {NOTIFICATIONS_CARD_TITLE}
          </h2>

          <div className="flex flex-col gap-4">
            {showLow && (
              <ToggleRow
                id={ALERTS.low.id}
                title={ALERTS.low.title}
                description={ALERTS.low.description}
                checked={values.lowStockAlerts}
                onChange={(value) => change({ lowStockAlerts: value })}
              />
            )}
            {showEmergency && (
              <ToggleRow
                id={ALERTS.emergency.id}
                title={ALERTS.emergency.title}
                description={ALERTS.emergency.description}
                checked={values.emergencyStockAlerts}
                onChange={(value) => change({ emergencyStockAlerts: value })}
              />
            )}
          </div>
        </section>
      )}

      {nothingFound && (
        <p
          role="status"
          className="rounded-[20px] bg-white px-6 py-10 text-center font-sora text-[14px] text-black/60"
        >
          Nothing matches “{query.trim()}”.
        </p>
      )}
    </>
  );
}

/**
 * Figma notification row (Frame 2147236375): cream #F9F6F3, radius 20,
 * padding 20/30; Frank Ruhl 20/600 title over a Sora 12 description
 * (black 70%); a 62×36 orange switch with a 24px white knob.
 *
 * ⚠️ A <button role="switch">, not a checkbox: the pill can't be drawn on a
 * native checkbox, and aria-checked tells a screen reader the same thing.
 * "Off" keeps the knob on the left (Figma draws it on the right in both
 * states, but then colour would be the only signal — useless to someone who
 * can't tell orange from pale orange).
 */
function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-4 min-[480px]:px-[30px] min-[480px]:py-5">
      <div className="flex min-w-0 flex-col gap-2.5">
        <span
          id={`${id}-label`}
          className="font-frank-ruhl text-[18px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[20px]"
        >
          {title}
        </span>
        <span id={`${id}-desc`} className="font-sora text-[12px] leading-[1.14] tracking-[-0.01em] text-black/70">
          {description}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative h-9 w-[62px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
          checked ? "bg-[#FF9540]" : "bg-[rgba(255,149,64,0.35)]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ${
            checked ? "left-8" : "left-1.5"
          }`}
        />
      </button>
    </div>
  );
}
