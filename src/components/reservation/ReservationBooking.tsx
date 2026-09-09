"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
/**
 * ⚠️ `components/admin/` থেকে import, যদিও এটা গ্রাহকের পাতা।
 *
 * ফাইলটার নামে "admin" আছে, কিন্তু ভেতরে admin-নির্দিষ্ট কিছু নেই —
 * DateField আর SelectField দুটোই সাধারণ client component, কোনো
 * session বা permission ছোঁয় না। নকল করে `components/public/` বানালে
 * একদিন একটাতে bug সারিয়ে অন্যটায় ভুলে যাওয়া নিশ্চিত।
 *
 * নামটা বিভ্রান্তিকর, সেটা ঠিক — ফাইলটা `components/ui/`-তে সরানো
 * যেতে পারে, কিন্তু সেটা ৩০+ import ছোঁয়া একটা আলাদা কাজ।
 */
import { DateField, RequiredMark, SelectField } from "@/components/admin/modal-ui";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  type Country,
} from "@/components/CountryCodeSelect";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type ApiTable = {
  id: string;
  label: string;
  capacity: number;
  /** `?reservedAt=` ছাড়া ডাকলে null — অর্থাৎ "এখনো জানি না"। */
  available: boolean | null;
};

/**
 * src/components/reservation/ReservationBooking.tsx
 *
 * Figma-র মাঝের অংশ: উপরে টেবিলের গ্রিড (T-1 … T-10), তার নিচে
 * "Reserve Your Table" ফর্ম।
 *
 * ── একটাই component কেন ─────────────────────────────────────────────
 *
 * গ্রিড আর ফর্ম দেখতে দুটো আলাদা ব্লক, কিন্তু ওরা একই state ভাগ করে:
 * তারিখ/সময় বদলালে গ্রিডের রঙ বদলায় (কোন টেবিল তখন বুকড), আর গ্রিডে
 * ক্লিক করলে ফর্মের "Table Number" ঘরটা বদলায়। আলাদা করলে ওই state
 * উপরে তুলে prop-drill করতে হতো — একই জিনিস, বেশি কোড।
 *
 * ── গ্রিডের রঙ কীসের উপর নির্ভর করে ─────────────────────────────────
 *
 * ⚠️ Figma-র "Booked Table Indicator" মানে **ওই সময়ে** বুকড, চিরকালের
 * জন্য নয়। schema.prisma-য় RestaurantTable-এর মাথায় লেখা আছে:
 * "a table is NOT a static booked/free flag"। তাই তারিখ বাছার আগ
 * পর্যন্ত সব টেবিল নিরপেক্ষ ধূসর — কমলা রং তখনই আসে যখন সত্যিই
 * জানা যায়।
 *
 * তারিখ ছাড়া গ্রিডটা কমলা/ধূসর করে দেখালে সেটা নির্দিষ্ট একটা মিথ্যা
 * হতো: গ্রাহক ভাবতেন T-2 কখনোই পাওয়া যায় না।
 */
