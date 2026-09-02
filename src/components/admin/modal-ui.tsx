"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";

/**
 * src/components/admin/modal-ui.tsx
 *
 * Admin panel-এর modal-গুলো যে অংশগুলো ভাগ করে নেয়: কার্ডের খোলস,
 * ঘরের চেহারা, dropdown, ক্যালেন্ডার, ছবি upload।
 *
 * ⚠️ এটা আগে `app/admin/staff/staff-modal-ui.tsx` ছিল, কারণ তখন
 * কেবল Staff-এর তিনটে modal এটা ব্যবহার করত। এখন Suppliers-ও করে,
 * আর একটা পাতার ফোল্ডার থেকে আরেকটা পাতা import করা মানে দুটোর
 * মধ্যে একটা মিথ্যে নির্ভরতা — কেউ staff ফোল্ডার সরালে suppliers
 * ভেঙে যেত। তাই components/admin-এ।
 *
 * ── কেন আলাদা ফাইল ──────────────────────────────────────────────────
 *
 * "Add New Staff" modal-টা প্রথমে একটাই ফাইলে ছিল, আর সেটা তখন ঠিকই
 * ছিল — একটা modal, একটা ফাইল। কিন্তু এখন View আর Edit-ও modal, আর
 * তিনটেরই একই কার্ড, একই ঘর, একই dropdown। কপি করলে যা হয় সেটা এই
 * প্রজেক্টেই একবার হয়েছে: dashboard-এর তিনটে ছাঁকনি dropdown কপি করা
 * ছিল, Users page-এর নকশা বদলাতেই dashboard-এরগুলো নীরবে পিছিয়ে
 * পড়েছিল (দেখুন FilterMenu.tsx-এর মন্তব্য)। সেটা আবার হতে না দেওয়াই
 * এই ফাইলের কারণ।
 */

/**
 * Figma "Fill" — উচ্চতা 43, padding 12, radius 12, BG #F9F6F3, পাড় নেই,
 * লেখা Sora 400 12px LH 160%, placeholder Black/70।
 *
 * focus চিহ্নটা `ring-*` নয়, `outline` — Tailwind-এর ring একটা
 * দুই-স্তরের box-shadow যার প্রথম স্তর ডিফল্টে সাদা, আর cream ইনপুটের
 * কিনারায় সেই সাদা রেখাটা ফাঁক হয়ে ফুটে ওঠে। বিস্তারিত FilterMenu.tsx-এ।
 */
export const FIELD =
  "h-[43px] w-full text-ellipsis rounded-[12px] border-0 bg-[#F9F6F3] px-3 font-sora text-[12px] font-normal leading-[1.6] text-black placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

/**
 * Figma label: Frank Ruhl Libre 500, 14px, LH 160%, #000000, নিচে gap 6।
 *
 * ⚠️ ৬৪০-এর নিচে ১৩px, আর এটা প্রসাধন নয়। ৩২০px-এ modal-এর জোড়া-ঘরের
 * কলাম দাঁড়ায় ১২০px, অথচ সবচেয়ে লম্বা label "Permanent Address"
 * ১৪px Frank Ruhl-এ ১২৪.৮px — অর্থাৎ দুই লাইনে ভাঙত, আর পাশের "NID
 * Number" এক লাইনে থাকায় দুটো ঘর উঁচু-নিচু হয়ে যেত। ১৩px-এ ওটা
 * ১১৫.৯px, ১২০-এর ভেতরে স্বস্তিতে আঁটে।
 */
export const LABEL =
  "mb-1.5 block font-frank-ruhl text-[13px] font-medium leading-[1.6] text-black min-[640px]:text-[14px]";

/**
 * Figma Frame 2147236023-এর বোতামজোড়া: উচ্চতা 46, Sora 600 16px।
 *
 * ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না। ওই utility মানে ঠিক
 * 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো গোলাপি।
 * Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে** — তাই ভেতরে শুধু
 * কমলা থেকে একটা নরম মাঝামাঝি রঙ দেখা যায়। সারির "View" বোতামেও
 * হুবহু এই একই gradient।
 */
