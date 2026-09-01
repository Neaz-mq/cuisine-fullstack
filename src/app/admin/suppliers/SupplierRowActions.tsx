"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import SupplierFormModal, { type SupplierDraft } from "./SupplierFormModal";

/**
 * src/app/admin/suppliers/SupplierRowActions.tsx
 *
 * Figma-র সারির ডান প্রান্তের "Edit" — কমলা→গোলাপি gradient pill।
 *
 * ⚠️ Staff-এর সারিতে দুটো বোতাম (Edit + View), এখানে একটাই — Figma-তেও
 * একটাই। কারণটা যুক্তিসঙ্গত: একজন সরবরাহকারীর যা কিছু আছে (নাম,
 * ইমেইল, ফোন, ঠিকানা, status) তার সবই সারিতেই দেখা যাচ্ছে, তাই
 * "View" খুললে নতুন কোনো তথ্য পাওয়া যেত না। কর্মীর ক্ষেত্রে তা নয় —
 * সেখানে NID, join date, shift সারির বাইরে থাকে।
 */
export default function SupplierRowActions({ supplier }: { supplier: SupplierDraft }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center justify-end xl:w-[60px]">
        {/* Figma: 53×40, padding 13×12, radius 100, লেখা Sora 400 14px সাদা। */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Edit ${supplier.name}`}
          className="flex h-10 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Edit
        </button>
      </div>

      {/* কেবল দরকার হলে render — দশটা সারি মানে দশটা modal, সবগুলো
          mount থাকলে প্রতিটা নিজের effect আর listener বয়ে বেড়াত। */}
      {open && <SupplierFormModal open onClose={() => setOpen(false)} supplier={supplier} />}
    </>
  );
}

/**
 * Figma-র "Products" ঘর — সাদা pill, ভেতরে একটা পণ্যের নাম আর একটা
 * ১৬px chevron (Frame 2147236294)।
 *
 * ── এটা ছাঁকনি নয় ───────────────────────────────────────────────────
 *
 * ⚠️ দেখতে dropdown, কিন্তু কিছু বাছাই করা যায় না — এটা নিছক একটা
 * তালিকা যেটা জায়গা বাঁচাতে গুটিয়ে রাখা। একজন সরবরাহকারী দশরকম পণ্য
 * দিতে পারেন, আর দশটা নাম এক সারিতে ধরানো যায় না।
 *
 * ⚠️ নামগুলো `Supplier.products` থেকে — অর্থাৎ modal-এ হাতে লেখা
 * "কী কী দিতে পারেন"। আগে এগুলো purchase order-এর line item থেকে
 * বের করা হতো ("কী কী এসেছে"), কিন্তু Figma-র modal-এ ঘরটা যোগ হওয়ায়
 * এখন উৎস একটাই। দুটোর তফাত আছে: নতুন সরবরাহকারীর কোনো অর্ডার নেই,
 * অথচ তিনি কী দেন সেটা জানা থাকে।
 *
 * Figma-তে pill-এ একটাই নাম দেখানো, কিন্তু সেটা designer-এর নমুনা।
 * বাস্তবে একাধিক থাকলে "Chicken +3" দেখানো হয়, নাহলে ব্যবহারকারী
 * ভাবতেন ওই একটাই পণ্য আসে।
 */
export function SupplierProductsPill({ products }: { products: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (products.length === 0) {
    // "—", ফাঁকা pill নয়: একটা খালি বাক্স দেখে বোঝা যেত না ওটা
    // ভরাট হয়নি না ভাঙা।
    return <span className="font-frank-ruhl text-[16px] font-medium text-black">—</span>;
  }

  const [first, ...rest] = products;

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Figma: 94×36, padding 10×12, gap 4, radius 100, BG সাদা,
          লেখা Sora 400 12px। */}
      <button
        type="button"
        onClick={() => rest.length > 0 && setOpen((prev) => !prev)}
        aria-expanded={rest.length > 0 ? open : undefined}
        // একটাই পণ্য হলে খোলার কিছু নেই — তখন এটা নিছক একটা লেবেল,
        // তাই cursor-ও বদলায় না।
        className={`flex h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 font-sora text-[12px] font-normal leading-none text-black ${
          rest.length > 0 ? "cursor-pointer" : "cursor-default"
        } focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
      >
        <span className="min-w-0 truncate">{first}</span>
        {rest.length > 0 && (
          <>
            <span className="shrink-0 text-black/50">+{rest.length}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-black transition-transform ${
                open ? "rotate-180" : ""
              }`}
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        /* FilterMenu-র popup-এর একই চেহারা: সাদা কার্ড, padding 16,
           radius 16, ছায়া 0 4px 30px rgba(0,0,0,0.06)। */
        <ul className="absolute left-0 top-full z-30 mt-2 flex max-h-[180px] w-max min-w-full max-w-[240px] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]">
          {products.map((product) => (
            <li
              key={product}
              className="truncate rounded-[12px] p-2.5 font-sora text-[14px] font-normal leading-none text-[#121212]"
            >
              {product}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
