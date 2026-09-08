"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
// currency-format.ts ইচ্ছাকৃতভাবে Prisma-মুক্ত, তাই client component-এও
// import করা নিরাপদ — ওই ফাইলের header-এ কারণটা লেখা আছে।
import { formatAmount } from "@/lib/currency-format";

const TIMEZONES = [
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
];

/**
 * currency আর তার দশমিক সংখ্যা একসাথে রাখা হয়েছে ইচ্ছাকৃতভাবে।
 *
 * দুটো আলাদা করে বেছে নিতে দিলে একদিন কেউ JPY বেছে দশমিক ২ রেখে দিতেন,
 * আর প্রতিটা অর্ডার Stripe-এ ১০০ গুণ বেশি চার্জ হতো — ঠিক যে বাগটা money
 * model migration-এ ধরা পড়েছিল। তাই currency বদলালে দশমিক নিজে থেকেই
 * বসে যায়।
 *
 * তালিকার বাইরের currency-ও schema মেনে নেবে (যেকোনো ISO 4217 কোড),
 * কিন্তু তখন দশমিকটা হাতে ঠিক করতে হবে।
 */
const CURRENCIES: { code: string; name: string; minorUnits: number }[] = [
  { code: "BDT", name: "Bangladeshi Taka", minorUnits: 2 },
  { code: "EUR", name: "Euro", minorUnits: 2 },
  { code: "GBP", name: "British Pound", minorUnits: 2 },
  { code: "USD", name: "US Dollar", minorUnits: 2 },
  { code: "INR", name: "Indian Rupee", minorUnits: 2 },
  { code: "PKR", name: "Pakistani Rupee", minorUnits: 2 },
  { code: "AED", name: "UAE Dirham", minorUnits: 2 },
  { code: "SAR", name: "Saudi Riyal", minorUnits: 2 },
  { code: "AUD", name: "Australian Dollar", minorUnits: 2 },
  { code: "CAD", name: "Canadian Dollar", minorUnits: 2 },
  { code: "SGD", name: "Singapore Dollar", minorUnits: 2 },
  { code: "MYR", name: "Malaysian Ringgit", minorUnits: 2 },
  { code: "THB", name: "Thai Baht", minorUnits: 2 },
  { code: "CNY", name: "Chinese Yuan", minorUnits: 2 },
  // দশমিকহীন — এখানে ১০০ দিয়ে গুণ করলে ১০০ গুণ বেশি আদায় হয়।
  { code: "JPY", name: "Japanese Yen (no decimals)", minorUnits: 0 },
  { code: "KRW", name: "South Korean Won (no decimals)", minorUnits: 0 },
  { code: "VND", name: "Vietnamese Dong (no decimals)", minorUnits: 0 },
  // তিন দশমিক — ১০০০ ভাগে বিভক্ত।
  { code: "KWD", name: "Kuwaiti Dinar (3 decimals)", minorUnits: 3 },
  { code: "BHD", name: "Bahraini Dinar (3 decimals)", minorUnits: 3 },
  { code: "OMR", name: "Omani Rial (3 decimals)", minorUnits: 3 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

type PreviewLine = {
  subtotal: string;
  serviceCharge: string;
  deliveryFee: string;
  taxAmount: string;
  tipAmount: string;
  grandTotal: string;
  totalAmount: string;
};

type Preview = {
  currency: string;
  taxName: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  tipPercent: number;
  /** DISTANCE mode-এ preview কোন ধাপ ধরে কষা হয়েছে; FLAT-এ null। */
  deliveryZoneLabel: string | null;
  dineIn: PreviewLine;
  delivery: PreviewLine;
};

export interface SettingsFormData {
  timezone: string;
  kitchenOpenHour: number;
  kitchenCloseHour: number;
  currency: string;
  currencyMinorUnits: number;
  taxEnabled: boolean;
  taxName: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  taxRateDineIn: number;
  taxRateDelivery: number;
  serviceChargeRate: number;
  serviceChargeTaxable: boolean;
  deliveryFeeFlat: number;
  deliveryFeeTaxable: boolean;
  deliveryFeeMode: "FLAT" | "DISTANCE";
  /**
   * দূরত্বের সিঁড়ি। শেষ ধাপের `upToKm` null = "এর পরে যত দূরই হোক"।
   *
   * ⚠️ কেবল `upToKm` রাখা হয়, `fromKm` নয় — আগের ধাপের সীমা থেকেই সেটা
   * বেরিয়ে আসে। দুটো সীমা হাতে লিখতে দিলে owner একদিন 0–3 আর 5–8
   * বসাবেন, আর ৪ কিমি দূরের অর্ডারে কোনো ধাপই মিলত না।
   */
  deliveryZones: { upToKm: number | null; fee: number }[];
  restaurantLat: number | null;
  restaurantLng: number | null;
  tipEnabled: boolean;
  tipPresetPercents: number[];
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const helpClass = "text-xs text-gray-500 mt-1";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#FF4C15] focus:ring-[#FF4C15]"
        />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
      {help && <p className={`${helpClass} ml-6`}>{help}</p>}
    </div>
  );
}

export default function SettingsForm({ initialData }: { initialData: SettingsFormData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<SettingsFormData>(initialData);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewType, setPreviewType] = useState<"dineIn" | "delivery">("dineIn");

  // একটা field বদলানোর ছোট helper। ১৬টা আলাদা useState রাখলে নতুন field
  // যোগ করা প্রতিবার তিন জায়গায় পরিবর্তন দাবি করত।
  function set<K extends keyof SettingsFormData>(key: K, value: SettingsFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  /**
   * Live preview — হিসাবটা server-এ হয়, এখানে নয়।
   *
   * lib/pricing.ts client bundle-এ আনা যায় না (সে Prisma ছোঁয়, যা
   * `node:module` টানে), আর এখানে আলাদা করে একই হিসাব লিখলে সেটা একদিন
   * আসল বিল থেকে সরে যেত — preview এক অঙ্ক দেখাত, গ্রাহক দিতেন অন্যটা।
   * তাই draft settings পাঠিয়ে আসল calculateOrderPricing-ই চালানো হয়।
   *
   * ৪০০ms debounce: হার টাইপ করার সময় প্রতিটা keystroke-এ request
   * পাঠানোর মানে হয় না।
   */
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/settings/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          // সাধারণত validation — হার ১০০ ছাড়িয়েছে, বা খোলা আর বন্ধের সময়
          // এক। preview চুপ করে যায়, কারণ বিস্তারিত বার্তাটা Save চাপলে
          // এমনিতেই আসবে; এখানে দুবার বলার দরকার নেই।
          setPreviewError(true);
          return;
        }

        setPreview(await res.json());
        setPreviewError(false);
      } catch {
        setPreviewError(true);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (form.kitchenOpenHour === form.kitchenCloseHour) {
      setError("Open and close hours can't be the same.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  // আগে এখানে হাতে লেখা `${form.currency} ${value}` ছিল, ফলে preview-টা
  // "BDT 105.00" দেখাত অথচ আসল পর্দাগুলো "৳105.00"। preview-র পুরো
  // উদ্দেশ্যই "গ্রাহক যা দেখবেন" — তাই একই function ব্যবহার করা হলো।
  const money = (value: string) =>
    formatAmount(value, form.currency, form.currencyMinorUnits);
  const line = preview ? preview[previewType] : null;

  // ─────────────────────── Delivery zones ───────────────────────────

  const zones = form.deliveryZones;

  /**
   * শেষ ধাপটার একটা সীমা আছে কিনা — অর্থাৎ owner কি একটা delivery
   * radius ঠিক করেছেন?
   *
   * ⚠️ এটা আলাদা কোনো field নয়, শেষ ধাপের `upToKm` থেকেই বের করা।
   * আলাদা boolean রাখলে সেটা আর সিঁড়িটা একদিন আলাদা কথা বলত।
   */
  const hasRadiusLimit = zones.length > 0 && zones[zones.length - 1].upToKm !== null;

  const setZones = (next: SettingsFormData["deliveryZones"]) =>
    set("deliveryZones", next);

  const updateZone = (index: number, patch: Partial<{ upToKm: number | null; fee: number }>) =>
    setZones(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));

  /**
   * নতুন ধাপ **শেষেরটার আগে** বসে।
   *
   * ⚠️ একেবারে শেষে বসালে সীমাহীন ধাপটা আর শেষে থাকত না, আর তার পরের
   * ধাপগুলো কখনো মিলতই না — normalizeDeliveryZones() সেগুলো নীরবে বাদ
   * দিত, অর্থাৎ owner একটা ধাপ যোগ করে Save চেপে দেখতেন সেটা উধাও।
   */
  const addZone = () => {
    const last = zones[zones.length - 1];
    const previous = zones.length > 1 ? zones[zones.length - 2] : null;
    const base = previous?.upToKm ?? 0;
    const inserted = { upToKm: base + 2, fee: last?.fee ?? 0 };
    setZones([...zones.slice(0, -1), inserted, ...zones.slice(-1)]);
  };

  const removeZone = (index: number) => setZones(zones.filter((_, i) => i !== index));

  /**
   * "এর বাইরে delivery করি না" — শেষ ধাপে সীমা বসানো বা তুলে নেওয়া।
   *
   * সীমা বসালে তার বাইরের ঠিকানায় checkout **থামে** (cart-এ লাল
   * বার্তা, Confirm বন্ধ)। তুলে নিলে যত দূরই হোক শেষ ধাপের দামে
   * অর্ডার নেওয়া হয়।
   */
  const toggleRadiusLimit = (limited: boolean) => {
    if (zones.length === 0) return;
    const previous = zones.length > 1 ? zones[zones.length - 2] : null;
    const fallback = (previous?.upToKm ?? 0) + 5;
    setZones(
      zones.map((zone, i) =>
        i === zones.length - 1 ? { ...zone, upToKm: limited ? fallback : null } : zone
      )
    );
  };

  /** "0–1 km", "3–5 km", "8 km and beyond" — সিঁড়ি থেকে derived। */
  const zoneRangeLabel = (index: number) => {
    const from = index === 0 ? 0 : (zones[index - 1].upToKm ?? 0);
    const to = zones[index].upToKm;
    return to === null ? `${from} km and beyond` : `${from}–${to} km`;
  };

  /** খালি ঘর = null, নাহলে সংখ্যা। "" আর 0 আলাদা রাখতে হয়। */
  const parseCoord = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md">
          Settings saved successfully.
        </div>
      )}

      {/* ─────────────────────────── Hours ─────────────────────────── */}

      <Section
        title="Opening hours"
        description="Decides when customers see “Kitchen available” on the site."
      >
        <div>
          <label className={labelClass}>Restaurant timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={labelClass}>Kitchen opens at</label>
            <select
              value={form.kitchenOpenHour}
              onChange={(e) => set("kitchenOpenHour", parseInt(e.target.value, 10))}
              className={inputClass}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className={labelClass}>Kitchen closes at</label>
            <select
              value={form.kitchenCloseHour}
              onChange={(e) => set("kitchenCloseHour", parseInt(e.target.value, 10))}
              className={inputClass}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ────────────────────────── Currency ───────────────────────── */}

      <Section
        title="Currency"
        description="Applies to new orders only. Past orders keep the currency they were placed in."
      >
        <div className="flex gap-4">
          <div className="flex-1">
            <label className={labelClass}>Currency</label>
            <select
              value={form.currency}
              onChange={(e) => {
                const picked = CURRENCIES.find((c) => c.code === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  currency: e.target.value,
                  // দশমিক সংখ্যাটা currency-র সাথেই বসে যায় — দুটো আলাদা
                  // রাখলে JPY-তে ১০০ গুণ ভুল চার্জ সম্ভব হতো।
                  currencyMinorUnits: picked ? picked.minorUnits : prev.currencyMinorUnits,
                }));
                setSuccess(false);
              }}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className={labelClass}>Decimal places</label>
            <select
              value={form.currencyMinorUnits}
              onChange={(e) => set("currencyMinorUnits", parseInt(e.target.value, 10))}
              className={inputClass}
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className={helpClass}>Set for you. Change only if you know the currency.</p>
          </div>
        </div>
      </Section>

      {/* ──────────────────────────── Tax ──────────────────────────── */}

      <Section
        title="Tax"
        description="Changing a rate never rewrites past invoices — every order stores the rate it was charged at."
      >
        <Toggle
          checked={form.taxEnabled}
          onChange={(v) => set("taxEnabled", v)}
          label="Charge tax on orders"
          help="Turn off if your restaurant isn't registered for VAT/GST/sales tax."
        />

        {form.taxEnabled && (
          <>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={labelClass}>What it&apos;s called</label>
                <input
                  type="text"
                  value={form.taxName}
                  onChange={(e) => set("taxName", e.target.value)}
                  maxLength={30}
                  className={inputClass}
                  placeholder="VAT"
                />
                <p className={helpClass}>
                  Printed on every bill. VAT, GST, Sales Tax, IVA — whatever it is locally.
                </p>
              </div>

              <div className="flex-1">
                <label className={labelClass}>How prices work</label>
                <select
                  value={form.taxMode}
                  onChange={(e) => set("taxMode", e.target.value as "INCLUSIVE" | "EXCLUSIVE")}
                  className={inputClass}
                >
                  <option value="EXCLUSIVE">Added on top of menu prices</option>
                  <option value="INCLUSIVE">Already included in menu prices</option>
                </select>
                <p className={helpClass}>
                  {form.taxMode === "INCLUSIVE"
                    ? "EU, UK, Japan, Australia, India. The total doesn't change — the bill just declares how much of it was tax."
                    : "US, Canada, Bangladesh. The customer pays the menu price plus tax."}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className={labelClass}>Dine-in rate (%)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={form.taxRateDineIn}
                  onChange={(e) => set("taxRateDineIn", parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div className="flex-1">
                <label className={labelClass}>Delivery rate (%)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={form.taxRateDelivery}
                  onChange={(e) => set("taxRateDelivery", parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>

            <p className={helpClass}>
              Two rates, because plenty of countries tax the same food differently depending on how
              it leaves the kitchen — Germany charges 19% dine-in but 7% takeaway, and Bangladesh
              sets VAT by whether the dining room is air-conditioned. If yours doesn&apos;t, put the
              same number in both.
            </p>
          </>
        )}
      </Section>

      {/* ─────────────────── Service charge & delivery ─────────────── */}

      <Section
        title="Service charge and delivery"
        description="Both optional. Leave at 0 to keep them off the bill entirely."
      >
        <div className="flex gap-4">
          <div className="flex-1">
            <label className={labelClass}>Service charge (%)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              value={form.serviceChargeRate}
              onChange={(e) => set("serviceChargeRate", parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
            <p className={helpClass}>
              Standard in India, Southeast Asia and the Gulf. In the UK it&apos;s how restaurants
              collect what Americans would tip.
            </p>
          </div>

          <div className="flex-1">
            <label className={labelClass}>How the delivery fee is decided</label>
            <select
              value={form.deliveryFeeMode}
              onChange={(e) => set("deliveryFeeMode", e.target.value as "FLAT" | "DISTANCE")}
              className={inputClass}
            >
              <option value="FLAT">One flat fee, every order</option>
              <option value="DISTANCE">By distance from the restaurant</option>
            </select>
            <p className={helpClass}>
              {form.deliveryFeeMode === "DISTANCE"
                ? "The customer's address is looked up on the map at checkout, and the matching zone below sets the fee."
                : "The same fee on every delivery order, however far it goes."}
            </p>
          </div>
        </div>

        {/**
          * ⚠️ flat ফির ঘরটা DISTANCE mode-এও থাকে, লুকানো হয় না।
          *
          * কারণ ওটা তখন **ব্যাকআপ**: ঠিকানাটা মানচিত্রে খুঁজে পাওয়া না
          * গেলে (Nominatim বাইরের একটা বিনামূল্যের সেবা, মাঝেমধ্যে বসে
          * যায়) এই ফি-টাই বসে আর অর্ডার এগোয়। লুকিয়ে রাখলে owner
          * জানতেনই না কোন সংখ্যাটা তখন ব্যবহার হচ্ছে।
          */}
        <div className="flex-1">
          <label className={labelClass}>
            {form.deliveryFeeMode === "DISTANCE"
              ? "Fallback delivery fee (flat)"
              : "Delivery fee (flat)"}
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.deliveryFeeFlat}
            onChange={(e) => set("deliveryFeeFlat", parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
          <p className={helpClass}>
            {form.deliveryFeeMode === "DISTANCE"
              ? "Used only when an address can't be found on the map. The order still goes through — it's charged this instead of a zone fee, and the dispatch screen marks it as a flat rate."
              : "Charged on delivery orders only."}
          </p>
        </div>

        {/* ───────────────────── Distance zones ───────────────────── */}

        {form.deliveryFeeMode === "DISTANCE" && (
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <div>
              <h3 className="text-sm font-medium text-gray-800">Distance zones</h3>
              <p className={helpClass}>
                Each zone runs from where the one above it ended, so there can never be a gap.
                Distances are straight-line, not driving distance — roads are usually 20–40%
                longer, so set the prices with that in mind.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-32 shrink-0">Zone</span>
                <span className="flex-1">Up to (km)</span>
                <span className="flex-1">Fee</span>
                <span className="w-7 shrink-0" />
              </div>

              {zones.map((zone, index) => {
                const isLast = index === zones.length - 1;
                const openEnded = zone.upToKm === null;

                return (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-xs text-gray-600">
                      {zoneRangeLabel(index)}
                    </span>

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      // সীমাহীন শেষ ধাপে কোনো সংখ্যা নেই — ঘরটা বন্ধ,
                      // আর placeholder-ই বলে দেয় কেন।
                      disabled={isLast && openEnded}
                      value={zone.upToKm ?? ""}
                      placeholder={isLast && openEnded ? "no limit" : ""}
                      onChange={(e) =>
                        updateZone(index, { upToKm: parseFloat(e.target.value) || 0 })
                      }
                      className={`${inputClass} flex-1 disabled:bg-gray-50 disabled:text-gray-400`}
                    />

                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={zone.fee}
                      onChange={(e) => updateZone(index, { fee: parseFloat(e.target.value) || 0 })}
                      className={`${inputClass} flex-1`}
                    />

                    <button
                      type="button"
                      onClick={() => removeZone(index)}
                      // ⚠️ শেষ ধাপটা মোছা যায় না। ওটাই সিঁড়ির তলা —
                      // সরিয়ে দিলে দূরের ঠিকানায় কোনো ধাপই মিলত না।
                      disabled={zones.length <= 1 || isLast}
                      aria-label={`Remove the ${zoneRangeLabel(index)} zone`}
                      className="w-7 h-7 shrink-0 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={addZone}
                disabled={zones.length >= 8}
                className="text-xs font-medium text-[#FF4C15] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                + Add a zone
              </button>
              {zones.length >= 8 && (
                <span className="text-xs text-gray-400">Eight is the maximum.</span>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <Toggle
                checked={hasRadiusLimit}
                onChange={toggleRadiusLimit}
                label="Refuse orders beyond the furthest zone"
                help={
                  hasRadiusLimit
                    ? "Addresses outside that distance are turned away at checkout, before the customer pays."
                    : "Right now any address is accepted, however far — the furthest zone's fee applies."
                }
              />
            </div>

            <div className="flex gap-4 border-t border-gray-200 pt-3">
              <div className="flex-1">
                <label className={labelClass}>Restaurant latitude</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.restaurantLat ?? ""}
                  onChange={(e) => set("restaurantLat", parseCoord(e.target.value))}
                  className={inputClass}
                  placeholder="24.84491"
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Restaurant longitude</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.restaurantLng ?? ""}
                  onChange={(e) => set("restaurantLng", parseCoord(e.target.value))}
                  className={inputClass}
                  placeholder="89.37532"
                />
              </div>
            </div>
            <p className={helpClass}>
              Where distances are measured from. Leave both empty to use the address built into
              the app. Right-click your restaurant on Google Maps to copy its coordinates.
            </p>
          </div>
        )}

        {form.taxEnabled && (
          <div className="space-y-2 pt-1">
            <Toggle
              checked={form.serviceChargeTaxable}
              onChange={(v) => set("serviceChargeTaxable", v)}
              label="Service charge is taxable"
              help="True in most VAT systems. Usually false under US sales tax when the charge is voluntary."
            />
            <Toggle
              checked={form.deliveryFeeTaxable}
              onChange={(v) => set("deliveryFeeTaxable", v)}
              label="Delivery fee is taxable"
            />
          </div>
        )}
      </Section>

      {/* ──────────────────────────── Tips ─────────────────────────── */}

      <Section
        title="Tipping"
        description="Tips are never taxed, and are added after gift cards and points — so a prepaid balance can never quietly pay someone's tip."
      >
        <Toggle
          checked={form.tipEnabled}
          onChange={(v) => set("tipEnabled", v)}
          label="Offer customers the option to tip"
          help="Leave off for Japan, South Korea and China, where offering a tip reads as rude rather than generous."
        />

        {form.tipEnabled && (
          <div>
            <label className={labelClass}>Suggested percentages</label>
            <input
              type="text"
              value={form.tipPresetPercents.join(", ")}
              onChange={(e) => {
                const parsed = e.target.value
                  .split(",")
                  .map((part) => parseInt(part.trim(), 10))
                  .filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
                set("tipPresetPercents", parsed);
              }}
              className={inputClass}
              placeholder="10, 15, 20"
            />
            <p className={helpClass}>
              Up to four, shown as one-tap buttons at checkout. Customers can always type their own
              amount, or decline.
            </p>
          </div>
        )}
      </Section>

      {/* ─────────────────────────── Preview ───────────────────────── */}

      <section className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">What a customer would see</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              A sample order of 2 × {money("50")}, priced by the same code that prices real
              orders.
            </p>
          </div>

          <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs shrink-0">
            {(["dineIn", "delivery"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPreviewType(type)}
                className={`px-3 py-1.5 ${
                  previewType === type
                    ? "bg-[#FF4C15] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {type === "dineIn" ? "Dine-in" : "Delivery"}
              </button>
            ))}
          </div>
        </div>

        {previewError && (
          <p className="text-xs text-amber-700">
            Can&apos;t price these values — check the rates above.
          </p>
        )}

        {!previewError && line && preview && (
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <dt>Subtotal</dt>
              <dd>{money(line.subtotal)}</dd>
            </div>

            {parseFloat(line.serviceCharge) > 0 && (
              <div className="flex justify-between text-gray-600">
                <dt>Service charge</dt>
                <dd>{money(line.serviceCharge)}</dd>
              </div>
            )}

            {parseFloat(line.deliveryFee) > 0 && (
              <div className="flex justify-between text-gray-600">
                <dt>
                  Delivery
                  {/* ⚠️ preview-তে কোনো ঠিকানা নেই, তাই সবচেয়ে কাছের
                      ধাপটা ধরা হয়। কোনটা ধরা হয়েছে সেটা না লিখলে owner
                      এই একটা সংখ্যাকেই "সব অর্ডারের ফি" ভেবে বসতেন। */}
                  {preview.deliveryZoneLabel && (
                    <span className="text-gray-400"> ({preview.deliveryZoneLabel})</span>
                  )}
                </dt>
                <dd>{money(line.deliveryFee)}</dd>
              </div>
            )}

            {parseFloat(line.taxAmount) > 0 && (
              <div className="flex justify-between text-gray-600">
                <dt>
                  {preview.taxName}
                  {preview.taxMode === "INCLUSIVE" && (
                    <span className="text-gray-400"> (included above)</span>
                  )}
                </dt>
                <dd>{money(line.taxAmount)}</dd>
              </div>
            )}

            <div className="flex justify-between font-medium text-gray-800 border-t border-gray-200 pt-1.5">
              <dt>Bill total</dt>
              <dd>{money(line.grandTotal)}</dd>
            </div>

            {parseFloat(line.tipAmount) > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <dt>Tip ({preview.tipPercent}%)</dt>
                  <dd>{money(line.tipAmount)}</dd>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1.5">
                  <dt>Customer pays</dt>
                  <dd>{money(line.totalAmount)}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#FF4C15] text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
