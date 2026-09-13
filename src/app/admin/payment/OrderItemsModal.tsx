"use client";

import { useEffect, useRef, useState } from "react";

export type TransactionItem = {
  id: string;
  title: string;
  quantity: number;
  lineTotal: string;
};

/**
 * Figma "Frame 2147236223" — Recent Transactions-এর "View" বোতামের modal।
 *
 *   735px, সাদা, radius 30, padding 30, gap 20
 *   শিরোনাম "Order Items" (28px) | ডানে 40px cream × বোতাম
 *   cream কার্ড (radius 20, padding 16, gap 24):
 *     প্রতিটা পদ একটা সাদা pill (radius 100, উচ্চতা 60, padding 16):
 *       বাঁয়ে 28px কালো গোলে ক্রমিক সংখ্যা + "Juicy Burger × 1"
 *       ডানে দাম
 *     1px #D9D9D9 রেখা
 *     নিচে: 7px কমলা বিন্দু + "Uber Eats - Cash on Delivery" | "Total: $210.50"
 *
 * ⚠️ modal-টা প্রতিটা সারিতে আলাদা করে mount হয়, তাই `<dialog>`-গুলো
 * পাতায় অনেকগুলো থাকে — কিন্তু কেবল খোলাটাই top layer-এ যায়, আর বাকিরা
 * `display: none`। শর্তসাপেক্ষে mount করলে খোলার সময় একটা ফ্রেমের জন্য
 * কিছুই দেখা যেত না।
 */
export default function OrderItemsModal({
  reference,
  items,
  channelLabel,
  paymentLabel,
  totalLabel,
}: {
  /** "#ORD-ZQSCE3" — শিরোনামের নিচে, কোন অর্ডার সেটা বোঝাতে। */
  reference: string;
  items: TransactionItem[];
  /** "Uber Eats" / "Our Own Delivery" / "Table - 4"। */
  channelLabel: string;
  /** "Cash on Delivery" / "Online Payment" — admin-এর দেওয়া নামেই। */
  paymentLabel: string;
  totalLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Esc-এ browser নিজেই বন্ধ করে; state না মেলালে বোতামটা দ্বিতীয়বার
    // কাজ করত না।
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <>
      {/* Figma-র gradient "View" pill। */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View items in order ${reference}`}
        /* ⚠️ ছোট পর্দায় 44px উঁচু আর পুরো চওড়া — পাশের Paid ব্যাজের
           সমান, তাই দুটো একসাথে একজোড়া বোতামের মতো দেখায়। ৪৪px
           আঙুলের ন্যূনতম নিরাপদ মাপও। */
        className="flex h-[44px] w-full items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[13px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[640px]:h-9 xl:w-auto"
      >
        View
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`order-items-title-${reference}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto w-[calc(100vw-32px)] max-w-[735px] rounded-[20px] bg-white p-0 backdrop:bg-black/50 md:rounded-[30px]"
      >
        <div className="flex flex-col gap-5 p-5 md:p-[30px]">
          <div className="flex items-center justify-between gap-4">
            <h2
              id={`order-items-title-${reference}`}
              className="min-w-0 font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
            >
              Order Items
              {/* ⚠️ অর্ডার নম্বরটা Figma-তে নেই, কিন্তু যোগ করা হয়েছে:
                  তালিকায় পাঁচটা সারি পাশাপাশি থাকে, আর modal খোলার পর
                  "কোনটা খুলেছি" মনে করার কোনো উপায় না থাকলে staff-কে
                  বন্ধ করে আবার মেলাতে হতো। */}
              <span className="ml-2 font-sora text-[13px] font-normal text-black/50">
                {reference}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/10 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4 md:gap-6">
            {/* ⚠️ লম্বা অর্ডারে তালিকাটা নিজের ভেতরে scroll করে — modal-টা
                পর্দার বাইরে বেড়ে গেলে নিচের মোট আর বন্ধ করার বোতাম
                দুটোই নাগালের বাইরে চলে যেত। */}
            <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex min-h-[60px] items-center justify-between gap-3 rounded-full bg-white px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black font-sora text-[14px] leading-none text-white"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate font-sora text-[13px] leading-none text-black/70 md:text-[14px]">
                      {item.title} × {item.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 font-frank-ruhl text-[16px] font-medium leading-none text-black md:text-[20px]">
                    {item.lineTotal}
                  </span>
                </div>
              ))}
            </div>

            <hr className="border-0 border-t border-[#D9D9D9]" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#FF9540]"
                />
                <span className="min-w-0 truncate font-sora text-[14px] leading-none text-black/70 md:text-[16px]">
                  {channelLabel} - {paymentLabel}
                </span>
              </span>
              <span className="shrink-0 font-frank-ruhl text-[16px] font-medium leading-none text-black/70">
                Total: <span className="text-black">{totalLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
