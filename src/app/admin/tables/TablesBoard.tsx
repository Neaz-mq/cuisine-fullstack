"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImagePlus, QrCode } from "lucide-react";
import { toast } from "react-toastify";
import QRCode from "qrcode";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";
import {
  DANGER_BUTTON,
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
} from "@/components/admin/modal-ui";

/** page.tsx থেকে যা আসে — Prisma row নয়, সাজানো একটা সরল আকার। */
export type TableRow = {
  id: string;
  label: string;
  name: string | null;
  capacity: number;
  isActive: boolean;
  imageUrl: string | null;
  /** আজকের ও তার পরের reservation-এর সংখ্যা। */
  upcomingCount: number;
  /** "21 Jul, 09:30" — server-এ সাজানো। কেন, তা page.tsx-এ। */
  nextReservationLabel: string | null;
};

const PAGE_SIZE = 15;

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

/**
 * শিরোনামের ডানের ছাঁকনি।
 *
 * ⚠️ native `<select>` ছিল, আর সেটাই বদলাতে হলো: browser নিজের OS-এর
 * dropdown আঁকে (Windows-এ নীল highlight, চৌকো কোণ), অর্থাৎ পাতার
 * বাকি সবকিছুর সাথে বেমানান। `appearance-none` কেবল **বন্ধ** ঘরটার
 * চেহারা বদলায়, খোলা তালিকাটার নয় — ওটা CSS-এর নাগালের বাইরে।
 *
 * FilterMenu একটা সাধারণ popup, তাই পুরোটাই নিজেদের নিয়ন্ত্রণে —
 * আর Overview-র "Today" pill-টাও ঠিক এটাই।
 */