/**
 * ⚠️ ৬৪০-এর নিচে লেখা ১৪px আর padding ১২ — নাহলে "Save Change"
 * দুই লাইনে ভেঙে যায়। ৩২০px-এ দুটো বোতাম পাশাপাশি, তাই প্রতিটার
 * ভাগে পড়ে (256 − 8)/2 = ১২৪px:
 *
 *   @16px + px-5 : 106.7 + 40 = 146.7  ❌
 *   @16px + px-3 : 106.7 + 24 = 130.7  ❌
 *   @14px + px-3 :  93.4 + 24 = 117.4  ✅
 *
 * `whitespace-nowrap`-টা জালের কাজ করে: ফন্ট লোড হওয়ার আগে fallback
 * দিয়ে মাপলে সামান্য চওড়া হয়, তখনও যেন এক লাইনেই থাকে।
 */
export const PRIMARY_BUTTON =
  "flex h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:opacity-60 min-[640px]:px-5 min-[640px]:text-[16px]";

export const OUTLINE_BUTTON =
  "flex h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-[90px] border border-black px-3 font-sora text-[14px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 min-[640px]:px-5 min-[640px]:text-[16px]";

export const DANGER_BUTTON =
  "flex h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-[90px] border border-[#D72A37] px-3 font-sora text-[14px] font-semibold leading-[1.3] text-[#D72A37] transition-colors hover:bg-[#D72A37] hover:text-white disabled:opacity-50 min-[640px]:px-5 min-[640px]:text-[16px]";

/* ══ কার্ডের খোলস ═══════════════════════════════════════════════════ */

/**
 * Figma Frame 2147236222 — তিনটে modal-এরই বাইরের কাঠামো।
 *
 *   কার্ড            padding 30, gap 40, radius 30, চওড়া 735
 *     └ content      column, gap 24
 *         ├ header   row space-between, উচ্চতা 32
 *         └ body     children
 *     └ footer       row, gap 8, উচ্চতা 46
 *
 * ⚠️ footer content-এর **ভেতরে নয়**, কার্ডের সরাসরি সন্তান — তাই
 * উপরের ফাঁকটা ৪০, ২০ বা ২৪ নয়। হিসাবটা মিলিয়ে দেখা যায়:
 * 30 + 700 + 40 + 46 + 30 = 846, অর্থাৎ Figma-র কার্ডের উচ্চতা।
 */
