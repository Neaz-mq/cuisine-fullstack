"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * src/components/admin/ConfirmDialog.tsx
 *
 * Admin panel-এর "সত্যিই করবেন?" জিজ্ঞাসা — browser-এর `confirm()`-এর
 * বদলে।
 *
 * ── কেন `confirm()` বাদ ─────────────────────────────────────────────
 *
 * তিনটে সমস্যা, আর তিনটেই আসল।
 *
 * এক, চেহারা: `confirm()`-এর বাক্সটা browser আঁকে, CSS পৌঁছয় না। তাই
 * পর্দার একদম **উপরে** একটা ধূসর OS-বাক্স, "localhost:3000 says"
 * লেখা সহ — অথচ যে জিনিসটার কথা বলা হচ্ছে সেটা পর্দার মাঝখানে।
 * চোখকে দু'জায়গায় যেতে হয়, আর "localhost:3000" কথাটা ব্যবহারকারীর
 * কাছে অর্থহীন (এবং production-এ কিছুটা ভীতিকর)।
 *
 * দুই, এটা **synchronous এবং blocking**। JS thread থেমে থাকে, তাই
 * কোনো loading অবস্থা দেখানো যায় না, কোনো animation চলে না।
 *
 * তিন, আর এটাই সবচেয়ে গুরুতর: বাক্সটায় প্রাথমিক focus থাকে **OK**-তে।
 * অর্থাৎ Deactivate চেপে অভ্যাসবশত Enter চাপলেই কাজটা হয়ে যায়। একটা
 * ধ্বংসাত্মক কাজের জন্য সেটা উল্টো — নিচে তাই Cancel-এই focus বসে।
 *
 * ── কেন SweetAlert (বা অন্য package) নয় ─────────────────────────────
 *
 * SweetAlert2 নিজের theme, নিজের animation, নিজের global CSS নিয়ে
 * আসে — অর্থাৎ ঠিক আগের সমস্যাটাই ফিরত, শুধু আরও সুন্দর মোড়কে:
 * প্রজেক্টের নয় এমন একটা চেহারা। এই component-টা ~৮০ লাইন, কোনো নতুন
 * dependency নেই, আর ঘরের নিজের token-ই ব্যবহার করে (cream #F9F6F3,
 * বিপদ-লাল #D72A37, radius 90/100 pill, Sora + Frank Ruhl)।
 *
 * ── ব্যবহার ──────────────────────────────────────────────────────────
 *
 * এটা staff-এর বাইরেও ব্যবহারযোগ্য — admin panel-এ আরও কয়েক জায়গায়
 * `confirm()` আছে (menu item মোছা, order বাতিল ইত্যাদি)। সেগুলোও
 * ধীরে ধীরে এখানে আনা যায়, তাই component-টা staff ফোল্ডারে নয়,
 * components/admin-এ।
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = লাল (ধ্বংসাত্মক), primary = নকশার gradient। */
  tone?: "danger" | "primary";
  /** কাজটা চলছে — বোতাম নিষ্ক্রিয় হয় আর একটা spinner আসে। */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    /**
     * ⚠️ Escape capture phase-এ ধরা হয়, তারপর propagation থামানো।
     *
     * এই dialog-টা প্রায় সবসময় একটা modal-এর **উপরে** বসে (যেমন
     * View Staff), আর সেই modal নিজেও document-এ Escape শোনে। দুটোই
     * bubble phase-এ থাকলে একবার Escape চাপলেই confirm আর তার নিচের
     * modal — দুটোই বন্ধ হয়ে যেত। capture-phase listener bubble-এর
     * আগে চলে, আর সেখানে stopPropagation() ডাকলে event আর bubble
     * phase-এ পৌঁছয় না।
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (!pending) onCancel();
    };
    document.addEventListener("keydown", onKeyDown, true);

    // ⚠️ focus যায় **Cancel**-এ, Confirm-এ নয় — উপরের তিন নম্বর
    // কারণটা দ্রষ্টব্য। অভ্যাসবশত Enter চাপলে যেন কিছু মুছে না যায়।
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(timer);
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      // z-[60] — নিচের modal-টা z-50-এ, তাই এটা তার উপরে বসতে হয়।
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        // পটভূমিতে click = Cancel, কিন্তু কাজটা চলার মাঝে নয় —
        // তখন অর্ধেক-হয়ে-যাওয়া অবস্থায় dialog সরে গেলে ব্যবহারকারী
        // জানতেন না শেষমেশ কী হলো।
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={message ? "confirm-dialog-message" : undefined}
    >
      {/* modal কার্ডের চেয়ে ছোট (radius 24, ৪২০px) — এটা একটা প্রশ্ন,
          একটা form নয়। বড় করলে নিচের modal-টার সাথে মাপে মিশে যেত
          আর "উপরে ভাসছে" ভাবটা হারাত। */}
      <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              tone === "danger" ? "bg-[#FAE7EC] text-[#D72A37]" : "bg-[#F9F6F3] text-black"
            }`}
          >
            <AlertTriangle className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
          </span>

          <h3
            id="confirm-dialog-title"
            className="font-frank-ruhl text-[20px] font-semibold leading-[1.2] text-black"
          >
            {title}
          </h3>

          {message && (
            <p
              id="confirm-dialog-message"
              className="font-sora text-[13px] font-normal leading-[1.7] text-black/70"
            >
              {message}
            </p>
          )}
        </div>

        {/* Cancel বাঁয়ে, নিশ্চিতকরণ ডানে — modal-এর footer-এর একই ক্রম,
            একই ৪৬px উচ্চতা আর pill গড়ন। */}
        <div className="mt-6 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex h-[46px] flex-1 items-center justify-center rounded-[90px] border border-black px-5 font-sora text-[15px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-sora text-[15px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
              tone === "danger"
                ? "bg-[#D72A37]"
                : "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]"
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
