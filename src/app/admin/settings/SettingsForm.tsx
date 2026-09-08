"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
// currency-format.ts ইচ্ছাকৃতভাবে Prisma-মুক্ত, তাই client component-এও
// import করা নিরাপদ — ওই ফাইলের header-এ কারণটা লেখা আছে।
import { formatAmount } from "@/lib/currency-format";
import { Calendar } from "lucide-react";
import { FIELD, LABEL, PRIMARY_BUTTON, SelectField } from "@/components/admin/modal-ui";

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

/**
 * ⚠️ এই তিনটে token আগে নিজের মতো করে লেখা ছিল — `border-gray-300`,
 * `rounded-md`, সাদা background। অর্থাৎ পাতাটা অ্যাপের নকশা-ব্যবস্থার
 * বাইরে দাঁড়িয়ে ছিল, যেখানে বাকি প্রতিটা admin পর্দা cream ঘর, radius
 * ১২, Sora/Frank Ruhl আর AdminShell-এর কার্ড ব্যবহার করে।
 *
 * এখন সরাসরি components/admin/modal-ui.tsx-এর token গুলোই ব্যবহার হয়,
 * নিজের কপি নয় — নাহলে একদিন ওখানে radius বদলালে এই পাতাটা একা পুরোনো
 * চেহারায় থেকে যেত। Kitchen, Categories আর Orders-এর ক্ষেত্রেও ঠিক
 * এটাই হয়েছিল।
 */
