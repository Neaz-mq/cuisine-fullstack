"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import StaffFormModal from "./StaffFormModal";

/**
 * src/app/admin/staff/StaffToolbar.tsx
 *
 * শুধু search + "+ Add New" — role-ছাঁকনি এখানে নেই।
 *
 * ⚠️ Figma-তে এই সারিতেও একটা "All Statuses ⌄" dropdown আছে, ঠিক
 * search-এর পাশে। কিন্তু নিচে "Staff Information" কার্ডের শিরোনামের
 * পাশে আরেকটা "All ⌄" dropdown-ও আছে — আর staff-দের ক্ষেত্রে (গ্রাহকের
 * থেকে ভিন্ন, দেখুন UsersToolbar-এর একই মন্তব্য) সত্যিই দুটো আলাদা
 * অক্ষ আছে: role আর active/inactive status। তাই দুটো dropdown-ই সত্যিকার
 * কাজ করে — একটাকে বাদ দেওয়ার (Users page-এর মতো) দরকার নেই।
 *
 * সিদ্ধান্তটা: role-ছাঁকনিটা "Staff Information" কার্ডের শিরোনামের
 * পাশে বসবে, `FilterMenu`-তেই — কারণ ওই জায়গাটা (সাদা কার্ডের ভেতর)
 * FilterMenu.tsx আসলে যে প্রেক্ষাপটের জন্য বানানো (cream pill, সাদা
 * কার্ড), হুবহু সেটাই। এই টুলবারটা বসে page-এর cream পটভূমিতে, তাই এখানে
 * আরেকটা dropdown বসালে সেটা হতো তৃতীয় inline popup কপি — HANDOFF-এর
 * ৫ নম্বরে যে সমস্যাটার কথা লেখা (UsersToolbar-এর popup এখনো
 * FilterMenu-তে সরানো বাকি), সেটাই আবার তৈরি হতো। status-ছাঁকনি তাই
 * এখন বাদ; role-ছাঁকনিই যথেষ্ট প্রাথমিক প্রয়োজনের জন্য, আর ভবিষ্যতে
 * status-ছাঁকনি লাগলে সেটাও FilterMenu দিয়েই যোগ হবে, নতুন inline
 * কোড দিয়ে নয়।
 */

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