export function ModalShell({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Escape দিয়ে বন্ধ + খোলা অবস্থায় পেছনের পাতা scroll বন্ধ। দ্বিতীয়টা
  // না করলে mobile-এ modal-এর ভেতরে scroll করতে গিয়ে পেছনের তালিকাটা
  // সরে যেত, আর বন্ধ করার পর ব্যবহারকারী অন্য জায়গায় গিয়ে পড়তেন।
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      /**
       * ⚠️ `sm:` নয়, `min-[640px]:` — globals.css-এ
       * `--breakpoint-sm: 320px`, তাই `sm:p-6` কার্যত **৩২০px থেকেই**
       * চালু ছিল আর base `p-4` কোথাও খাটত না। ফলে ৩২০px পর্দায়
       * modal-টা পেত মাত্র 320 − 2×24 = ২৭২px, তার উপর কার্ডের নিজের
       * `sm:p-[30px]` — ভেতরে বাকি থাকত ২১২px। ওই সংকীর্ণতাতেই
       * শিরোনাম দুই লাইনে ভাঙত আর জোড়া-ঘরগুলো পাশাপাশি বসানো যেত না।
       */
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8 backdrop-blur-[2px] min-[640px]:p-6"
      // পটভূমিতে click করলে বন্ধ — কিন্তু কেবল পটভূমিতেই, তাই
      // `event.target === event.currentTarget`। নাহলে modal-এর ভেতরে
      // লেখা select করে mouse ছাড়লেও বন্ধ হয়ে যেত, আর তখন ভরাট করা
      // form-টা হারাত।
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* `data-modal-card` — dropdown/ক্যালেন্ডার popup এই কার্ডের
          সীমা মেপে নিজের উচ্চতা আর দিক ঠিক করে, যাতে কখনো কার্ড
          ছাড়িয়ে না যায়। বিস্তারিত useMenuPlacement-এ। */}
      <div
        data-modal-card
        /* Figma Frame 2147236222 (৩২০px): padding 16, gap 40, radius 16।
           padding ১৬ হওয়ায় ভেতরে থাকে 320 − 2×16 (overlay) − 2×16
           = ২৫৬px — জোড়া-ঘরের প্রতিটা কলাম ১২০px, যা Figma-র বিন্যাসটা
           ধরে রাখার জন্য যথেষ্ট। */
        className="my-auto flex w-full max-w-[735px] flex-col gap-10 rounded-[30px] bg-white p-4 min-[640px]:p-[30px]"
      >
        <div className="flex flex-col gap-6">
          {/* Frame 2147236476: row, space-between, align center, উচ্চতা 32।
              শিরোনাম Frank Ruhl Libre 600, 28px, LH 114%, tracking −0.01em। */}
          <div className="flex items-center justify-between gap-4">
            <h2
              id={titleId}
              /* ⚠️ আবার সেই `sm:` ফাঁদ — ২৮px ৩২০px-এও চালু ছিল, আর
                 "Add New Staff" ২৮px Frank Ruhl-এ ১৭৬.৭px, বন্ধ-বোতাম
                 (৪০) আর gap (১৬) সহ ২৩২.৭px — তখনকার ২১২px-এর ঘরে
                 আঁটত না, তাই দুই লাইন। ২২px-এ ওটা ১৩৮.৯px, মোট ১৯৪.৯ —
                 এখনকার ২৫৬px-এ এক লাইনেই ধরে। */
              className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black min-[640px]:text-[28px]"
            >
              {title}
            </h2>
            {/* Frame 2147236477: 40×40, BG #F9F6F3, radius 100,
                icon 24×24 stroke 1.5 (Figma-তে এটা "add" আইকন ৪৫°
                ঘোরানো — অর্থাৎ হুবহু একটা ✕)। */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
            >
              <X className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          {/* Frame 2147236300: column, gap 20। */}
          <div className="flex flex-col gap-5">{children}</div>
        </div>

        {footer}
      </div>
    </div>
  );
}

/** modal-এর ভেতরের ভুল-বার্তা — তিনটে modal-এই এক চেহারা। */
export function ModalError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[12px] bg-red-50 px-3 py-2.5 font-sora text-[12px] leading-[1.6] text-red-600"
    >
      {message}
    </p>
  );
}

/* ══ popup-এর সাধারণ অংশ ════════════════════════════════════════════ */

/** trigger আর popup-এর মাঝের ফাঁক (`mt-2` / `mb-2`)। */
const MENU_GAP = 8;
/**
 * তালিকা-popup-এর সর্বোচ্চ উচ্চতা: padding 16×2 + তিনটে item (34) +
 * দুটো gap (6) = ১৪৬। অর্থাৎ তিনটে পুরো দেখা যায়, চতুর্থটা থেকে scroll।
 *
 * ⚠️ তিনটে, পাঁচ-ছয়টা নয় — Role-এ ছ'টা অপশন, আর ছ'টা দেখাতে গেলে
 * popup-টা ২৭০px লম্বা হতো, যা modal-এর ভেতরে কোথাও আঁটে না। "কম
 * দেখাও, scroll করতে দাও" এখানে "বেশি দেখাও, কার্ড ছাড়িয়ে যাও"-এর
 * চেয়ে ভালো।
 */
const MENU_MAX_HEIGHT = 146;
/**
 * ক্যালেন্ডারের আনুমানিক উচ্চতা: padding 32 + header 32 + সপ্তাহের নাম
 * 16 + ছ'টা সারি × 32 + ফাঁকগুলো ≈ ২৯০।
 *
 * ⚠️ এটা কেবল **জায়গা আছে কি নেই** বিচারের জন্য — ক্যালেন্ডারে
 * `maxHeight` বসানো হয় না। একটা scroll করা ক্যালেন্ডার ব্যবহারের
 * অযোগ্য (মাসের অর্ধেক লুকিয়ে থাকে), তাই জায়গা কম হলে সেটা ছোট না
 * হয়ে উল্টো দিকে খোলে।
 */
const CALENDAR_HEIGHT = 290;
/** কার্ডের কিনারা থেকে ন্যূনতম শ্বাস-ফাঁক। */
const MENU_EDGE_PADDING = 8;

