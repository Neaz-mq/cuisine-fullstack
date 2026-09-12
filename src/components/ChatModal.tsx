"use client";

import { useEffect, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";

/**
 * src/components/ChatModal.tsx
 *
 * Figma "Frame 2147236224" — গ্রাহক map-এর চ্যাট বোতামে চাপলে যে modal।
 *
 *   735 × 607, সাদা, radius 30, padding 30, ভেতরে gap 24
 *   শিরোনাম "Chat with Your Rider" (28px) | ডানে 40px cream × বোতাম
 *   তারপর কথোপকথন (ChatPanel, chrome="bare")
 *
 * ⚠️ কথোপকথনের কোডটা এখানে নেই — ওটা ChatPanel-এর, যেটা rider-এর
 * dashboard-ও ব্যবহার করে। এই ফাইলটা কেবল খোলসটা দেয়: overlay, শিরোনাম,
 * বন্ধ করার নিয়ম আর keyboard/focus আচরণ।
 *
 * ── Modal-এর দায়িত্বগুলো ────────────────────────────────────────────
 *
 * ⚠️ `<dialog>` element ব্যবহার করা হয়েছে, কোনো div নয়। এতে browser
 * নিজেই দেয়: top layer-এ render (z-index-এর যুদ্ধ শেষ), Esc-এ বন্ধ,
 * focus আটকে রাখা, আর বাইরের content-কে screen reader থেকে আড়াল করা।
 * div দিয়ে এর প্রতিটাই হাতে লিখতে হতো, আর সাধারণত ভুল হতো।
 *
 * ⚠️ `showModal()` effect-এ ডাকা হয়, render-এ নয় — ওটা DOM-এর উপর
 * side effect, আর React-এর render pure থাকা উচিত।
 */
export default function ChatModal({
  open,
  onClose,
  orderId,
  riderName,
  active,
  inactiveMessage,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  /** শিরোনামে দেখানো হয় না (Figma-তে "Your Rider"), কিন্তু ভেতরের
   *  input-এর aria-label আর খালি অবস্থার লেখায় কাজে লাগে। */
  riderName: string;
  active: boolean;
  inactiveMessage?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * ⚠️ Esc-এ browser নিজেই dialog বন্ধ করে, কিন্তু React-এর `open`
   * state সেটা জানে না — ফলে state আর DOM আলাদা হয়ে যেত আর পরের বার
   * বোতামে চাপলে কিছুই খুলত না। `close` event ধরে state মিলিয়ে দেওয়া
   * হয়, তাই Esc, বাইরে ক্লিক আর × তিনটেই একই পথে যায়।
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`chat-modal-title-${orderId}`}
      /**
       * ⚠️ backdrop-এ ক্লিক করলে বন্ধ — কিন্তু শুধু তখনই যখন ক্লিকটা
       * সত্যিই dialog element-এর উপরে পড়েছে। `<dialog>`-এর box পুরো
       * পর্দা জুড়ে নয়, তবু backdrop-এর ক্লিক target হিসেবে dialog-কেই
       * দেখায়; ভেতরের কোনো কিছুতে ক্লিক করলে target হয় সেই child।
       * তাই এই তুলনাটাই বাইরে আর ভেতরের ক্লিক আলাদা করে।
       */
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[calc(100vw-32px)] max-w-[735px] rounded-[20px] bg-white p-0 backdrop:bg-black/50 md:rounded-[30px]"
    >
      {/* ⚠️ উচ্চতা viewport-সাপেক্ষ (Figma-র স্থির 607px নয়) — ছোট ফোনে
          607px পর্দার বাইরে চলে যেত আর input পৌঁছনোই যেত না। */}
      <div className="flex h-[min(607px,80vh)] flex-col gap-5 p-5 md:gap-6 md:p-[30px]">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2
            id={`chat-modal-title-${orderId}`}
            className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
          >
            Chat with Your Rider
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
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

        <ChatPanel
          orderId={orderId}
          viewerRole="CUSTOMER"
          fetchUrl={`/api/orders/${orderId}/chat`}
          sendUrl={`/api/orders/${orderId}/chat`}
          otherPartyLabel={riderName}
          active={active}
          inactiveMessage={inactiveMessage}
          chrome="bare"
        />
      </div>
    </dialog>
  );
}