export default function ReservationBooking({
  openHour,
  closeHour,
  depositAmount,
  depositLabel,
  bookedId,
  depositCancelled,
}: {
  /** RestaurantSettings-এর রান্নাঘরের সময় — সময়ের ধাপ তৈরি করতে। */
  openHour: number;
  closeHour: number;
  /** RestaurantSettings.reservationDepositAmount; 0 = অগ্রিম বন্ধ। */
  depositAmount: number;
  /** সাজানো রূপ ("$35.00") — কেন server-এ, তা page.tsx-এ। */
  depositLabel: string | null;
  /** Stripe থেকে ফেরার পর `?booked=<id>`। */
  bookedId: string | null;
  depositCancelled: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const needsDeposit = depositAmount > 0;

  /**
   * Congratulations modal।
   *
   * ⚠️ URL-এর `?booked=` **দেখে** খোলে, submit-এর ফল থেকে নয় — কারণ
   * অগ্রিম নেওয়া হলে গ্রাহক এই component থেকে বেরিয়ে Stripe-এ যান আর
   * একটা নতুন page load নিয়ে ফেরেন। তখন আগের কোনো state বেঁচে থাকে না।
   * অগ্রিম ছাড়া পথেও একই URL বসানো হয়, যাতে দুটো পথের শেষটা এক থাকে।
   */
  const [showSuccess, setShowSuccess] = useState(Boolean(bookedId));
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  /**
   * ⚠️ `phone` এখন **জাতীয়** অংশ মাত্র — দেশের কোড আলাদা state-এ।
   *
   * register পাতা আর Staff modal-ও ঠিক এভাবেই রাখে। এক ঘরে জুড়ে
   * রাখলে গ্রাহক "০১৭..." লিখতেন আর সেই শুরুর শূন্যটা দেশের কোডের
   * পাশে টিকে যেত (+৮৮০০১৭...) — বাংলাদেশে ওটা domestic trunk prefix,
   * E.164-এ থাকা চলে না। lib/phone.ts-এর toE164() সেটা ছেঁটে দেয়,
   * কিন্তু কেবল দুটো আলাদা থাকলেই সে জানে কোনটা কোনটা।
   */
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState("2");
  const [requests, setRequests] = useState("");

  /**
   * তারিখ + সময় → একটা ISO string, নাকি null।
   *
   * ⚠️ দুটো আলাদা `<input>` (Figma-তে Date আর Time আলাদা ঘর), তাই
   * জোড়া লাগাতে হয়। দুটোর একটাও খালি থাকলে null — অর্ধেক তথ্য দিয়ে
   * availability জিজ্ঞেস করার মানে নেই।
   */
  const reservedAt = useMemo(() => {
    if (!date || !time) return null;
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date, time]);

  /**
   * তারিখ বদলালেই availability নতুন করে আনা।
   *
   * ⚠️ `AbortController` — গ্রাহক সময় বদলাতে থাকলে পুরোনো request
   * গুলো বাতিল হয়। নাহলে ধীর একটা উত্তর পরে এসে নতুনটাকে চাপা দিয়ে
   * ভুল রঙ দেখাত (race condition)।
   */
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoadingTables(true);
      try {
        const url = reservedAt
          ? `/api/tables?reservedAt=${encodeURIComponent(reservedAt.toISOString())}`
          : "/api/tables";
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setTables(Array.isArray(data) ? data : (data.tables ?? []));
      } catch {
        // বাতিল হওয়া request-ও এখানে আসে — চুপ থাকাই ঠিক, কারণ
        // পরেরটা ইতিমধ্যেই চলছে।
      } finally {
        if (!controller.signal.aborted) setLoadingTables(false);
      }
    }

    load();
    return () => controller.abort();
  }, [reservedAt]);

  /**
   * সময়ের ধাপ — রান্নাঘর খোলা থাকা সময়ের ভেতরে, আধ ঘণ্টা পরপর।
   *
   * ⚠️ `<input type="time">` ছিল, আর দুটো কারণে বদলানো হলো।
   *
   * এক, চেহারা: browser নিজের ঘড়ি-popup আঁকে (Windows-এ নীল কলাম,
   * AM/PM চাকা), যেটা CSS-এর নাগালের বাইরে — ঠিক native `<select>`-এর
   * মতোই।
   *
   * দুই, আর এটাই বেশি গুরুত্বপূর্ণ: ওটা যেকোনো সময় নিতে দিত। রাত
   * ৩:১৭-তে একটা টেবিল বুক হয়ে যেতে পারত, অথচ রান্নাঘর তখন বন্ধ।
   * তালিকা থেকে বাছতে দিলে অসম্ভব সময় বাছার সুযোগই থাকে না।
   *
   * ⚠️ closeHour ≤ openHour হলে (মধ্যরাত পেরোনো শিফট) ধাপগুলো
   * পরদিনে গড়াত — সেটা এখানে সামলানো হয়নি, কারণ তারিখটা আলাদা একটা
   * ঘর, আর "রাত ১টা মানে কোন দিন" প্রশ্নটার উত্তর ফর্মে নেই। ওরকম
   * সময়সূচি দরকার হলে এখানে আর /api/reservations দুটোতেই ভাবতে হবে।
   */
  const timeOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const end = closeHour > openHour ? closeHour : openHour + 1;

    for (let hour = openHour; hour < end; hour++) {
      for (const minute of [0, 30]) {
        const hh = String(hour).padStart(2, "0");
        const mm = String(minute).padStart(2, "0");
        const period = hour < 12 ? "AM" : "PM";
        const display = hour % 12 === 0 ? 12 : hour % 12;
        out.push({ value: `${hh}:${mm}`, label: `${display}:${mm} ${period}` });
      }
    }
    return out;
  }, [openHour, closeHour]);

  const selectedTable = tables.find((t) => t.id === tableId) ?? null;

  /**
   * অতিথির সংখ্যা — টেবিল বাছা থাকলে তার আসন পর্যন্ত, নইলে ১০ পর্যন্ত।
   *
   * ⚠️ `<input type="number">` ছিল। সেখানে ৯৯ লিখে ফেলা যেত, আর ভুলটা
   * ধরা পড়ত Submit চাপার পরে। তালিকায় সেই সুযোগই নেই — আর Figma-তেও
   * "Ext. Guests" একটা dropdown।
   */
  const guestOptions = useMemo(() => {
    const max = selectedTable?.capacity ?? 10;
    return Array.from({ length: max }, (_, i) => ({
      value: String(i + 1),
      label: `${i + 1} ${i === 0 ? "guest" : "guests"}`,
    }));
  }, [selectedTable]);

  /**
   * ⚠️ টেবিল বদলে ছোট আসনের একটা বাছলে অতিথির সংখ্যা কমিয়ে আনা।
   *
   * নাহলে "৪ জন" বাছা অবস্থায় ২-আসনের টেবিল বাছলে dropdown-এ কোনো
   * option-ই মিলত না — SelectField তখন ফাঁকা দেখাত, অথচ state-এ "4"
   * বসে আছে। Submit-এ server ৪০০ দিত, কিন্তু ততক্ষণে গ্রাহক বুঝতেই
   * পারতেন না কোন ঘরটা ভুল।
   *
   * render-এর সময় তুলনা করে setState — useEffect-এর ভেতরে নয়, কারণ
   * সেটা react-hooks/set-state-in-effect ভাঙে আর একটা বাড়তি render
   * pass চায়।
   */
  const maxGuests = selectedTable?.capacity ?? 10;
  if (Number(guests) > maxGuests) {
    setGuests(String(maxGuests));
  }

  /**
   * Stripe-এ গিয়ে ফিরে আসা (Back চাপা) — একবার জানিয়ে দেওয়া।
   *
   * ⚠️ `useEffect`-এ toast, render-এ নয়: render-এ ডাকলে প্রতিটা
   * re-render-এ একটা করে toast বেরোত।
   */
  useEffect(() => {
    if (depositCancelled) {
      toast.info("Payment cancelled — your table wasn't held.");
    }
  }, [depositCancelled]);

  /**
   * Figma-তে "Advance Payment" বোতামটা সব ঘর ভরার আগে ফ্যাকাসে, ভরার
   * পরে উজ্জ্বল। শর্তটা এখানে, যাতে বোতামের `disabled` আর চেহারা
   * দুটোই একই সত্য থেকে আসে।
   */
  const canSubmit =
    Boolean(fullName.trim()) &&
    // ⚠️ এখানে কেবল "কিছু লেখা আছে কিনা" — পূর্ণ যাচাই submit-এ।
    // টাইপ করার মাঝপথে বোতামটা জ্বলা-নেভা করলে বিরক্তিকর লাগত।
    Boolean(phone.trim()) &&
    Boolean(email.trim()) &&
    Boolean(reservedAt) &&
    Boolean(tableId);

  async function submit() {
    if (!fullName.trim() || !phone.trim() || !email.trim() || !reservedAt || !tableId) {
      toast.error("Please fill in every required field.");
      return;
    }

    /**
     * ⚠️ যাচাইটা libphonenumber দিয়ে, নিজের regex দিয়ে নয়।
     *
     * "৭–১৫ সংখ্যা" জাতীয় নিয়ম প্রতিটা দেশে ভুল: বাংলাদেশে মোবাইল
     * ১০ সংখ্যার (কোড ছাড়া), সিঙ্গাপুরে ৮, যুক্তরাজ্যে ১০। register
     * পাতা আর Staff modal-ও এই একই isValidPhone ব্যবহার করে।
     */
    const e164 = toE164(country.dial, phone);
    if (!isValidPhone(e164)) {
      toast.error(`That doesn't look like a valid ${country.name} phone number.`);
      return;
    }

    if (reservedAt.getTime() < Date.now()) {
      toast.error("Please pick a date and time in the future.");
      return;
    }

    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      toast.error("Guest count must be at least 1.");
      return;
    }

    /**
     * ⚠️ এই যাচাইটা server-এও আছে (route ৪০০ ফেরায়), আর এখানেও রাখা
     * হয়েছে ইচ্ছাকৃতভাবে — গ্রাহক আসন-সংখ্যা জানেন গ্রিডে ক্লিক
     * করার আগেই, তাই ভুলটা সাথে সাথে ধরিয়ে দেওয়া ভালো। server-এর
     * যাচাইটাই আসল; এটা কেবল সৌজন্য।
     */
    if (selectedTable && guestCount > selectedTable.capacity) {
      toast.error(`${selectedTable.label} seats a maximum of ${selectedTable.capacity}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tableId,
        customerName: fullName.trim(),
        // ⚠️ E.164-এ পাঠানো (+8801712345678), যা গ্রাহক টাইপ করেছেন
        // তা নয় — DB-তে সব নম্বর একই আকারে থাকা দরকার, নাহলে "একই
        // গ্রাহক" খোঁজা অসম্ভব।
        phone: e164,
        email: email.trim(),
        guestCount,
        reservedAt: reservedAt.toISOString(),
        specialRequests: requests.trim() || null,
      };

      /**
       * ⚠️ দুটো আলাদা endpoint, একটাতে flag নয়।
       *
       * অগ্রিম থাকলে reservation তৈরি হয় PENDING হিসেবে আর গ্রাহক
       * Stripe-এ যান; না থাকলে সরাসরি CONFIRMED। দুটো ভিন্ন ফল আর
       * ভিন্ন ব্যর্থতার ধরন, তাই একটা route-এ `if (deposit)` লিখলে
       * সেখানে দুটো অসম্পর্কিত প্রবাহ জড়িয়ে থাকত।
       */
      const res = await fetch(
        needsDeposit ? "/api/reservations/deposit-session" : "/api/reservations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        // ৪০৯ = ইতিমধ্যে কেউ ওই সময়ে টেবিলটা নিয়ে নিয়েছেন।
        throw new Error(data?.error ?? "Couldn't book this table.");
      }

      if (needsDeposit) {
        /**
         * ⚠️ `window.location.href`, `router.push` নয় — Stripe-এর
         * পাতাটা সম্পূর্ণ আলাদা origin, আর Next-এর client router
         * বাইরের URL সামলায় না। Carts.tsx-এও একই কারণে full
         * navigation করা হয়।
         *
         * ⚠️ `setSubmitting(false)` ডাকা হয় না — পাতাটা এখনই চলে
         * যাচ্ছে, আর বোতামটা আবার সক্রিয় করলে দ্বিতীয় ক্লিকে দ্বিতীয়
         * একটা PENDING reservation তৈরি হতে পারত।
         */
        window.location.href = data.url;
        return;
      }

      toast.success(`${data.table.label} is booked. We've sent the details to ${email.trim()}.`);
      setShowSuccess(true);

      setFullName("");
      setPhone("");
      // ⚠️ `country` reset করা হয় না — একই গ্রাহক পরের booking-এও
      // একই দেশ থেকেই করবেন।
      setEmail("");
      setRequests("");
      setTableId("");
      // ⚠️ তারিখ/সময় রেখে দেওয়া হয় — একই সন্ধ্যায় দ্বিতীয় একটা টেবিল
      // বুক করাটা স্বাভাবিক, আর সেটা মুছে দিলে গ্রিডও নিরপেক্ষ হয়ে
      // যেত, অর্থাৎ সদ্য বুক করা টেবিলটা আর কমলা দেখাত না।
      setTables((prev) =>
        prev.map((t) => (t.id === data.tableId ? { ...t, available: false } : t))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't book this table.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 xl:gap-[60px]">
        {/* ── টেবিলের গ্রিড ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/**
            * ⚠️ ৩২০px-এ ৩ কলাম, Figma-র ৫ নয়। পাঁচটা ১২০px টাইল মানে
            * অন্তত ৬৪০px; সরু পর্দায় জোর করলে টাইলগুলো ~৫০px হতো আর
            * "T-10" লেখাটাই আঁটত না।
            */}
          <div className="grid grid-cols-3 gap-3 min-[480px]:grid-cols-4 md:grid-cols-5 md:gap-4">
            {loadingTables && tables.length === 0
              ? Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    /* ⚠️ উচ্চতাটা নিচের আসল টাইলের সাথে হুবহু মিলতে
                       হবে — নাহলে ছবি লোড হওয়ার মুহূর্তে পুরো গ্রিডটা
                       এক ঝটকায় লাফায়। */
                    className="h-[88px] animate-pulse rounded-[14px] bg-[#F9F6F3] md:h-[116px]"
                  />
                ))
              : tables.map((table, index) => {
                  const booked = table.available === false;
                  const selected = table.id === tableId;

                  return (
                    <motion.button
                      key={table.id}
                      type="button"
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.4, ease: EASE, delay: index * 0.04 }}
                      onClick={() => setTableId(booked ? "" : table.id)}
                      disabled={booked}
                      aria-pressed={selected}
                      /**
                       * ⚠️ উচ্চতা ৭২/৯০ ছিল — টাইলগুলো চ্যাপ্টা দেখাত,
                       * কারণ প্রস্থ (৫ কলামে ~২৩০px) উচ্চতার প্রায়
                       * তিনগুণ। ৮৮/১১৬-তে অনুপাতটা Figma-র কাছাকাছি
                       * আসে, আর ভেতরের লেখাটাও ঘিরে বেশি জায়গা পায়।
                       *
                       * ⚠️ উপরের skeleton-এর উচ্চতাও একই — দুটো আলাদা
                       * হলে ছবি লোড হওয়ার মুহূর্তে গ্রিডটা লাফাত।
                       */
                      className={`flex h-[88px] items-center justify-center rounded-[14px] font-frank-ruhl text-[22px] font-semibold transition-colors md:h-[116px] md:text-[26px] ${
                        booked
                          ? "cursor-not-allowed bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white opacity-90"
                          : selected
                            ? "bg-black text-white"
                            : "bg-[#F9F6F3] text-black hover:bg-black/[0.06]"
                      }`}
                    >
                      {table.label}
                    </motion.button>
                  );
                })}
          </div>

          {/**
            * Figma-র দুটো indicator। তৃতীয়টা (কালো = বাছা) নকশায় নেই,
            * কিন্তু ছাড়া উপায় ছিল না: গ্রিডে ক্লিক করে টেবিল বাছা
            * যায়, আর কোনটা বাছা হয়েছে সেটা না বোঝালে ক্লিকটার কোনো
            * দৃশ্যমান ফলই থাকত না।
            */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Indicator className="bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]">
              Booked Table Indicator
            </Indicator>
            <Indicator className="bg-[#F9F6F3] ring-1 ring-inset ring-black/10">
              Free Table Indicator
            </Indicator>
            <Indicator className="bg-black">Your Selection</Indicator>
          </div>

          {!reservedAt && (
            /* ⚠️ এটা না লিখলে গ্রাহক ভাবতেন সব টেবিলই খালি — অথচ
               তারিখ ছাড়া আমরা জানিই না। */
            <p className="font-sora text-[12px] leading-[1.6] text-black/50">
              Pick a date and time below to see which tables are still free.
            </p>
          )}
        </div>

        {/* ── ফর্ম ───────────────────────────────────────────────── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto flex w-full max-w-[600px] flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-5 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <h2 className="font-frank-ruhl text-[22px] font-semibold leading-none text-black md:text-[26px]">
              Reserve Your Table
            </h2>
            <p className="font-sora text-[12px] leading-[1.6] text-black/50">
              Fill in your details and we&apos;ll confirm your reservation by email.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <Field label="Full Name" required htmlFor="res-name">
              <input
                id="res-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className={INPUT}
              />
            </Field>

            <Field label="Phone Number" required htmlFor="res-phone">
              {/**
                * পতাকা + দেশের কোড + নম্বর, সব এক ঘরে — register পাতা
                * আর Staff modal-এর হুবহু একই গড়ন।
                *
                * ⚠️ `CountryCodeSelect`-এর নিজের ডান পাড়টা
                * (`border-r`) পুরো উচ্চতা জুড়ে যায়, কিন্তু নকশার
                * রেখাটা ছোট আর ভেতরের দিকে বসানো। component-টা আরও
                * দুটো পাতা ব্যবহার করে, তাই ওখানে হাত না দিয়ে এখানেই
                * পাড়টা নিভিয়ে (`[&_button]:border-r-0`) নিজের রেখা
                * বসানো হলো — StaffFormModal-এও ঠিক এটাই করা আছে।
                *
                * ⚠️ `overflow-hidden` ইচ্ছাকৃতভাবে নেই: থাকলে দেশের
                * dropdown-টা ঘরের কিনারায় কেটে যেত।
                */}
              {/**
                * ⚠️ বাইরের বাক্সে `pl-3` নেই, padding-টা ভেতরের
                * বোতামে (`[&_button]:pl-3`)।
                *
                * কারণ CountryCodeSelect-এর dropdown-টা `absolute
                * left-0`, অর্থাৎ **তার নিজের** মোড়ক ধরে বসে। বাইরে
                * padding দিলে ওই মোড়কটা ১২px ভেতরে সরে যেত, আর
                * dropdown-ও সেই ১২px ডানে — ঘরের বাঁ কিনারার সাথে আর
                * মিলত না। padding ভেতরে নিলে মোড়কটা ঠিক ঘরের কিনারা
                * থেকেই শুরু হয়, তাই `left-0` মানেই সারিবদ্ধ।
                */}
              <div className="flex h-[46px] items-stretch rounded-[12px] border border-black/10 bg-white focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                <div className="flex shrink-0 items-stretch [&_button]:border-r-0 [&_button]:pl-3 [&_button]:pr-0 [&_button]:text-[13px]">
                  <CountryCodeSelect value={country} onChange={setCountry} />
                </div>
                <span className="my-auto ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
                <input
                  id="res-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  /* অক্ষর/চিহ্ন টাইপ করার সময়েই ফেলে দেওয়া। এখানে
                     আর "+" রাখা হয় না — দেশের কোডটা পাশের select-এ,
                     তাই নম্বরের ঘরে কেবল সংখ্যা। */
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder={examplePhone(country.code) || "Phone number"}
                  className="min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[14px] leading-none text-black placeholder:text-black/35 focus:outline-none"
                />
              </div>
            </Field>
          </div>

          <Field label="Email Address" required htmlFor="res-email">
            <input
              id="res-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={INPUT}
            />
          </Field>

          {/**
            * ⚠️ native `<input type="date">` আর `<input type="time">`
            * ছিল — দুটোই বদলানো হলো।
            *
            * browser ওদের popup নিজে আঁকে (Windows-এ নীল ক্যালেন্ডার,
            * ঘড়ির চাকা), আর সেটা CSS-এর নাগালের বাইরে। `DateField`
            * প্রজেক্টেরই নিজের ক্যালেন্ডার, কোনো বাইরের CSS ছাড়া, আর
            * তার popup-এর খোলস `SelectField`-এর সাথে ভাগ করা — তাই
            * পাশাপাশি বসলে দুটো হুবহু এক দেখায়।
            */}
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div className="min-w-0">
              {/* ⚠️ label-এ হাতে `*` লেখা ছিল — সেটা সাধারণ লেখা, তাই
                  কালো দেখাত। `required` prop লাল তারাটা বসায়, আর সেই
                  একই তারা এখন Field()-এও (নিচে) — দুটো এক রঙ। */}
              <DateField
                id="res-date"
                label="Date"
                required
                value={date}
                onChange={setDate}
              />
              {/* ⚠️ অতীতের তারিখ DateField নিজে আটকায় না, তাই বার্তাটা
                  submit-এ (আর server-এও, সেটাই আসল)। */}
            </div>

            <div className="min-w-0">
              <SelectField
                id="res-time"
                label="Time"
                required
                value={time}
                onChange={setTime}
                options={[{ value: "", label: "Select a time" }, ...timeOptions]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div className="min-w-0">
              {/**
                * ⚠️ বুক হয়ে যাওয়া টেবিলগুলো তালিকা থেকেই **বাদ**,
                * disabled option হিসেবে নয়।
                *
                * SelectField-এ per-option disabled নেই, আর সেটা ভালোই
                * হলো: একটা ধূসর বিকল্প দেখিয়ে ক্লিক করতে না দেওয়ার
                * চেয়ে না দেখানোই পরিষ্কার। উপরের গ্রিডে ওরা এমনিতেই
                * কমলা হয়ে আছে, তাই তথ্যটা হারায় না।
                */}
              <SelectField
                id="res-table"
                label="Table Number"
                required
                value={tableId}
                onChange={setTableId}
                options={[
                  { value: "", label: "Select a table" },
                  ...tables
                    .filter((table) => table.available !== false)
                    .map((table) => ({
                      value: table.id,
                      label: `${table.label} · seats ${table.capacity}`,
                    })),
                ]}
              />
            </div>

            <div className="min-w-0">
              {/* ⚠️ তারা নেই — Figma-তেও "Ext. Guests"-এ নেই। ঘরটার
                  একটা ডিফল্ট মান (২) আছে আর কখনো খালি হতে পারে না,
                  তাই "required" চিহ্নটা অর্থহীন হতো। */}
              <SelectField
                id="res-guests"
                label="Guests"
                value={guests}
                onChange={setGuests}
                options={guestOptions}
              />
              {selectedTable && (
                <p className="mt-1.5 font-sora text-[11px] text-black/50">
                  {selectedTable.label} seats up to {selectedTable.capacity}.
                </p>
              )}
            </div>
          </div>

          <Field label="Special Requests" htmlFor="res-requests" optional>
            <textarea
              id="res-requests"
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Birthday, wheelchair access, window seat…"
              className={`${INPUT} h-auto resize-y py-3`}
            />
          </Field>

          {/**
            * ⚠️ Figma-তে বোতামে লেখা "Advance Payment", কিন্তু এখানে
            * "Confirm Reservation" — আর এই বিচ্যুতিটা ইচ্ছাকৃত।
            *
            * কোনো টাকা নেওয়া হয় না। reservation তৈরি হয়ে সরাসরি
            * CONFIRMED হয়ে যায় (দেখুন /api/reservations POST), Stripe
            * ছোঁয়াই হয় না। "Advance Payment" লেখা একটা বোতাম চেপে
            * কোনো payment পর্দা না এলে গ্রাহক ভাববেন কিছু ভেঙেছে —
            * অথবা, আরও খারাপ, ভাববেন টাকা কেটে গেছে।
            *
            * সত্যিই অগ্রিম নিতে হলে যা লাগবে: Reservation-এ একটা
            * paymentStatus + stripeSessionId, একটা checkout session
            * route, আর webhook-এ সেটা মেলানো — অর্থাৎ gift card-এর
            * প্রবাহটার মতোই একটা আলাদা feature। সেটা না বানিয়ে শুধু
            * লেখাটা বসিয়ে দেওয়া মিথ্যা বলা।
            */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !canSubmit}
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]"
          >
            {submitting
              ? needsDeposit
                ? "Redirecting…"
                : "Booking…"
              : needsDeposit
                ? `Advance Payment · ${depositLabel}`
                : "Confirm Reservation"}
          </button>

          {/**
            * ⚠️ Figma-তে "Credit card / debit card" নামে একটা ধাপ আঁকা
            * ছিল — Cardholder name, Card number, CCV। সেটা বানানো
            * হয়নি, আর বানানো উচিতও নয়।
            *
            * নিজের ফর্মে কার্ডের নম্বর নেওয়া মানে সেটা আপনার browser,
            * server আর log-এ ঢোকা — অর্থাৎ PCI-DSS-এর SAQ D স্তর,
            * বছরে একটা নিরীক্ষা আর কয়েক হাজার ডলার। Stripe ব্যবহারের
            * পুরো কারণটাই কার্ডের তথ্য না-ছোঁয়া।
            *
            * এই অ্যাপে সেটা সম্ভবও নয়: `@stripe/stripe-js` নেই, আর
            * next.config.ts-এর CSP-তে `script-src 'self'` — js.stripe.com
            * লোডই হবে না। ওই ফাইলের comment-এ লেখাই আছে: "Stripe is
            * redirect-only checkout, not Stripe Elements"।
            */}
          {needsDeposit && (
            <p className="text-center font-sora text-[11px] leading-[1.6] text-black/50">
              You&apos;ll pay the {depositLabel} deposit on Stripe&apos;s secure page. The rest is
              settled at the table.
            </p>
          )}
        </motion.div>
      </div>

      {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}
    </section>
  );
}