/**
 * Placeholder — একটাই রূপ, সব পর্দায়।
 *
 * ⚠️ লেখাটা আগে ছিল "Search by Name, Email or Employee ID…" আর সেটা
 * ৩২০px-এ ডান দিক থেকে কেটে যেত ("…or Employee" পর্যন্ত দেখা যেত,
 * "ID…" হারিয়ে যেত)। কারণটা font-size নয়, নিছক পাটিগণিত — আসল Sora
 * 400 দিয়ে মেপে:
 *
 *   উপলব্ধ জায়গা  = 288 (shell-এর p-4 বাদে) − 40 (pl-10) − 16 (pr-4)
 *                 = 232px
 *   পুরনো লেখাটা  = 241.5px  @12px  → ৯.৫px উপচে পড়ে ❌
 *   নতুন লেখাটা   = 178.9px  @12px  → আঁটে ✅
 *
 * ── কেন font-size আরও কমানো হলো না ──────────────────────────────────
 *
 * ১১px-এ পুরনো লেখাটা দাঁড়াত ~221px — আঁটত, কিন্তু ২৩২-এর ঘরে ২২১
 * মানে ১১px-এর ব্যবধান। ব্যবহারকারীর ব্রাউজারে Sora লোড হওয়ার আগে
 * fallback sans-serif দিয়ে আঁকা হয়, আর সেটা প্রায় সবসময়ই চওড়া —
 * অর্থাৎ প্রথম রেন্ডারেই আবার কাটত। আর Figma-র ৩২০px frame স্পষ্ট
 * করে বলে placeholder ১২px (`font-size: 12px`), তাই ওটা নামানোর
 * সুযোগও নেই।
 *
 * ── কেন পর্দা মেপে দুটো আলাদা লেখা দেখানো হলো না ────────────────────
 *
 * সেটা করতে হলে JS-কে জানতে হতো পর্দা কত চওড়া (placeholder একটা
 * attribute, `::placeholder`-এ `content` কাজ করে না)। UsersToolbar-এ
 * ঠিক ওই ব্যবস্থাটাই একবার ছিল এবং **সরিয়ে ফেলা হয়েছে** — ওখানকার
 * মন্তব্য দ্রষ্টব্য। server-এ আর client-এ আলাদা লেখা মানে hydration
 * অমিল, আর matchMedia-র ফল state-এ তুললে সেটা useEffect-এর ভেতরে
 * setState — যেটা এই প্রজেক্টে react-hooks/set-state-in-effect ভাঙে।
 * একটা placeholder-এর জন্য ওই দাম দেওয়ার মানে হয় না।
 *
 * ── কেন ঠিক এই লেখাটা ───────────────────────────────────────────────
 *
 * Figma নিজেই এই সমস্যাটা এভাবেই সামলেছে: Users পাতার ৩২০px frame-এ
 * লেখাটা "Search by Customer Name, Email…" — ২১০px, অর্থাৎ designer
 * পুরো বাক্য না লিখে ছোট করে দিয়েছেন। এখানেও একই পথ।
 *
 * "Employee" শব্দটা বাদ গেল, "ID" থাকল — কারণ যে তিনটে মাঠে সত্যিই
 * খোঁজা হয় (name, email, employeeId) তিনটেরই ইঙ্গিত থাকা জরুরি, আর
 * এই তালিকায় "ID" বলতে যে employee ID বোঝানো হচ্ছে সেটা প্রেক্ষাপট
 * থেকেই স্পষ্ট: প্রতিটা সারির পরিচয়-ব্লকের তৃতীয় লাইনটাই ওই ID।
 *
 * ⚠️ `aria-label`-টা কিন্তু পুরো থাকল ("…name, email or employee ID")।
 * সংক্ষেপটা জায়গার সমস্যার সমাধান, তথ্য কমানোর সিদ্ধান্ত নয় — screen
 * reader-এ জায়গার সমস্যা নেই, তাই সেখানে কাটছাঁটেরও কারণ নেই।
 */
const FULL_PLACEHOLDER = "Search by Name, Email or ID…";