/**
 * popup উপরে না নিচে খুলবে, আর সর্বোচ্চ কত লম্বা হবে।
 *
 * ── কেন এটা দরকার ──────────────────────────────────────────────────
 *
 * Shift, Status আর Join Date ঘরগুলো form-এর শেষ দিকে। তাদের নিচে
 * কার্ডের ভেতরে বাকি থাকে মাত্র ~১১৬px (gap 40 + বোতাম 46 + padding
 * 30)। ১৪৬px popup সেখানে আঁটে না — তাই সেটা কার্ড ছাড়িয়ে বাইরে ঝুলে
 * পড়ত। ক্যালেন্ডার আরও বড়, সমস্যাও আরও বড়।
 *
 * তাই খোলার ঠিক আগে কার্ডের সীমা মেপে নেওয়া হয়: নিচে জায়গা না থাকলে
 * popup **উপরে** খোলে, আর যেদিকেই খুলুক তার উচ্চতা ওই দিকের ফাঁকা
 * জায়গাটুকুতে সীমিত থাকে।
 *
 * ⚠️ মাপটা open হওয়ার **আগে** নেওয়া হয় (useLayoutEffect নয়) — নাহলে
 * popup আগে নিচে এঁকে তারপর উপরে লাফাত, আর সেই এক-ফ্রেমের ঝাঁকুনিটা
 * চোখে পড়ত।
 */