const inputClass = FIELD;
const labelClass = LABEL;
const helpClass = "mt-1.5 font-sora text-[11px] leading-[1.6] text-black/50";

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
    /**
     * Figma-র কার্ড: সাদা, radius 20, padding 30 (সরু পর্দায় কমে)।
     * Orders আর Kitchen-এর তালিকা-কার্ডের হুবহু একই খোলস।
     */
    <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div>
        <h2 className="font-frank-ruhl text-[20px] font-semibold leading-none text-black min-[480px]:text-[24px]">
          {title}
        </h2>
        <p className="mt-2 font-sora text-[12px] leading-[1.6] text-black/50">{description}</p>
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
    /**
     * Figma-র "Notifications" কার্ডের সারিটা: cream পটভূমি, বাঁয়ে লেখা,
     * ডানে gradient pill switch।
     *
     * ⚠️ checkbox নয়, `role="switch"` সহ একটা <button>। checkbox-এর
     * native চেহারা browser-ভেদে আলাদা আর Figma-র pill-টা তাতে বানানো
     * যায় না। screen reader-এর কাছে দুটোই সমান স্পষ্ট, কারণ
     * aria-checked সেই ভূমিকাটাই বহন করে।
     */
    <div className="flex items-center justify-between gap-4 rounded-[16px] bg-[#F9F6F3] p-4">
      <span className="min-w-0">
        <span className="block font-frank-ruhl text-[14px] font-medium leading-[1.4] text-black">
          {label}
        </span>
        {help && (
          <span className="mt-1 block font-sora text-[11px] leading-[1.6] text-black/50">
            {help}
          </span>
        )}
      </span>

      {/**
        * ⚠️ gradient নয়, **একরঙা** কমলা — Figma-র switch গুলো তাই।
        *
        * gradient-টা বোতামের জন্য (PRIMARY_BUTTON), আর ওখানে সেটা কাজ
        * করে কারণ বোতাম চওড়া। ৪০px-এর একটা track-এ ওই gradient কার্যত
        * একটা ঘোলাটে রঙ হয়ে দাঁড়ায় — নকশাটা দেখা যায় না, শুধু কমলাটা
        * নোংরা লাগে।
        *
        * বন্ধ অবস্থার ধূসরটা উষ্ণ (#D9D2CC), নিরপেক্ষ ধূসর নয় — cream
        * পটভূমিতে নীলচে ধূসর ঠান্ডা আর বেমানান দেখায়।
        */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
          checked ? "bg-[#FF8A3D]" : "bg-[#D9D2CC]"
        }`}
      >
        {/**
          * ⚠️ বন্ধ অবস্থায় গুটিটা **বাঁয়ে**, চালু অবস্থায় ডানে।
          *
          * Figma-র দুটো ছবিতেই ওটা ডানে আঁকা, কিন্তু সেটা অনুসরণ করা
          * যায় না: switch-এর গুটির অবস্থানই তার অবস্থা বলে দেয়, আর
          * দুই অবস্থায় এক জায়গায় থাকলে রঙই একমাত্র সংকেত — যা
          * বর্ণান্ধ ব্যবহারকারীর কাছে কোনো সংকেতই নয়।
          */}
        {/**
          * ⚠️ `left-0.5` বাদ দেওয়া যাবে না।
          *
          * absolute element-এ `left` না দিলে ব্রাউজার তার **static
          * position** ধরে — অর্থাৎ flow-তে যেখানে বসত। <button>-এর
          * UA stylesheet-এ `text-align: center` থাকে, তাই সেই
          * অবস্থানটা track-এর মাঝখান, বাঁ কিনারা নয়। তার উপর
          * translate যোগ হয়ে গুটিটা track ছাড়িয়ে বাইরে বেরিয়ে যেত।
          *
          * হিসাবটা: track ৪০, গুটি ১৮, দু'পাশে ২ করে ফাঁক।
          * বন্ধ → 2..20, চালু → (2 + 18) = 20..38।
          */}
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsForm({
  initialData,
  userName,
  today,
}: {
  initialData: SettingsFormData;
  /** Welcome শিরোনামের নাম — server থেকে, session-এর। */
  userName: string;
  /** ইতিমধ্যেই সাজানো তারিখ। কেন string, তার ব্যাখ্যা page.tsx-এ। */
  today: string;
}) {
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/**
        * Figma-তে "Save Change" বোতামটা উপরে-ডানে, পাতার নিচে নয় — আর
        * সেটাই এখানে রাখা হয়েছে।
        *
        * ⚠️ আপস আছে: পাতাটা লম্বা, তাই নিচের zone গুলো সম্পাদনা করার
        * পর সেভ করতে উপরে ফিরতে হয়। বার্তা দুটো (error/success) এই
        * একই সারিতে বসে, বোতামের পাশেই — যাতে সেভ চেপে ফল দেখতে আবার
        * চোখ সরাতে না হয়।
        */}
      {/* --- Welcome header — Orders/Kitchen/Categories-এর একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {userName}!
          </span>
        </h1>

        {/**
          * ⚠️ তারিখ আর Save **একই সারিতে** — Figma-র উপরের ডান কোণে
          * যেভাবে "Jan 20, 2026" আর "Export Report" পাশাপাশি বসে।
          *
          * আগে তারিখটা page.tsx-এ আর বোতামটা form-এর ভেতরে ছিল,
          * অর্থাৎ দুটো আলাদা block — তাই বোতামটা তারিখের নিচের সারিতে
          * নেমে যেত।
          *
          * ৩২০px-এ দুটো পাশাপাশি ধরে না, তাই `justify-between` দিয়ে
          * দুই প্রান্তে ছড়িয়ে দেওয়া হয় (Orders-এর header-এর হুবহু
          * একই আচরণ)।
          */}
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-end">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {today}
          </span>

          <button
            type="submit"
            disabled={isPending}
            className={`${PRIMARY_BUTTON} h-10 shrink-0 min-[480px]:h-11`}
          >
            {isPending ? "Saving…" : "Save Change"}
          </button>
        </div>
      </div>

      {/**
        * ⚠️ বার্তা দুটো header-এর নিচে, নিজের সারিতে।
        *
        * বোতামের পাশে বসানো হয়েছিল, কিন্তু তাতে বার্তা এলে header-এর
        * উচ্চতা বদলে যেত আর নিচের পুরো পাতাটা এক ঝটকায় নেমে যেত —
        * যেটা ঠিক সেভ চাপার মুহূর্তে সবচেয়ে বিরক্তিকর।
        */}
      {/**
        * ⚠️ কোনো wrapper <div> নেই — বার্তা না থাকলে DOM-এ কিছুই বসে
        * না। খালি একটা div রাখলে form-এর `gap-4` তার জন্যও একটা ফাঁক
        * ছাড়ত, অর্থাৎ header আর প্রথম কার্ডের মধ্যে বিনা কারণে বাড়তি
        * জায়গা থাকত।
        */}
      {error && (
        <p className="rounded-[12px] bg-[#D72A37]/10 px-3 py-2 font-sora text-[12px] leading-[1.5] text-[#D72A37]">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-[12px] bg-[#2C6252]/10 px-3 py-2 font-sora text-[12px] leading-[1.5] text-[#2C6252]">
          Settings saved successfully.
        </p>
      )}

      {/* ─────────────────────────── Hours ─────────────────────────── */}

      <Section
        title="Opening hours"
        description="Decides when customers see “Kitchen available” on the site."
      >
        {/* ⚠️ native <select> নয়, modal-ui-র SelectField — বাকি প্রতিটা
            admin পর্দায় dropdown গুলো ওটাই, আর native select-এর চেহারা
            OS-ভেদে আলাদা বলে ওখানে cream ঘরের সাথে মিলত না। */}
        <SelectField
          id="settings-timezone"
          label="Restaurant timezone"
          value={form.timezone}
          onChange={(value) => set("timezone", value)}
          options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
        />

        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <SelectField
            id="settings-open-hour"
            label="Kitchen opens at"
            value={String(form.kitchenOpenHour)}
            onChange={(value) => set("kitchenOpenHour", parseInt(value, 10))}
            options={HOURS.map((h) => ({ value: String(h), label: formatHour(h) }))}
          />

          <SelectField
            id="settings-close-hour"
            label="Kitchen closes at"
            value={String(form.kitchenCloseHour)}
            onChange={(value) => set("kitchenCloseHour", parseInt(value, 10))}
            options={HOURS.map((h) => ({ value: String(h), label: formatHour(h) }))}
          />
        </div>
      </Section>

      {/* ────────────────────────── Currency ───────────────────────── */}

      <Section
        title="Currency"
        description="Applies to new orders only. Past orders keep the currency they were placed in."
      >
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-[1fr_10rem]">
          <SelectField
            id="settings-currency"
            label="Currency"
            value={form.currency}
            onChange={(value) => {
              const picked = CURRENCIES.find((c) => c.code === value);
              setForm((prev) => ({
                ...prev,
                currency: value,
                // দশমিক সংখ্যাটা currency-র সাথেই বসে যায় — দুটো আলাদা
                // রাখলে JPY-তে ১০০ গুণ ভুল চার্জ সম্ভব হতো।
                currencyMinorUnits: picked ? picked.minorUnits : prev.currencyMinorUnits,
              }));
              setSuccess(false);
            }}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
          />

          <div>
            <SelectField
              id="settings-minor-units"
              label="Decimal places"
              value={String(form.currencyMinorUnits)}
              onChange={(value) => set("currencyMinorUnits", parseInt(value, 10))}
              options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
            />
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
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div className="min-w-0">
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

              <div className="min-w-0">
                <SelectField
                  id="settings-tax-mode"
                  label="How prices work"
                  value={form.taxMode}
                  onChange={(value) => set("taxMode", value as "INCLUSIVE" | "EXCLUSIVE")}
                  options={[
                    { value: "EXCLUSIVE", label: "Added on top of menu prices" },
                    { value: "INCLUSIVE", label: "Already included in menu prices" },
                  ]}
                />
                <p className={helpClass}>
                  {form.taxMode === "INCLUSIVE"
                    ? "EU, UK, Japan, Australia, India. The total doesn't change — the bill just declares how much of it was tax."
                    : "US, Canada, Bangladesh. The customer pays the menu price plus tax."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div className="min-w-0">
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

              <div className="min-w-0">
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
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <div className="min-w-0">
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

          <div className="min-w-0">
            <SelectField
              id="settings-delivery-mode"
              label="How the delivery fee is decided"
              value={form.deliveryFeeMode}
              onChange={(value) => set("deliveryFeeMode", value as "FLAT" | "DISTANCE")}
              options={[
                { value: "FLAT", label: "One flat fee, every order" },
                { value: "DISTANCE", label: "By distance from the restaurant" },
              ]}
            />
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
        <div className="min-w-0">
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
          <div className="space-y-3 border-t border-black/10 pt-4">
            <div>
              <h3 className="font-frank-ruhl text-[15px] font-semibold leading-none text-black">Distance zones</h3>
              <p className={helpClass}>
                Each zone runs from where the one above it ended, so there can never be a gap.
                Distances are straight-line, not driving distance — roads are usually 20–40%
                longer, so set the prices with that in mind.
              </p>
            </div>

            <div className="space-y-2">
              {/**
                * ⚠️ শিরোনামের সারিটা ৫৬০-এর নিচে লুকোয়।
                *
                * ওখানে প্রতিটা ধাপ নিজেই একটা ছোট কার্ড হয়ে যায়, আর
                * ঘরগুলোর নিজস্ব label উপরে বসে — তখন একটা আলাদা
                * শিরোনাম-সারি কোন কলামের কথা বলছে, বোঝাই যেত না।
                * Orders তালিকার Field()-এও ঠিক এই একই যুক্তি।
                */}
              <div className="hidden items-center gap-2 font-sora text-[11px] text-black/50 min-[560px]:flex">
                <span className="w-32 shrink-0">Zone</span>
                <span className="flex-1">Up to (km)</span>
                <span className="flex-1">Fee</span>
                <span className="w-7 shrink-0" />
              </div>

              {zones.map((zone, index) => {
                const isLast = index === zones.length - 1;
                const openEnded = zone.upToKm === null;

                return (
                  /**
                   * ⚠️ ৫৬০-এর নিচে সারিটা ভেঙে একটা cream কার্ড হয়:
                   * উপরে ধাপের নাম, নিচে দুটো ঘর পাশাপাশি।
                   *
                   * চারটে কলাম (নাম · Up to · Fee · ×) এক সারিতে
                   * ধরাতে অন্তত ৩৮০px লাগে; ৩২০px পর্দায় কার্ডের
                   * ভেতরে জায়গা থাকে ~২৪০px। জোর করলে ঘরদুটো ৪০px-এ
                   * নেমে আসত, অর্থাৎ "12.5" লেখাই যেত না।
                   */
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-[12px] bg-[#F9F6F3] p-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:rounded-none min-[560px]:bg-transparent min-[560px]:p-0"
                  >
                    <span className="font-frank-ruhl text-[13px] font-medium leading-none text-black min-[560px]:w-32 min-[560px]:shrink-0 min-[560px]:font-sora min-[560px]:text-[12px] min-[560px]:font-normal min-[560px]:text-black/70">
                      {zoneRangeLabel(index)}
                    </span>

                    {/**
                      * ⚠️ `min-[560px]:contents` — চওড়া পর্দায় এই
                      * মোড়কটা DOM-এ থেকেও layout থেকে উবে যায়, তাই
                      * ভেতরের তিনটে জিনিস সরাসরি বাইরের flex সারির
                      * সন্তান হয়ে বসে।
                      *
                      * বিকল্প ছিল দুটো আলাদা markup লিখে একটাকে
                      * লুকিয়ে রাখা — কিন্তু তাতে একই "×" বোতাম দুবার
                      * DOM-এ থাকত, আর ভবিষ্যতে একটাতে বদল করে অন্যটায়
                      * ভুলে যাওয়াটা সময়ের ব্যাপার মাত্র।
                      */}
                    <div className="flex items-end gap-2 min-[560px]:contents">
                      <label className="flex min-w-0 flex-1 flex-col gap-1 min-[560px]:contents">
                        {/* label-টা কেবল সরু পর্দায় — চওড়ায় শিরোনাম-সারি
                            ওই কাজটা করে। */}
                        <span className="font-sora text-[11px] leading-none text-black/50 min-[560px]:hidden">
                          Up to (km)
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
                          className={`${inputClass} flex-1 disabled:bg-black/[0.04] disabled:text-black/30`}
                        />
                      </label>

                      <label className="flex min-w-0 flex-1 flex-col gap-1 min-[560px]:contents">
                        <span className="font-sora text-[11px] leading-none text-black/50 min-[560px]:hidden">
                          Fee
                        </span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={zone.fee}
                          onChange={(e) =>
                            updateZone(index, { fee: parseFloat(e.target.value) || 0 })
                          }
                          className={`${inputClass} flex-1`}
                        />
                      </label>

                    <button
                      type="button"
                      onClick={() => removeZone(index)}
                      // ⚠️ শেষ ধাপটা মোছা যায় না। ওটাই সিঁড়ির তলা —
                      // সরিয়ে দিলে দূরের ঠিকানায় কোনো ধাপই মিলত না।
                      disabled={zones.length <= 1 || isLast}
                      aria-label={`Remove the ${zoneRangeLabel(index)} zone`}
                      // ⚠️ `mb-[9px]` কেবল সরু পর্দায়: ওখানে ঘরগুলোর
                      // উপরে একটা label বসে, তাই বোতামটা না নামালে
                      // label-এর সমান্তরালে ঝুলে থাকত, ঘরের নয়।
                      className="mb-[9px] h-7 w-7 shrink-0 rounded-full text-black/40 transition-colors hover:bg-black/5 hover:text-[#D72A37] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black/40 min-[560px]:mb-0"
                    >
                      ×
                    </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={addZone}
                disabled={zones.length >= 8}
                className="font-sora text-[12px] font-semibold text-[#FF7100] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                + Add a zone
              </button>
              {zones.length >= 8 && (
                <span className="font-sora text-[11px] text-black/40">Eight is the maximum.</span>
              )}
            </div>

            <div className="border-t border-black/10 pt-3">
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

            <div className="grid grid-cols-1 gap-4 border-t border-black/10 pt-3 min-[480px]:grid-cols-2">
              <div className="min-w-0">
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
              <div className="min-w-0">
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

      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-col items-start justify-between gap-3 min-[560px]:flex-row">
          <div className="min-w-0">
            <h2 className="font-frank-ruhl text-[20px] font-semibold leading-none text-black min-[480px]:text-[24px]">
              What a customer would see
            </h2>
            <p className="mt-2 font-sora text-[12px] leading-[1.6] text-black/50">
              A sample order of 2 × {money("50")}, priced by the same code that prices real
              orders.
            </p>
          </div>

          <div className="flex shrink-0 overflow-hidden rounded-full bg-[#F9F6F3] p-1">
            {(["dineIn", "delivery"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPreviewType(type)}
                className={`rounded-full px-4 py-1.5 font-sora text-[12px] font-medium leading-none transition-colors ${
                  previewType === type
                    ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    : "text-black/60 hover:text-black"
                }`}
              >
                {type === "dineIn" ? "Dine-in" : "Delivery"}
              </button>
            ))}
          </div>
        </div>

        {previewError && (
          <p className="rounded-[12px] bg-[#FF9540]/10 px-3 py-2 font-sora text-[12px] leading-[1.5] text-[#9A5B12]">
            Can&apos;t price these values — check the rates above.
          </p>
        )}

        {!previewError && line && preview && (
          <dl className="flex flex-col gap-2 rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[13px]">
            <div className="flex justify-between text-black/70">
              <dt>Subtotal</dt>
              <dd>{money(line.subtotal)}</dd>
            </div>

            {parseFloat(line.serviceCharge) > 0 && (
              <div className="flex justify-between text-black/70">
                <dt>Service charge</dt>
                <dd>{money(line.serviceCharge)}</dd>
              </div>
            )}

            {parseFloat(line.deliveryFee) > 0 && (
              <div className="flex justify-between text-black/70">
                <dt>
                  Delivery
                  {/* ⚠️ preview-তে কোনো ঠিকানা নেই, তাই সবচেয়ে কাছের
                      ধাপটা ধরা হয়। কোনটা ধরা হয়েছে সেটা না লিখলে owner
                      এই একটা সংখ্যাকেই "সব অর্ডারের ফি" ভেবে বসতেন। */}
                  {preview.deliveryZoneLabel && (
                    <span className="text-black/40"> ({preview.deliveryZoneLabel})</span>
                  )}
                </dt>
                <dd>{money(line.deliveryFee)}</dd>
              </div>
            )}

            {parseFloat(line.taxAmount) > 0 && (
              <div className="flex justify-between text-black/70">
                <dt>
                  {preview.taxName}
                  {preview.taxMode === "INCLUSIVE" && (
                    <span className="text-black/40"> (included above)</span>
                  )}
                </dt>
                <dd>{money(line.taxAmount)}</dd>
              </div>
            )}

            <div className="flex justify-between border-t border-black/10 pt-2 font-medium text-black">
              <dt>Bill total</dt>
              <dd>{money(line.grandTotal)}</dd>
            </div>

            {parseFloat(line.tipAmount) > 0 && (
              <>
                <div className="flex justify-between text-black/70">
                  <dt>Tip ({preview.tipPercent}%)</dt>
                  <dd>{money(line.tipAmount)}</dd>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-2 font-semibold text-black">
                  <dt>Customer pays</dt>
                  <dd>{money(line.totalAmount)}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </section>

    </form>
  );
}