/**
 * Figma-র "Congratulations!" — সাদা কার্ড, radius 30, padding 30।
 *
 * ⚠️ Figma-র illustration-টা ২০টার বেশি আলাদা vector (তারা, বিন্দু,
 * ফিতে)। সেগুলো এক-এক করে SVG-তে অনুবাদ না করে একটা সরল টিক-চিহ্ন
 * বসানো হয়েছে — একই রঙ, একই বৃত্ত, একই মাপ। আসল illustration-টা
 * চাইলে Figma থেকে SVG export করে `public/`-এ রেখে এখানে <Image>
 * বসিয়ে দিলেই হবে; বাকি layout বদলাতে হবে না।
 */
function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-success-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // ⚠️ backdrop-এ ক্লিক করলে বন্ধ — কিন্তু কার্ডের ভেতরে ক্লিক
      // যেন উপরে না ওঠে, তাই কার্ডে stopPropagation।
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-[555px] flex-col items-center gap-6 rounded-[30px] bg-white p-6 text-center md:gap-8 md:p-[30px]"
      >
        <span
          aria-hidden="true"
          className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-[#FEF0E3] md:h-[194px] md:w-[194px]"
        >
          <svg
            className="h-[70px] w-[70px] md:h-[96px] md:w-[96px]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="#FA7F12"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 6 66 14l18 2 2 18 8 16-8 16-2 18-18 2-16 8-16-8-18-2-2-18L4 66l8-16-2-18 18-2z" />
            <path d="M33 51l12 12 22-24" />
          </svg>
        </span>

        <div className="flex flex-col items-center gap-4 md:gap-5">
          <h2
            id="reservation-success-title"
            className="font-frank-ruhl text-[30px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[46px]"
          >
            Congratulations!
          </h2>
          <p className="font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
            Thank you for your reservation. We look forward to welcoming you with fresh flavors
          </p>
        </div>

        {/* ⚠️ Link, বোতাম নয় — এটা সত্যিই অন্য পাতায় নিয়ে যায়, তাই
            middle-click বা "নতুন ট্যাবে খুলুন" কাজ করা উচিত। */}
        <Link
          href="/"
          className="flex h-[46px] w-full items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}

/** ফর্মের ঘরগুলোর অভিন্ন চেহারা — cream নয়, সাদা, কারণ কার্ডটাই cream। */
const INPUT =
  "h-[46px] w-full rounded-[12px] border border-black/10 bg-white px-3.5 font-sora text-[14px] leading-none text-black placeholder:text-black/35 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

function Field({
  label,
  htmlFor,
  required,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-sora text-[12px] font-medium leading-none text-black"
      >
        {label}
        {/* ⚠️ তারাটা `aria-hidden` — screen reader-এ "asterisk" শোনার
            কোনো মানে নেই, আর ঘরগুলোয় এমনিতেই টেক্সট আছে। */}
        {required && <RequiredMark />}
        {optional && <span className="ml-1 font-normal text-black/40">(Optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Indicator({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-3.5 w-3.5 shrink-0 rounded-[4px] ${className}`} aria-hidden="true" />
      <span className="font-sora text-[12px] leading-none text-black/70">{children}</span>
    </span>
  );
}