const STATUS_OPTIONS: FilterMenuOption<StatusFilter>[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

/**
 * Figma-র "Seating Capacity" চিপগুলো।
 *
 * ⚠️ "10+" মানে ঠিক ১০, "১০ বা তার বেশি" নয় — `capacity` একটা Int,
 * তাই একটা মান বসাতেই হয়। চিপে "10+" লেখা থাকে কারণ নকশায় তাই, কিন্তু
 * তার চেয়ে বড় টেবিল থাকলে নিচের "Custom" ঘরে সংখ্যাটা লেখা যায় —
 * নাহলে ১২ আসনের টেবিল এই পর্দা দিয়ে বানানোই যেত না।
 */
const CAPACITY_PRESETS = [2, 4, 6, 8, 10];

/**
 * src/app/admin/tables/TablesBoard.tsx
 *
 * Figma "Tables" — সাদা কার্ডের ভেতরে টেবিলের গ্রিড, উপরে ছাঁকনি,
 * নিচে পাতা-বদল, আর দুটো modal (নতুন টেবিল, টেবিলের ছবি)।
 *
 * ⚠️ পুরো তালিকাটা **client-এ** আসে আর ছাঁকা/পাতা-বদল এখানেই হয় —
 * প্রতিটা ছাঁকনিতে server round-trip হয় না।
 *
 * কারণটা মাপে: একটা রেস্তোরাঁয় টেবিল থাকে ১০–৫০টা, ৫০০০ নয়। পুরোটা
 * একবারে পাঠানো কয়েক কিলোবাইট, আর তাতে ছাঁকনি বদলানো তাৎক্ষণিক হয়।
 * Orders তালিকায় উল্টোটা করা হয়েছে (server-side pagination), কারণ
 * সেখানে সারির সংখ্যা বাড়তেই থাকে।
 *
 * ⚠️ নতুন/সম্পাদিত টেবিল সেভ হলে `router.refresh()` — আশাবাদী বদল নয়।
 * label unique, তাই server ৪০৯ ফেরত দিতে পারে; "হয়ে গেছে" দেখিয়ে
 * পরে সরিয়ে নেওয়ার চেয়ে অপেক্ষা করা ভালো।
 */
export default function TablesBoard({ tables }: { tables: TableRow[] }) {
  const router = useRouter();

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  /** null = বন্ধ, "new" = নতুন, নাহলে সম্পাদনার টেবিলটা। */
  const [editing, setEditing] = useState<TableRow | "new" | null>(null);
  const [imaging, setImaging] = useState<TableRow | null>(null);

  /**
   * ⚠️ এখানে কেবল **অবস্থার** ছাঁকনি। নাম/নম্বর দিয়ে খোঁজাটা
   * TablesToolbar-এ, URL-এর `?q=` ধরে — অর্থাৎ `tables` prop-টা
   * ইতিমধ্যেই খোঁজা-ছাঁকা হয়ে আসে।
   *
   * দুটো আলাদা জায়গায় কেন: খোঁজাটা share/bookmark করার মতো জিনিস আর
   * Export-ও ওটাই forward করে, তাই সেটা URL-এ। Active/Inactive নিছক
   * তাকিয়ে দেখার ছাঁকনি — URL-এ তুললে প্রতিবার একটা server round-trip
   * হতো, অথচ পুরো তালিকা এমনিতেই client-এ আছে।
   */
  const filtered = useMemo(
    () =>
      tables.filter((table) => {
        if (filter === "ACTIVE" && !table.isActive) return false;
        if (filter === "INACTIVE" && table.isActive) return false;
        return true;
      }),
    [tables, filter]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // ⚠️ ছাঁকনি বদলে তালিকা ছোট হলে বর্তমান পাতাটা আর থাকতে পারে না।
  // state-এ page ঠিক করার বদলে এখানে চেপে দেওয়া হয় — নাহলে একটা
  // effect লাগত, আর render-এর সময় এক ফ্রেমের জন্য খালি পাতা দেখাত।
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      {/* ── তালিকা ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        {/**
          * ⚠️ সব মাপেই এক সারি, `flex-col` থেকে শুরু নয়।
          *
          * আগে ভেতরে একটা search ঘরও ছিল, তাই সরু পর্দায় ভাঙা দরকার
          * হতো। search এখন TablesToolbar-এ চলে গেছে, বাকি রইল একটা
          * শিরোনাম আর একটা ছোট pill — ৩২০px-এও ওরা পাশাপাশি বসে, আর
          * ভাঙলে বরং pill-টা একা একটা সারি নিত। Categories-এর একই
          * সারিটাও তাই।
          */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[20px] font-semibold leading-none text-black min-[480px]:text-[24px]">
            Tables
          </h2>

          {/**
            * Figma: শিরোনামের ডানে একটা "All" dropdown।
            *
            * ⚠️ `surface="cream"` — pill-টা বসছে **সাদা** কার্ডের উপরে।
            * উল্টোটা দিলে pill পটভূমির সাথে মিশে কার্যত অদৃশ্য হতো
            * (FilterMenu-র `surface` prop-এর ব্যাখ্যা দ্রষ্টব্য)।
            *
            * ⚠️ ছাঁকনি বদলালে page ১-এ ফেরত। নাহলে কেউ ৩ নম্বর পাতায়
            * থেকে "Inactive" বাছলে হয় খালি পাতা দেখতেন (নতুন ফলে ৩
            * নম্বর পাতা নেই), নয়তো ফলের মাঝখান থেকে শুরু।
            */}
          <FilterMenu
            surface="cream"
            value={filter}
            options={STATUS_OPTIONS}
            onSelect={(next) => {
              setFilter(next);
              setPage(1);
            }}
            ariaLabel="Filter tables by status"
          />
        </div>

        {visible.length === 0 ? (
          <p className="rounded-[16px] bg-[#F9F6F3] px-4 py-10 text-center font-sora text-[13px] text-black/50">
            {/* ⚠️ `tables` ইতিমধ্যেই খোঁজা-ছাঁকা হয়ে আসে, তাই এটা খালি
                হওয়ার মানে হয় সত্যিই কোনো টেবিল নেই, নয়তো খোঁজায় কিছু
                মেলেনি — দুটো আলাদা কথা, আর staff-কে জানানো দরকার
                কোনটা। */}
            {tables.length === 0
              ? "No tables match your search — or there are no tables yet."
              : "No tables match this status filter."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-3">
            {visible.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onEdit={() => setEditing(table)}
                onImage={() => setImaging(table)}
              />
            ))}
          </div>
        )}

        {/* ── পাতা-বদল ─────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-black/10 pt-4 min-[560px]:flex-row">
            <p className="font-sora text-[12px] text-black/50">
              Showing{" "}
              <span className="font-medium text-black">
                {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of <span className="font-medium text-black">{filtered.length}</span> tables
            </p>

            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setPage(number)}
                    aria-current={number === safePage ? "page" : undefined}
                    className={`h-8 min-w-8 rounded-full px-2 font-sora text-[12px] font-medium transition-colors ${
                      number === safePage
                        ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                        : "bg-[#F9F6F3] text-black/60 hover:text-black"
                    }`}
                  >
                    {number}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────── */}
      {editing && (
        <TableFormModal
          table={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {imaging && (
        <TableImageModal
          table={imaging}
          onClose={() => setImaging(null)}
          onSaved={() => {
            setImaging(null);
            router.refresh();
          }}
        />
      )}

      {/**
        * ⚠️ "Add Table" বোতামটা page.tsx-এর header-এ, কিন্তু modal-টা
        * এখানে — তাই বোতামটা এই state-এ পৌঁছবে কীভাবে?
        *
        * একটা লুকানো বোতাম দিয়ে, যেটা header-এর বোতাম `aria-controls`
        * নয়, সরাসরি `id` ধরে click করে। বিকল্প ছিল পুরো header-টাকেই
        * client component করা — কিন্তু তাতে session আর তারিখ prop
        * করে পাঠাতে হতো শুধু একটা বোতামের জন্য।
        */}
      <button
        id="admin-tables-add-trigger"
        type="button"
        className="sr-only"
        onClick={() => setEditing("new")}
      >
        Add table
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// কার্ড
// ---------------------------------------------------------------------------

function TableCard({
  table,
  onEdit,
  onImage,
}: {
  table: TableRow;
  onEdit: () => void;
  onImage: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  /**
   * QR — সম্পূর্ণ browser-এ তৈরি, কোনো বাইরের API নয়।
   *
   * ⚠️ `window.location.origin` ক্লিকের সময় পড়া হয়, hardcode করা
   * base URL নয় — তাই localhost থেকে ছাপলে localhost, আর production
   * থেকে ছাপলে আসল domain-ই QR-এ যায়। পুরোনো QrDownloadButton-এও
   * ঠিক এই যুক্তি ছিল।
   */
  async function downloadQr() {
    setDownloading(true);
    try {
      const url = `${window.location.origin}/dine-in?table=${table.id}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#2C6252", light: "#FFFFFF" },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-${table.label.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.click();
    } catch {
      toast.error("Couldn't generate the QR code.");
    } finally {
      setDownloading(false);
    }
  }

  function remove() {
    // ⚠️ confirm() — এই একটা কাজ ফেরানো যায় না, আর টেবিলের সাথে তার
    // reservation-ও যায়। পুরোনো DeleteTableButton-এও এটাই ছিল।
    if (!window.confirm(`Delete ${table.label}? This can't be undone.`)) return;

    startTransition(async () => {
      const res = await fetch(`/api/admin/tables/${table.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`${table.label} deleted.`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't delete this table.");
      }
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-[20px] bg-[#F9F6F3] p-4">
      {/* উপরের সারি: নাম + আসন, ডানে দুটো গোল বোতাম আর অবস্থা। */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
            {table.label}
            {table.name && (
              <span className="ml-1.5 font-sora text-[12px] font-normal text-black/50">
                {table.name}
              </span>
            )}
          </h3>
          <span className="font-sora text-[12px] leading-none text-black/70">
            Seats {table.capacity}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton label={`Set an image for ${table.label}`} onClick={onImage}>
            <ImagePlus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          </IconButton>

          <IconButton
            label={`Download the QR code for ${table.label}`}
            onClick={downloadQr}
            disabled={downloading}
          >
            <QrCode className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          </IconButton>

          {/**
            * ⚠️ এটা একটা লেবেল, বোতাম নয় — চাপলে কিছু হয় না।
            *
            * Active/Inactive বদলানোর জায়গা Edit modal-এর Status ঘরটা।
            * কার্ডে ক্লিকযোগ্য রাখলে ভুল করে একটা টেবিল নিষ্ক্রিয়
            * হয়ে যেত, আর তার QR কোডটা তখনই অকেজো — অথচ সেটা হয়তো
            * ছাপা হয়ে টেবিলের উপরেই বসে আছে।
            */}
          <span
            className={`rounded-full px-2 py-1 font-sora text-[10px] font-medium leading-none ${
              table.isActive ? "bg-[#2C6252]/10 text-[#2C6252]" : "bg-black/[0.06] text-black/40"
            }`}
          >
            {table.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* ছবি থাকলে — Figma-তে নেই, কিন্তু ছবি বসানোর সুযোগ দেওয়ার পর
          সেটা কোথাও দেখানো না হলে বসানোর মানেই থাকে না। */}
      {table.imageUrl && (
        <div className="relative h-20 w-full overflow-hidden rounded-[12px] bg-black/5">
          <Image
            src={table.imageUrl}
            alt={`${table.label}`}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 560px) 40vw, 90vw"
            className="object-cover"
          />
        </div>
      )}

      {/* reservation সারি — সাদা pill। */}
      <div className="flex items-center gap-2 rounded-full bg-white px-2 py-1.5">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black font-sora text-[10px] font-medium text-white"
        >
          {table.upcomingCount}
        </span>
        <span className="min-w-0 truncate font-sora text-[11px] leading-none text-black/70">
          {table.nextReservationLabel
            ? `Next: ${table.nextReservationLabel}`
            : "No upcoming reservations"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className={`${OUTLINE_BUTTON} h-9 flex-1 text-[13px] min-[640px]:text-[13px]`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className={`${DANGER_BUTTON} h-9 flex-1 text-[13px] min-[640px]:text-[13px]`}
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </article>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit modal
// ---------------------------------------------------------------------------

function TableFormModal({
  table,
  onClose,
  onSaved,
}: {
  table: TableRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(table?.label ?? "");
  const [name, setName] = useState(table?.name ?? "");
  const [capacity, setCapacity] = useState(table?.capacity ?? 4);
  const [isActive, setIsActive] = useState(table?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // preset-এর বাইরের আসনসংখ্যা (যেমন ১২) থাকলে "Custom" ঘরটা খোলা
  // অবস্থায় শুরু হয় — নাহলে সম্পাদনার সময় মানটা উধাও মনে হতো।
  const [customOpen, setCustomOpen] = useState(
    table ? !CAPACITY_PRESETS.includes(table.capacity) : false
  );

  async function save() {
    if (!label.trim()) {
      setError("Table number is required.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      setError("Seating capacity must be at least 1.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        table ? `/api/admin/tables/${table.id}` : "/api/admin/tables",
        {
          method: table ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            // ⚠️ ফাঁকা string নয়, null — ডাকনাম মুছে ফেলা আর কখনো না
            // দেওয়া, DB-তে দুটোই একই হওয়া উচিত।
            name: name.trim() || null,
            capacity,
            isActive,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save this table.");
      }

      toast.success(table ? `${label.trim()} updated.` : `${label.trim()} added.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this table.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      titleId="table-form-modal"
      title={table ? "Edit Table" : "Add New Table"}
      footer={
        <div className="flex flex-col gap-3 min-[480px]:flex-row">
          <button type="button" onClick={onClose} className={`${OUTLINE_BUTTON} flex-1`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {saving ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="table-label" className={LABEL}>
            Table Number
          </label>
          <input
            id="table-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="T-16"
            className={FIELD}
          />
          {/* ⚠️ label QR কোডে যায় আর রান্নাঘরের টিকিটে ছাপা হয়, তাই
              এটাই আসল শনাক্তকারী — আর সেটা unique। */}
          <p className="mt-1.5 font-sora text-[11px] leading-[1.5] text-black/50">
            Printed on the QR code and kitchen tickets. Must be unique.
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="table-name" className={LABEL}>
            Table Name
          </label>
          <input
            id="table-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Window Table"
            className={FIELD}
          />
          <p className="mt-1.5 font-sora text-[11px] leading-[1.5] text-black/50">
            Optional, just for staff. Two tables can share a name.
          </p>
        </div>
      </div>

      {/* Seating Capacity — Figma-র চিপগুলো। */}
      <div>
        <span className={LABEL}>Seating Capacity</span>
        <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-5">
          {CAPACITY_PRESETS.map((preset) => {
            const selected = !customOpen && capacity === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCapacity(preset);
                  setCustomOpen(false);
                }}
                className={`flex h-[43px] items-center justify-center rounded-[12px] font-sora text-[14px] font-medium transition-colors ${
                  selected
                    ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    : "bg-[#F9F6F3] text-black/70 hover:text-black"
                }`}
              >
                {preset === 10 ? "10+" : preset}
              </button>
            );
          })}
        </div>

        {/**
          * ⚠️ Figma-তে এই ঘরটা নেই, কিন্তু ছাড়া উপায়ও ছিল না।
          *
          * `capacity` একটা Int, আর চিপগুলো মোটে পাঁচটা মান দেয়।
          * "10+" চিপটা আসলে ঠিক ১০ বসায়। এই ঘর না থাকলে ১২ আসনের
          * একটা টেবিল এই পর্দা দিয়ে বানানোই যেত না — অথচ পুরোনো
          * ফর্মে সেটা যেত।
          */}
        {customOpen ? (
          <div className="mt-2">
            <label htmlFor="table-capacity" className="sr-only">
              Custom seating capacity
            </label>
            <input
              id="table-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(parseInt(event.target.value, 10) || 0)}
              className={FIELD}
              placeholder="Seats"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-2 font-sora text-[12px] font-medium text-[#FF7100] hover:underline"
          >
            Enter another number
          </button>
        )}
      </div>

      <SelectField
        id="table-status"
        label="Status"
        value={isActive ? "ACTIVE" : "INACTIVE"}
        onChange={(value) => setIsActive(value === "ACTIVE")}
        options={[
          { value: "ACTIVE", label: "Active" },
          { value: "INACTIVE", label: "Inactive" },
        ]}
      />

      {/* ⚠️ নিষ্ক্রিয় করার ফলটা আগেই বলে দেওয়া — ছাপা QR কোড হঠাৎ
          কাজ না করলে staff বুঝতেই পারতেন না কেন। */}
      {!isActive && (
        <p className="rounded-[12px] bg-[#FF9540]/10 px-3 py-2 font-sora text-[12px] leading-[1.5] text-[#9A5B12]">
          An inactive table can&apos;t be reserved, and its printed QR code stops working.
        </p>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Image modal
// ---------------------------------------------------------------------------

function TableImageModal({
  table,
  onClose,
  onSaved,
}: {
  table: TableRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(table.imageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save the image.");
      }
      toast.success(`${table.label} image updated.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      titleId="table-image-modal"
      title="Add Table Image"
      footer={
        <div className="flex flex-col gap-3 min-[480px]:flex-row">
          <button type="button" onClick={onClose} className={`${OUTLINE_BUTTON} flex-1`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            // ⚠️ আপলোড চলাকালীন সেভ বন্ধ — নাহলে পুরোনো URL (বা null)
            // লিখে দিয়ে সদ্য তোলা ছবিটা হারিয়ে যেত।
            disabled={saving || uploading}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {saving ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {/* ⚠️ modal-ui-র ImageDropzone — MenuItemForm আর staff avatar-ও
          এটাই ব্যবহার করে। নতুন করে লিখলে ২MB সীমা, ধরনের যাচাই আর
          টানা-ফেলা তিনটেই আলাদা করে রক্ষণাবেক্ষণ করতে হতো। */}
      <ImageDropzone
        value={imageUrl}
        onChange={setImageUrl}
        onError={setError}
        uploading={uploading}
        setUploading={setUploading}
      />
    </ModalShell>
  );
}
