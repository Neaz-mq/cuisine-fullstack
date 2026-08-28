import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * src/app/admin/orders/Pagination.tsx
 *
 * Figma-র সংখ্যা-বোতাম pagination: ‹ 1 2 3 … 6 ›
 *
 * আগে এটা "Previous / Page 1 of 3 / Next" ছিল। কাজ চলত, কিন্তু
 * মকআপের সাথে মিলত না, আর তিন page-এর বেশি হলে ৫ নম্বরে যেতে চারবার
 * click করতে হতো।
 *
 * ⚠️ এই component /admin/orders-এও ব্যবহার হয়, তাই সেখানকার
 * চেহারাও বদলাবে — একই design system, তাই সেটা কাম্যই।
 *
 * Figma: বোতাম 34×34, radius 8, BG #F9F6F3, লেখা Sora 400 12px
 * Black/70। চলতি page-টা কালো ভরাট, সাদা লেখা।
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

  // তিনটের জানালা, চলতি page-কে ঘিরে — প্রান্তে ভেতরের দিকে সরে যায়।
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
  "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg font-sora text-[12px] leading-[1.2] transition-colors";

export default function Pagination({
  currentPage,
  totalPages,
  searchParams,
  basePath = "/admin/orders",
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") params.set(key, value);
    });
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages;

  return (
    // Figma: row, gap 12।
    <nav aria-label="Pagination" className="flex items-center gap-3">
      <Link
        href={buildHref(currentPage - 1)}
        aria-label="Previous page"
        // প্রথম page-এ তীরটা থাকে কিন্তু নিষ্ক্রিয় — সরিয়ে দিলে বাকি
        // বোতামগুলো লাফ দিয়ে সরে যেত।
        aria-disabled={atStart}
        tabIndex={atStart ? -1 : undefined}
        className={`${CELL} bg-[#F9F6F3] text-black ${
          atStart ? "pointer-events-none opacity-40" : "hover:bg-black/[0.06]"
        }`}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </Link>

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
          <Link
            key={page}
            href={buildHref(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            className={`${CELL} ${
              page === currentPage
                ? "bg-black text-white"
                : "bg-[#F9F6F3] text-black/70 hover:bg-black/[0.06]"
            }`}
          >
            {page}
          </Link>
        )
      )}

      <Link
        href={buildHref(currentPage + 1)}
        aria-label="Next page"
        aria-disabled={atEnd}
        tabIndex={atEnd ? -1 : undefined}
        className={`${CELL} bg-[#F9F6F3] text-black ${
          atEnd ? "pointer-events-none opacity-40" : "hover:bg-black/[0.06]"
        }`}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </nav>
  );
}