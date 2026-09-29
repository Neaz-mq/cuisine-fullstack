"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Figma "Payout Successful" modal (555 wide, radius 30, padding 30, gap 31):
 * the confetti badge, a 46px Frank Ruhl title, a Sora 16 line and one
 * gradient button.
 *
 * Worded as what really happened: the request reached the restaurant —
 * the money moves when the owner pays it, so it doesn't claim "sent".
 * The badge holds a tick (Figma's placeholder shows a cross).
 */

/** The wavy "seal" outline around the tick — 10 soft bumps. */
const SEAL_PATH = (() => {
  const cx = 160;
  const cy = 171;
  const points: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    const radius = 64 + 5 * Math.cos(angle * 10);
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

export default function CashOutSuccessModal({
  open,
  amount,
  destination,
  note,
  onClose,
}: {
  open: boolean;
  amount: string;
  destination: string;
  note: string;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    buttonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-out-success-title"
      aria-describedby="cash-out-success-text"
    >
      <div className="my-auto flex w-full max-w-[555px] flex-col items-center gap-6 rounded-[20px] bg-white p-5 min-[480px]:gap-[31px] min-[480px]:rounded-[30px] min-[480px]:p-[30px]">
        <svg viewBox="0 0 315 268" className="h-auto w-[230px] min-[480px]:w-[315px]" aria-hidden="true">
          {/* confetti */}
          <path d="M56 22c8-14 20 8 30-4s18-12 22 2" fill="none" stroke="#FF5E07" strokeWidth="4.7" strokeLinecap="round" />
          <path d="M278 58c6-10 14 4 22-4s8-8 12 0" fill="none" stroke="#FF5E07" strokeWidth="4.7" strokeLinecap="round" />
          <path d="M8 138c6 10 16-2 22 8s14 2 18 10" fill="none" stroke="#FF70C6" strokeWidth="4.7" strokeLinecap="round" />
          <path d="M283 214c10-6 18 6 28 0" fill="none" stroke="#FF70C6" strokeWidth="4.7" strokeLinecap="round" />
          <circle cx="50" cy="91" r="6.3" fill="#FF70C6" />
          <circle cx="287" cy="148" r="12.6" fill="#FA7F12" />
          <circle cx="276" cy="121" r="6.3" fill="#FA7F12" />
          <circle cx="154" cy="3.5" r="3.2" fill="#FF70C6" />
          <circle cx="168" cy="22" r="14" fill="#FF70C6" />
          <path d="M232 8l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FF70C6" />
          <path d="M45 186l4 11 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#FA7F12" />

          {/* badge */}
          <circle cx="160" cy="171" r="97" fill="#FEF0E3" />
          <path d={SEAL_PATH} fill="#FFFFFF" stroke="#FA7F12" strokeWidth="9.4" strokeLinejoin="round" />
          <path d="M132 172l19 19 38-40" fill="none" stroke="#FA7F12" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="flex w-full flex-col items-center gap-5 text-center">
          <h2
            id="cash-out-success-title"
            className="font-frank-ruhl text-[30px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#141921] min-[480px]:text-[40px] md:text-[46px]"
          >
            Cash Out Requested
          </h2>
          <p id="cash-out-success-text" className="font-sora text-[14px] leading-[1.6] text-black/70 min-[480px]:text-[16px]">
            Your <strong className="font-semibold text-black">{amount}</strong> request has been sent to the restaurant
            {destination ? (
              <>
                {" "}
                for <strong className="font-semibold text-black">{destination}</strong>
              </>
            ) : null}
            . {note}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link
            ref={buttonRef}
            href="/admin/my-deliveries"
            className="flex h-[46px] w-full items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[16px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/admin/my-deliveries/earnings"
            className="text-center font-sora text-[13px] text-black/70 underline-offset-2 hover:text-black hover:underline"
          >
            See it in Payout History
          </Link>
        </div>
      </div>
    </div>
  );
}