export default function StaffToolbar({
  viewerRole,
}: {
  /** OWNER/MANAGER — modal-এর role তালিকা ছাঁকতে লাগে। */
  viewerRole?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [modalOpen, setModalOpen] = useState(false);

  // UsersToolbar-এর debounce/ref প্যাটার্ন হুবহু — বিস্তারিত ব্যাখ্যা
  // ওখানে, এখানে পুনরাবৃত্তি করা হয়নি।
  const requestedRef = useRef(urlQuery);
  const pendingRef = useRef(false);


  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // ⚠️ `period` তালিকার ছাঁকনি নয় (ওটা উপরের Overview কার্ডের),
    // কিন্তু এখানে না রাখলে search বদলালেই সেটা নীরবে "All"-এ ফিরে যেত।
    ["q", "role", "period"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === requestedRef.current) return;
    const timer = setTimeout(() => {
      requestedRef.current = query;
      pendingRef.current = true;
      push({ q: query || null });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (urlQuery === requestedRef.current) {
      pendingRef.current = false;
      return;
    }
    if (pendingRef.current) return;
    requestedRef.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  return (
    // UsersToolbar-এর একই wrapper breakpoint (min-[480px], sm নয় —
    // globals.css-এ sm=320 হওয়ায় sm: কার্যত সবসময় চালু)।
    <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:gap-6">
      <div className="relative h-[50px] min-w-0 flex-1">
        {/* ⚠️ ৪৮০px-এর নিচে ১৬×১৬ — কারণ UsersToolbar-এর একই
            আইকনের মন্তব্যে (ছোট লেখার পাশে বড় আইকন বেঢপ লাগে)। */}
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={FULL_PLACEHOLDER}
          aria-label="Search staff by name, email or employee ID"
          /**
           * ⚠️ placeholder-এর মাপ ইনপুটের চেয়ে আলাদা — কারণ
           * UsersToolbar-এর একই ঘরের মন্তব্যে (iOS Safari ১৬px-এর কম
           * ইনপুটে পাতা zoom করে দেয়, তাই ইনপুট ১৬; আর ৩২০px-এ
           * ১৬px placeholder আঁটে না, তাই placeholder ১২)।
           *
           * ⚠️ `text-ellipsis` — নিরাপত্তা-জাল, প্রধান সমাধান নয়।
           * প্রধান সমাধানটা উপরের FULL_PLACEHOLDER: লেখাটাই এখন
           * সব পর্দায় আঁটে (৩২০-এ ১৭৯/২৩২, ৪৮০-এ ২০৯/২২৮,
           * ৭৬৮+-এ ২৩৯/৫১৬)। কিন্তু Sora লোড হওয়ার আগের কয়েকটা
           * frame-এ fallback sans-serif দিয়ে আঁকা হয়, আর সেটা চওড়া।
           * ওই মুহূর্তে `text-overflow: ellipsis` ছাড়া লেখাটা
           * অক্ষরের মাঝখানে খাড়াভাবে কেটে যায় (এখনকার ছবিতে যেমন
           * দেখা যাচ্ছে); এটা থাকলে সেটা একটা "…"-এ শেষ হয় —
           * অর্থাৎ সবচেয়ে খারাপ অবস্থাটাও দেখতে ইচ্ছাকৃত লাগে।
           *
           * input-এ `text-overflow` value আর placeholder **দুটোতেই**
           * খাটে (Chrome/Firefox/Safari), আর focus করে টাইপ করার সময়
           * ব্রাউজার নিজেই এটা উপেক্ষা করে — তাই caret ঢাকা পড়ার
           * ভয় নেই।
           */
          className={`h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] ${FOCUS_RING}`}
        />
      </div>

      {/**
       * Figma-র "+ Add New": 137×50, padding 16, gap 8, radius 100,
       * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`,
       * আইকন 20×20 stroke 1.5, লেখা Sora 600 16px সাদা।
       *
       * ⚠️ এটা আগে solid #FF4C15 ছিল, এই যুক্তিতে যে প্রজেক্টের বাকি
       * primary CTA-গুলো ওই রঙেই (StaffForm-এর submit, TableForm,
       * ইত্যাদি) — "নতুন gradient না বসিয়ে যা আছে তার সাথে মেলাই"।
       * যুক্তিটা ভুল ছিল: এই পাতায় ওই gradient-টা আর নতুন কিছু নয়।
       * সারির "View" বোতাম, modal-এর "Save Change", sidebar-এর active
       * item — সবই ওই একই gradient। ফলে solid কমলাটাই এখানে বেমানান
       * একমাত্র জিনিস হয়ে দাঁড়িয়েছিল।
       *
       * gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে ঠিক
       * 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো গোলাপি।
       * Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে** — তাই ভেতরে
       * শুধু কমলা থেকে একটা নরম মাঝামাঝি রঙ দেখা যায়।
       *
       * ⚠️ আগে এটা /admin/staff/new-এ যাওয়ার একটা <Link> ছিল। নকশায়
       * এটা একটা modal খোলে, তাই এখন <button>। ওই পাতাটা (আর তার
       * StaffForm) এখন আর কোথাও থেকে খোলে না — সম্পাদনার সব ঘর
       * StaffFormModal-এর edit mode-এ চলে এসেছে, তাই ফোল্ডারটা মুছে
       * ফেলা যায়।
       */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`flex h-[50px] shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[16px] font-semibold leading-none text-white transition-opacity hover:opacity-90 ${FOCUS_RING}`}
      >
        <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        Add New
      </button>

      <StaffFormModal
        mode="create"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        viewerRole={viewerRole}
      />
    </div>
  );
}
