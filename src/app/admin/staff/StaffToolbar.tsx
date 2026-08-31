"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useScreenTier } from "@/components/admin/useScreenTier";

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

export default function StaffToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

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
       * Figma-র "+ Add New" — প্রজেক্টের বাকি সব primary CTA বোতামের
       * মতোই #FF4C15 solid (StaffForm submit বোতাম, TableForm, ইত্যাদি
       * দ্রষ্টব্য) — নতুন কোনো gradient না বসিয়ে যা আছে তার সাথে মেলানো।
       */}
      <Link
        href="/admin/staff/new"
        className={`flex h-[50px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FF4C15] px-5 font-sora text-[15px] font-semibold leading-none text-white transition-colors hover:bg-orange-600 ${FOCUS_RING}`}
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Add New
      </Link>
    </div>
  );
}
