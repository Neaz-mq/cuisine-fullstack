"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";
import { SelectField } from "@/components/admin/modal-ui";
import { ORDER_TYPE_OPTIONS, RADIUS_OPTIONS, type RiderPreferences } from "@/lib/rider-preferences";
import { GRADIENT_BG, RiderPageHeader } from "../rider-ui";

/**
 * Rider panel → Settings, top half (Figma "Delivery Preferences" +
 * "Notifications"). Every choice here really changes something:
 *
 *   Max Delivery Radius    Available Orders, the dashboard count and the
 *                          "order waiting" alerts only show orders whose
 *                          drop-off is this close to the kitchen
 *   Order Types Accepted   "online-paid only" hides cash-on-delivery orders
 *   New Order Alerts       waiting orders in Notification + the badge
 *   Earnings Summary       a daily email after days with deliveries
 *
 * "Save Change" (header, like Figma, and under the cards) saves them all:
 * PATCH /api/rider/preferences. Password and two-step sign-in follow
 * below, as before.
 */

const CARD = "flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]";
const CARD_TITLE =
  "font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[32px] xl:text-[36px]";
const PRIMARY = `inline-flex h-[45px] items-center justify-center gap-2 whitespace-nowrap rounded-full ${GRADIENT_BG} px-4 font-sora text-[14px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:text-[16px]`;
const OUTLINE =
  "inline-flex h-[45px] items-center justify-center whitespace-nowrap rounded-[90px] border border-black px-4 font-sora text-[14px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:opacity-50 min-[480px]:text-[16px]";
const HINT = "font-sora text-[11px] leading-[1.5] text-black/50";

export default function RiderPreferencesForm({
  initial,
  name,
  nowIso,
}: {
  initial: RiderPreferences;
  name: string;
  nowIso: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = (Object.keys(prefs) as (keyof RiderPreferences)[]).some((key) => prefs[key] !== saved[key]);
  const change = (next: Partial<RiderPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...next }));
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rider/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save your settings.");
        return;
      }
      setSaved(prefs);
      toast.success("Your settings are saved");
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const actions = (withIcon: boolean) => (
    <>
      {dirty && (
        <button type="button" onClick={() => setPrefs(saved)} disabled={saving} className={OUTLINE}>
          Cancel
        </button>
      )}
      <button type="button" onClick={save} disabled={saving || !dirty} className={PRIMARY}>
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          withIcon && <Save className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        )}
        {saving ? "Saving…" : "Save Change"}
      </button>
    </>
  );

  return (
    <>
      <RiderPageHeader name={name || undefined} now={new Date(nowIso)} actions={actions(true)} />

      <section aria-labelledby="delivery-preferences-title" className={CARD}>
        <h2 id="delivery-preferences-title" className={CARD_TITLE}>
          Delivery Preferences
        </h2>
        <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[640px]:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <SelectField
              id="rider-radius"
              label="Max Delivery Radius"
              value={prefs.maxRadiusKm === null ? "" : String(prefs.maxRadiusKm)}
              onChange={(value) => change({ maxRadiusKm: value === "" ? null : Number(value) })}
              options={RADIUS_OPTIONS}
            />
            <p className={HINT}>Waiting orders farther than this from the kitchen are hidden from you.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <SelectField
              id="rider-order-types"
              label="Order Types Accepted"
              value={prefs.acceptsCash ? "ALL" : "ONLINE_ONLY"}
              onChange={(value) => change({ acceptsCash: value !== "ONLINE_ONLY" })}
              options={ORDER_TYPE_OPTIONS}
            />
            <p className={HINT}>Choose online-paid only if you don&apos;t want to carry cash.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="rider-notifications-title" className={CARD}>
        <h2 id="rider-notifications-title" className={CARD_TITLE}>
          Notifications
        </h2>
        <div className="flex flex-col gap-4">
          <ToggleRow
            id="rider-new-order-alerts"
            title="New Order Alerts"
            description="Notify when a new order is available nearby — in Notification and the sidebar badge."
            checked={prefs.newOrderAlerts}
            onChange={(value) => change({ newOrderAlerts: value })}
          />
          <ToggleRow
            id="rider-earnings-summary"
            title="Earnings Summary"
            description="Daily summary of your earnings and deliveries, by email after each day you deliver."
            checked={prefs.earningsSummary}
            onChange={(value) => change({ earningsSummary: value })}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">{actions(false)}</div>
      </section>
    </>
  );
}

/** Figma notification row: cream, radius 20, padding 20/30, 62×36 orange switch. */
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
        <span id={`${id}-label`} className="font-frank-ruhl text-[18px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[20px]">
          {title}
        </span>
        <span id={`${id}-desc`} className="font-sora text-[12px] leading-[1.4] text-black/70">
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
