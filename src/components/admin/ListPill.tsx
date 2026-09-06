"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * src/components/admin/ListPill.tsx
 *
 * Figma-র সেই ছোট pill যেটার ভেতরে একটা মান আর একটা ১৬px chevron —
 * Suppliers তালিকার "Products" ঘর (Frame 2147236294) আর Menu তালিকার
 * "Nutrition & Time" / "Ingredients" ঘর (Frame 2147236288) — তিনটেই
 * হুবহু একই জিনিস।
 *
 * ⚠️ এটা আগে `app/admin/suppliers/SupplierProductsPill.tsx`-এ ছিল।
 * Menu-র সারিতেও ঠিক এই আচরণটা দরকার হওয়ায় এখানে তোলা হলো — কপি না
 * করে, কারণ এই প্রজেক্টেই একবার কপি করা dropdown নীরবে পিছিয়ে
 * পড়েছিল (modal-ui.tsx-এর মন্তব্য দ্রষ্টব্য)। পুরনো ফাইলটা এখন এই
 * component-এর একটা পাতলা মোড়ক, তাই Suppliers-এর কোনো import
 * বদলাতে হয়নি।
 *
 * ── এটা ছাঁকনি নয় ───────────────────────────────────────────────────
 *
 * ⚠️ দেখতে dropdown, কিন্তু কিছু বাছাই করা যায় না — এটা নিছক একটা
 * তালিকা যেটা জায়গা বাঁচাতে গুটিয়ে রাখা। একজন সরবরাহকারী দশরকম পণ্য
 * দিতে পারেন, একটা পদে দশরকম উপকরণ থাকতে পারে; দশটা নাম এক সারিতে
 * ধরানো যায় না।
 */
export default function ListPill({
  items,
  label,
  footer,
  surface = "white",
  emptyLabel = "—",
  emptyVariant = "dash",
  ariaLabel,
}: {
  /** পুরো তালিকা — খোলা অবস্থায় এগুলোই দেখা যায়। */
  items: string[];
  /**
   * গুটানো অবস্থায় pill-এ কী লেখা থাকবে। না দিলে প্রথম item, আর
   * একাধিক থাকলে সাথে "+N"।
   *
   * ⚠️ Menu-র "Nutrition & Time" ঘরে এটা লাগে: Figma-তে ওখানে
   * "499 Kcal" লেখা, অথচ ভেতরের তালিকায় fat/protein/carb/সময়ও আছে।
   * "Calories: 499 Kcal +4" লিখলে নকশাও ভাঙত, পড়তেও কঠিন হত।
   */
  label?: string;
  /**
   * খোলা তালিকার নিচে বাড়তি কিছু (যেমন একটা লিঙ্ক)।
   *
   * ⚠️ footer থাকলে pill-টা এক item নিয়েও, এমনকি **শূন্য** item নিয়েও
   * খোলে — নাহলে ঠিক যে পদগুলোয় এখনো কিছু বসানো হয়নি সেগুলোতেই
   * বসানোর লিঙ্কটা পৌঁছত না।
   */
  footer?: ReactNode;
  /**
   * pill-টা কোন পটভূমির উপরে বসছে।
   *
   * ⚠️ FilterMenu-র `surface` prop-এর একই কারণ। তালিকার সারির পটভূমি
   * cream (#F9F6F3), তাই সেখানে pill সাদা হলে তবেই আলাদা করে চোখে
   * পড়ে। কিন্তু ViewSupplierModal-এর পটভূমি সাদা — সেখানে সাদা pill
   * একেবারে মিলিয়ে যেত, তাই Figma ওখানে উল্টোটা দিয়েছে
   * (Frame 2147236298-এর Fill: `background: #F9F6F3`)।
   */
  surface?: "white" | "cream";
  /** তালিকা খালি হলে কী লেখা হবে। */
  emptyLabel?: string;
  /**
   * খালি অবস্থার চেহারা। Suppliers-এ Figma একটা সাধারণ "—" দেখায়
   * (`dash`); Menu-র সারিতে বাকি তিনটে ঘরই pill, তাই সেখানে একটা
   * ফ্যাকাশে pill-ই মানানসই (`pill`) — একটামাত্র ঘর হঠাৎ অন্যরকম
   * হলে সারিটা ভাঙা দেখাত।
   */
  emptyVariant?: "dash" | "pill";
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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

  const isEmpty = items.length === 0;

  if (isEmpty && !footer && emptyVariant === "dash") {
    // "—", ফাঁকা pill নয়: একটা খালি বাক্স দেখে বোঝা যেত না ওটা
    // ভরাট হয়নি না ভাঙা।
    return <span className="font-frank-ruhl text-[16px] font-medium text-black">—</span>;
  }

  const [first, ...rest] = items;

  /**
   * একটাই item আর কোনো footer নেই — খোলার মতো কিছু নেই, তাই chevron-ও
   * নেই আর cursor-ও বদলায় না। তখন এটা নিছক একটা লেবেল।
   */
  const canOpen = rest.length > 0 || Boolean(footer);

  const collapsed = label ?? (isEmpty ? emptyLabel : first);

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Figma: h 36, padding 10×12, gap 4, radius 100, লেখা Sora 400 12px। */}
      <button
        type="button"
        onClick={() => canOpen && setOpen((prev) => !prev)}
        aria-expanded={canOpen ? open : undefined}
        aria-controls={canOpen && open ? listId : undefined}
        aria-label={ariaLabel}
        className={`flex h-9 max-w-full items-center gap-1 rounded-full px-3 font-sora text-[12px] font-normal leading-none ${
          surface === "cream" ? "bg-[#F9F6F3]" : "bg-white"
        } ${isEmpty ? "text-black/40" : "text-black"} ${
          canOpen ? "cursor-pointer" : "cursor-default"
        } focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
      >
        <span className="min-w-0 truncate">{collapsed}</span>
        {/* "+N" কেবল ডিফল্ট লেখায় — `label` দেওয়া থাকলে ওটা নিজেই
            পুরো কথাটা বলে, সাথে একটা সংখ্যা জুড়লে বিভ্রান্তিকর হত। */}
        {!label && rest.length > 0 && (
          <span className="shrink-0 text-black/50">+{rest.length}</span>
        )}
        {canOpen && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-black transition-transform ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.2}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        /* FilterMenu-র popup-এর একই চেহারা: সাদা কার্ড, padding 16,
           radius 16, ছায়া 0 4px 30px rgba(0,0,0,0.06)। */
        <div
          id={listId}
          className="absolute left-0 top-full z-30 mt-2 flex max-h-[220px] w-max min-w-full max-w-[260px] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]"
        >
          {items.map((item) => (
            <span
              key={item}
              className="truncate rounded-[12px] p-2.5 font-sora text-[14px] font-normal leading-none text-[#121212]"
            >
              {item}
            </span>
          ))}

          {isEmpty && (
            <span className="rounded-[12px] p-2.5 font-sora text-[14px] leading-none text-black/40">
              {emptyLabel}
            </span>
          )}

          {footer}
        </div>
      )}
    </div>
  );
}