function useMenuPlacement(preferredHeight: number) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ up: false, maxHeight: preferredHeight });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const measure = () => {
    const wrapper = wrapperRef.current;
    const card = wrapper?.closest("[data-modal-card]");
    if (!wrapper || !card) return { up: false, maxHeight: preferredHeight };

    const trigger = wrapper.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();

    const below = bounds.bottom - trigger.bottom - MENU_GAP - MENU_EDGE_PADDING;
    const above = trigger.top - bounds.top - MENU_GAP - MENU_EDGE_PADDING;

    // নিচে পুরোটা আঁটলে নিচেই — উপরে খোলা ব্যবহারকারীর কাছে কম
    // প্রত্যাশিত, তাই সেটা কেবল দরকার হলেই।
    const up = below < preferredHeight && above > below;
    return {
      up,
      maxHeight: Math.max(0, Math.min(preferredHeight, up ? above : below)),
    };
  };

  const toggle = () => {
    if (!open) setPlacement(measure());
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    /**
     * ⚠️ Escape-টা capture phase-এ ধরা হয়, আর তারপর propagation থামিয়ে
     * দেওয়া হয়। কারণ ModalShell নিজেও document-এ Escape শোনে
     * (বন্ধ হওয়ার জন্য)। দুটোই bubble phase-এ থাকলে একবার Escape
     * চাপলেই popup আর modal দুটোই বন্ধ হয়ে যেত — অর্থাৎ ভুল করে
     * dropdown খুলে ফেললে পুরো ভরাট করা form-টা হারাতেন।
     *
     * document-এর capture-phase listener bubble-phase listener-এর আগে
     * চলে, আর সেখানে `stopPropagation()` ডাকলে event-টা আর bubble
     * phase-এ পৌঁছয়ই না।
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };

    // modal-টা লম্বা হলে overlay scroll করে, আর তখন ঘরটা কার্ডের ভেতরে
    // সরে যায় — খোলা অবস্থায় হিসাবটা বাসি হয়ে যেত। scroll capture
    // phase-এ ধরা হয় কারণ ঘটনাটা overlay-তে ঘটে, document-এ bubble
    // করে না।
    const reposition = () => setPlacement(measure());

    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { open, setOpen, toggle, placement, wrapperRef };
}

/**
 * popup কার্ডের চেহারা — FilterMenu.tsx-এর হুবহু: padding 16, radius 16,
 * BG #FFFFFF, ছায়া 0 4px 30px rgba(0,0,0,0.06)।
 *
 * ⚠️ চওড়া এখানে ২২৪px স্থির নয়, `left-0 right-0` — ঘরটার সমান।
 * ছাঁকনির popup ভাসে একটা ছোট pill-এর নিচে, তাই তার নিজের মাপ দরকার;
 * এটা ভাসে একটা পুরো-প্রস্থের form ঘরের নিচে, আর তার চেয়ে সরু হলে
 * সারিবদ্ধতা ভেঙে যেত।
 */
const MENU_SHELL =
  "absolute left-0 right-0 z-30 rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]";

/* ══ dropdown ═══════════════════════════════════════════════════════ */

/**
 * Role / Shift / Status / Employment type-এর ঘর।
 *
 * ── কেন native <select> নয় ──────────────────────────────────────────
 *
 * একটা জিনিস `appearance-none` দিয়ে বদলানো **যায় না**: খোলা তালিকাটা।
 * ওটা browser আঁকে, CSS পৌঁছয় না — তাই Windows/Chrome-এ চকচকে নীল
 * highlight, চৌকো কোণ, সাদা পটভূমি। modal-টা যত যত্ন করেই বানানো হোক,
 * dropdown খুললেই সেটা অন্য দশকের একটা widget হয়ে যেত।
 *
 * ⚠️ FilterMenu-টা সরাসরি ব্যবহার করা যায়নি, আর সেটা ইচ্ছাকৃত: ওটার
 * trigger একটা **ছাঁকনি pill** — hug প্রস্থ, উচ্চতা 40, radius 100।
 * এখানে trigger হলো নকশার "Fill" ঘর — পুরো প্রস্থ, উচ্চতা 43,
 * radius 12, উপরে label। অর্থাৎ শুধু popup-টাই এক, trigger নয়।
 */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  /**
   * grid-এ ঘরটা কতটা জায়গা নেবে। StaffFormModal-এর "Shift" আর
   * "Status" ৬৪০-এর নিচে পুরো প্রস্থ জোড়ে (Figma-র বিন্যাস), তাই
   * ওদের `col-span-2` পাঠাতে হয়। না দিলে আগের মতোই এক ঘর।
   */
  className?: string;
}) {
  const { open, setOpen, toggle, placement, wrapperRef } = useMenuPlacement(MENU_MAX_HEIGHT);

  // অজানা মান এলে প্রথমটায় পড়ে থাকে, যাতে ঘরটা খালি না দেখায় —
  // FilterMenu-র একই আচরণ।
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={className}>
      {/* label-টা <label> নয়, <span> — কারণ trigger একটা <button>, আর
          <label htmlFor> দিয়ে button-এ click পাঠানো ব্রাউজারভেদে
          অসামঞ্জস্যপূর্ণ। সম্পর্কটা বরং aria-labelledby দিয়ে বাঁধা। */}
      <span id={`${id}-label`} className={LABEL}>
        {label}
      </span>

      <div className="relative" ref={wrapperRef}>
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
          className={`${FIELD} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className="min-w-0 truncate">{selected.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-black/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>

        {open && (
          /* উচ্চতা আর দিক দুটোই run-time-এ মাপা — তাই `max-h-*` class
             নেই, inline style আছে। class দিয়ে করা যেত না, কারণ মানটা
             প্রতিবার আলাদা: একই component Role-এর জন্য নিচে ১৪৬px
             খোলে আর Status-এর জন্য উপরে ১২০px। */
          <ul
            role="listbox"
            aria-labelledby={`${id}-label`}
            style={{ maxHeight: placement.maxHeight }}
            className={`${MENU_SHELL} flex flex-col gap-1.5 overflow-y-auto overscroll-contain ${
              placement.up ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {options.map((option) => {
              const isSelected = option.value === selected.value;
              return (
                <li key={option.value || "none"} className="w-full">
                  {/* Figma item: উচ্চতা 34, padding 10, Sora 400 14px
                      #121212। বাছাই করাটা radius 100 + cream pill,
                      বাকিরা radius 12 (কেবল hover-এ চোখে পড়ে)। */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setOpen(false);
                      onChange(option.value);
                    }}
                    className={`flex h-[34px] w-full items-center p-2.5 text-left font-sora text-[14px] font-normal leading-none text-[#121212] transition-colors ${
                      isSelected
                        ? "rounded-full bg-[#F9F6F3]"
                        : "rounded-[12px] hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ══ তারিখ ══════════════════════════════════════════════════════════ */

/**
 * ⚠️ সব হিসাব **স্থানীয়** সময়ে, UTC-তে নয়।
 *
 * `new Date("2026-08-31")` কে JS তারিখ-মাত্র ISO string ধরে **UTC**
 * মধ্যরাত বানায়। ঢাকায় (UTC+6) সেটা ৩১ তারিখ ভোর ৬টা — ঠিক আছে।
 * কিন্তু UTC−5-এ সেটা ৩০ তারিখ সন্ধ্যা ৭টা, অর্থাৎ ক্যালেন্ডারে ৩০
 * highlight হতো যদিও ঘরে লেখা ৩১। তাই string-টা হাতে ভেঙে
 * `new Date(y, m, d)` — যেটা সবসময় স্থানীয় মধ্যরাত। একই কারণে ফেরত
 * দেওয়ার সময় `toISOString()` ব্যবহার করা হয় না।
 */
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Figma-র placeholder "07/24/2026" — অর্থাৎ MM/DD/YYYY। */
function formatDisplayDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Join Date — নকশার "Fill" ঘর + প্রজেক্টের নিজের ক্যালেন্ডার popup।
 *
 * ── কেন react-datepicker নয় (যদিও ইতিমধ্যেই dependency-তে আছে) ───────
 *
 * ওটা Reserve.tsx-এ ব্যবহার হয় নিজের ডিফল্ট CSS সহ
 * (`react-datepicker/dist/react-datepicker.css`) — একটা **global**
 * stylesheet, যার নিজস্ব চেহারা এই নকশার সাথে মেলে না। এখানে আনলে
 * প্রথমে ওই global CSS টানতে হতো, তারপর প্রায় প্রতিটা অংশ override
 * করে নকশায় ফেরাতে হতো, আর ঝুঁকিটা একমুখী নয়: ওই CSS তখন admin
 * bundle-এও ঢুকত এবং Reserve পাতার সাথে জড়িয়ে যেত। নিচের
 * ক্যালেন্ডারটা ~৬০ লাইন, কোনো নতুন CSS নেই, আর popup-এর খোলস
 * dropdown-এর সাথে ভাগ করা — তাই দুটো হুবহু এক দেখায়।
 */
export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, toggle, placement, wrapperRef } = useMenuPlacement(CALENDAR_HEIGHT);

  const selected = parseISODate(value);
  const today = new Date();

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  /**
   * প্রতিবার খোলার সময় বাছাই করা মাসে ফিরে আসা — নাহলে কেউ একবার
   * ২০২৪-এ গিয়ে বন্ধ করলে পরেরবার খুলেও সেখানেই পড়ে থাকত।
   *
   * ⚠️ এটা আগে একটা `useEffect`-এ ছিল (`if (!open) return; setViewMonth(…)`),
   * আর সেটা ভুল জায়গা — `react-hooks/set-state-in-effect` ঠিকই ধরেছে।
   * effect-এর কাজ React-এর বাইরের জগতের সাথে তাল মেলানো; এখানে বাইরের
   * কিছু নেই, শুধু একটা **ঘটনার** প্রতিক্রিয়া (ব্যবহারকারী ঘরটায় click
   * করলেন)। effect-এ রাখলে React আগে popup-টা পুরনো মাস নিয়ে render
   * করত, তারপর setState দেখে আবার render করত — একটা অপ্রয়োজনীয়
   * cascading render, আর তাত্ত্বিকভাবে এক ফ্রেমের জন্য ভুল মাস।
   * handler-এ রাখলে দুটোই একই render-এ মিটে যায়।
   */
  const handleToggle = () => {
    if (!open) {
      const base = parseISODate(value) ?? new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    toggle();
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  // `new Date(y, m + 1, 0)` = পরের মাসের "শূন্যতম" দিন = এই মাসের শেষ দিন।
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // মাসের ১ তারিখ সপ্তাহের কোন ঘরে পড়ে — তার আগের ঘরগুলো ফাঁকা।
  const leadingBlanks = new Date(year, month, 1).getDay();

  const shiftMonth = (delta: number) => setViewMonth(new Date(year, month + delta, 1));

  return (
    <div>
      <span id={`${id}-label`} className={LABEL}>
        {label}
      </span>

      <div className="relative" ref={wrapperRef}>
        <button
          id={id}
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-labelledby={`${id}-label`}
          className={`${FIELD} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className={`min-w-0 truncate ${selected ? "" : "text-black/70"}`}>
            {selected ? formatDisplayDate(selected) : "MM/DD/YYYY"}
          </span>
          <CalendarIcon
            className="h-3.5 w-3.5 shrink-0 text-black/70"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>

        {open && (
          /* ⚠️ এখানে `maxHeight` বসানো হয় না — একটা scroll করা
             ক্যালেন্ডার ব্যবহারের অযোগ্য। জায়গা কম হলে placement
             নিজেই এটাকে উল্টো দিকে খোলে। */
          <div
            role="dialog"
            aria-label={`${label} calendar`}
            className={`${MENU_SHELL} ${placement.up ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-frank-ruhl text-[15px] font-medium leading-none text-black">
                {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/[0.08]"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mb-1 grid grid-cols-7">
              {WEEKDAY_LABELS.map((weekday) => (
                <span
                  key={weekday}
                  className="flex h-6 items-center justify-center font-sora text-[11px] font-normal leading-none text-black/40"
                >
                  {weekday}
                </span>
              ))}
            </div>

            {/* ⚠️ আগের/পরের মাসের দিন দেখানো হয় না — native picker
                ধূসর করে দেখাত, কিন্তু সেগুলো click করা যায় বলে ভুল
                মাসে তারিখ বসে যাওয়ার একটা সহজ পথ তৈরি হয়। */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <span key={`blank-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const isSelected = selected ? isSameDay(date, selected) : false;
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      onChange(toISODate(date));
                      setOpen(false);
                    }}
                    aria-label={formatDisplayDate(date)}
                    aria-current={isSelected ? "date" : undefined}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-sora text-[13px] font-normal leading-none transition-colors ${
                      isSelected
                        ? // পাতার pagination-এর active পাতাটার মতোই কালো +
                          // সাদা লেখা। FilterMenu-র cream pill এখানে যথেষ্ট
                          // নয়: ৩০টা ঘরের ভেতরে cream আর "আজ"-এর চিহ্ন
                          // আলাদা করা যেত না।
                          "bg-black text-white"
                        : isToday
                          ? "bg-[#F9F6F3] text-black"
                          : "text-[#121212] hover:bg-black/[0.04]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onChange(toISODate(new Date()));
                setOpen(false);
              }}
              className="mt-3 w-full rounded-[12px] py-2 text-center font-sora text-[13px] font-normal leading-none text-black/70 transition-colors hover:bg-black/[0.04]"
            >
              Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ ছবি upload ═════════════════════════════════════════════════════ */

/**
 * Figma Frame 2147232424: উচ্চতা 189, radius 20, BG #F9F6F3, ভেতরটা
 * উল্লম্ব ও অনুভূমিক দুই দিকেই কেন্দ্রে।
 *
 * ⚠️ ১৮৯ = padding 18 + content 115 + padding 18 = 151 নয় — বাকি ৩৮px
 * ইচ্ছাকৃত ফাঁকা জায়গা, তাই `min-h` + center, সরাসরি padding নয়।
 * এভাবে preview অবস্থায় (ছবি বসার পর) বাক্সটার উচ্চতা একই থাকে আর
 * modal লাফায় না।
 */
export function ImageDropzone({
  value,
  onChange,
  onError,
  uploading,
  setUploading,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string | null) => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    onError(null);

    // Client-side গার্ড — route-এও একই যাচাই আছে (সেটাই আসল গার্ড),
    // কিন্তু ২০MB ফাইল আপলোড করে তারপর "খুব বড়" শোনার চেয়ে আগেই বলে
    // দেওয়া ভালো।
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file (PNG, JPG or WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onError("Image must be under 2MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // MenuItemForm-এর সাথে একই route — staff avatar-এর জন্য আলাদা
      // bucket বানানোর দরকার নেই, একই Supabase bucket, একই RBAC।
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed. Please try again.");
      onChange(data.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          // একই ফাইল আবার বাছলেও onChange চালু হয় — না করলে ভুল করে
          // মুছে ফেলার পর ওই একই ফাইল আর বাছাই করা যেত না।
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={`flex min-h-[189px] items-center justify-center rounded-[20px] p-[18px] transition-colors ${
          dragging ? "bg-[#FF9540]/10" : "bg-[#F9F6F3]"
        }`}
      >
        {value ? (
          <div className="flex flex-col items-center gap-5">
            {/* next/image নয় — UserAvatar-এর একই কারণ: Supabase host-টা
                env-নির্ভর, আর একটা ৮০px preview-তে optimization-এর লাভ
                সামান্য। */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Staff photo preview"
              className="h-20 w-20 rounded-[16px] object-cover"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-sora text-[12px] font-normal text-black underline underline-offset-2"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="font-sora text-[12px] font-normal text-[#D72A37] underline underline-offset-2"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          /* Frame 2147232453: column, gap 20, চওড়া 373। */
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full max-w-[373px] cursor-pointer flex-col items-center gap-5 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:4px]"
          >
            {/* Frame 2147232454: 50×50, BG #FFFFFF, radius 100,
                camera icon 24×24 stroke 1.5। */}
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-black/60" aria-hidden="true" />
              ) : (
                <Camera className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
              )}
            </span>

            {/* Frame 2147232452: column, gap 12, center। */}
            <span className="flex w-full flex-col items-center gap-3 text-center">
              <span className="font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
                {uploading ? "Uploading…" : "Drop images here or click to upload"}
              </span>
              <span className="font-sora text-[12px] font-normal leading-[1.2] text-black/70">
                PNG, JPG, WEBP up to 2MB each Recommended 1200×800px
              </span>
            </span>
          </button>
        )}
      </div>
    </>
  );
}

/* ══ View modal-এর পড়া-মাত্র ঘর ═════════════════════════════════════ */

/**
 * সারির InfoField-এর হুবহু গড়ন (label Sora 14 Black/70 + মান Frank
 * Ruhl 16), যাতে View modal খুললে "এটাই তো ওই সারিটা" বোঝা যায়।
 *
 * ⚠️ InfoField-টা সরাসরি import করা হয়নি: ওটা একটা server component
 * হিসেবে ব্যবহৃত হয় আর তার ডিফল্ট `xl:flex-1` তালিকার flex সারির
 * জন্য। এখানে ঘরগুলো একটা grid-এ বসে, আর মান হিসেবে একটা pill-ও
 * আসতে পারে। দুটো একসাথে করতে গেলে InfoField-এ আরও prop যোগ করতে
 * হতো, যা ওই ছোট component-টাকে ঘোলাটে করত।
 */
/**
 * ReadOnlyField-এর শিরোনামের ক্লাসগুলো আলাদা করে রাখা, কারণ কিছু ঘরে
 * মানটা সাধারণ লেখা নয় (যেমন ViewSupplierModal-এর "Products", যেখানে
 * মানটা একটা গুটিয়ে রাখা pill)। ওখানে component-টা ব্যবহার করা যায় না,
 * অথচ শিরোনামটা হুবহু একই দেখাতে হয় — ক্লাসগুলো দুবার লিখলে একদিন
 * একটা বদলে অন্যটা থেকে যেত।
 *
 * ⚠️ ৫৬০ থেকে ১৪px — Figma-র desktop frame-এ label Sora 400 14px
 * (label→মান ফাঁক ১২)। ছোট পর্দায় ১৩px/৮ রাখা হলো, কারণ সেখানে
 * ঘরগুলো দুই কলামে চেপে বসে।
 */
export const READ_ONLY_LABEL =
  "font-sora text-[13px] font-normal leading-none text-black/70 min-[560px]:text-[14px]";

export function ReadOnlyField({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 min-[560px]:gap-3">
      <span className={READ_ONLY_LABEL}>{label}</span>
      {tone ? (
        <span
          className={`inline-flex h-9 w-fit items-center rounded-full px-3 font-sora text-[12px] font-normal leading-none ${
            tone === "positive" ? "bg-[#E8FFEC] text-[#0ECF00]" : "bg-[#FAE7EC] text-[#D72A37]"
          }`}
        >
          {value}
        </span>
      ) : (
        <span className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
          {value}
        </span>
      )}
    </div>
  );
}
