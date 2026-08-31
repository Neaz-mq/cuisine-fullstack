"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useScreenTier } from "@/components/admin/useScreenTier";
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

// UsersToolbar-এর একই কারণ: placeholder attribute, CSS দিয়ে বদলায় না।
const FULL_PLACEHOLDER = "Search by Name, Email or Employee ID…";
const SHORT_PLACEHOLDER = "Search";

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

  const tier = useScreenTier();

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    ["q", "role"].forEach((key) => {
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
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tier === "wide" ? FULL_PLACEHOLDER : SHORT_PLACEHOLDER}
          aria-label="Search staff by name, email or employee ID"
          className={`h-[50px] w-full rounded-full bg-white pl-11 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-black/70 ${FOCUS_RING}`}
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