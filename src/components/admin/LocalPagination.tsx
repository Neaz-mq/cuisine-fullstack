"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * src/components/admin/LocalPagination.tsx
 *
 * `app/admin/orders/Pagination.tsx`-এর হুবহু একই চেহারা (Figma Frame
 * 2147232469: বোতাম 34×34, radius 8, BG #F9F6F3, লেখা Sora 400 12px
 * Black/70; চলতি page কালো ভরাট, সাদা লেখা) — কিন্তু URL নয়, state।
 *
 * ⚠️ দুটো আলাদা component কেন, কপি না করেও।
 *
 * ওটা `<Link>` দিয়ে চলে, অর্থাৎ প্রতিটা page একটা আলাদা URL — যা
 * ঠিক, কারণ ওখানে page-টা server-এ ছাঁকা হয় আর share/bookmark করার
 * মতো জিনিস।
 *
 * /admin/menu-এ প্রতিটা **শ্রেণির নিজের** pagination — একই পর্দায়
 * ১৪টা আলাদা তালিকা। URL-এ নিলে `?burger_page=2&pizza_page=3&…`
 * হতো, অর্থাৎ প্রতিটা শ্রেণির জন্য একটা করে param, আর একটা কার্ডের
 * পাতা বদলালে পুরো server component গাছটা আবার render হতো — অথচ
 * বদলাচ্ছে একটামাত্র কার্ডের ভেতরের পাঁচটা সারি।
 *
 * সংখ্যার যুক্তিটা (`pageSlots`) ওখান থেকে হুবহু নেওয়া, ইচ্ছাকৃতভাবে —
 * দুটো pager একই পর্দায় দেখা যেতে পারে, তাই "১ … ৩ ৪ ৫ … ৯"-এর
 * ছাঁদ এক না হলে চোখে লাগত।
 */

/**
 * কোন page-সংখ্যাগুলো দেখানো হবে — `null` মানে "…"।
 *
 * চলতি page-এর দু'পাশে একটা করে, সাথে সবসময় প্রথম আর শেষ। প্রান্তে
 * জানালাটা সরে যায়, তাই page ১-এ থাকলে ১‑২‑৩ দেখা যায়, শেষে থাকলে
 * শেষ তিনটে — মকআপে ঠিক সেটাই।
 */
function pageSlots(current: number, total: number): (number | null)[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const start = Math.min(Math.max(current - 1, 1), total - 2);
  const window = [start, start + 1, start + 2];

  const slots: (number | null)[] = [];
  if (window[0] > 1) {
    slots.push(1);
    // ১ আর জানালার শুরুর মাঝে সত্যিই ফাঁক থাকলে তবেই "…" — নাহলে
    // "1 … 2" লেখা হতো, যেটা অর্থহীন।
    if (window[0] > 2) slots.push(null);
  }
  slots.push(...window);
  if (window[2] < total) {
    if (window[2] < total - 1) slots.push(null);
    slots.push(total);
  }
  return slots;
}

/** Figma: 34×34, radius 8, BG #F9F6F3। */
const CELL =
  "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg font-sora text-[12px] leading-[1.2] transition-colors disabled:pointer-events-none disabled:opacity-40";

export default function LocalPagination({
  currentPage,
  totalPages,
  onChange,
  label = "Pagination",
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** screen reader-এর জন্য, যেমন "Burgers pagination"। */
  label?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    // Figma: row, gap 12।
    <nav aria-label={label} className="flex items-center gap-2 min-[480px]:gap-3">
      <button
        type="button"
        onClick={() => onChange(currentPage - 1)}
        // প্রথম page-এ তীরটা থাকে কিন্তু নিষ্ক্রিয় — সরিয়ে দিলে বাকি
        // বোতামগুলো লাফ দিয়ে সরে যেত।
        disabled={currentPage === 1}
        aria-label="Previous page"
        className={`${CELL} bg-[#F9F6F3] text-black hover:bg-black/[0.06]`}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>

      {pageSlots(currentPage, totalPages).map((page, index) =>
        page === null ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className={`${CELL} bg-[#F9F6F3] font-medium text-black/70`}
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            className={`${CELL} ${
              page === currentPage
                ? "bg-black text-white"
                : "bg-[#F9F6F3] text-black/70 hover:bg-black/[0.06]"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className={`${CELL} bg-[#F9F6F3] text-black hover:bg-black/[0.06]`}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </nav>
  );
}
