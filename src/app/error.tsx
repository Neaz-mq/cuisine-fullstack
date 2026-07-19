"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * src/app/error.tsx
 *
 * App Router error boundary for everything under this layout (i.e. the
 * whole app, since there's no more specific error.tsx in any subtree).
 * Without this file, an uncaught render/render-time error anywhere —
 * including mid-checkout — falls through to Next's generic "Application
 * error: a client-side exception has occurred" white screen, which is a
 * particularly bad look for a paying customer.
 *
 * Must be a Client Component (App Router requirement for error.tsx).
 * digest is Next's stripped-of-detail crash reference, safe to show a
 * customer as a support ID — the actual error message/stack is not, so it
 * stays out of what's rendered here.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: wire up to real error monitoring (e.g. Sentry) before launch —
    // console.error alone means the team only finds out about production
    // crashes if a customer happens to report one.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#2C6252]/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-orange-400/10 rounded-full blur-3xl" />

      <div className="relative mb-6">
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          <circle cx="70" cy="70" r="65" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="2" />
          <circle cx="70" cy="70" r="48" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
          {/* Spilled/tipped plate to signal "something went wrong" rather
              than the calmer 404 face */}
          <circle cx="58" cy="64" r="3" fill="#D1D5DB" />
          <circle cx="82" cy="64" r="3" fill="#D1D5DB" />
          <path
            d="M56 90 Q70 82 84 90"
            stroke="#D1D5DB"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            transform="rotate(180 70 86)"
          />
        </svg>
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-[#2C6252] tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-800">
        Our kitchen hit a snag.
      </p>
      <p className="mt-2 text-gray-500 max-w-md">
        This has been logged on our end. If you were in the middle of an
        order, your cart is still saved — try again in a moment.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={reset}
          className="bg-[#2C6252] text-white px-6 py-3 font-semibold rounded-md hover:bg-[#234f42] transition-colors w-full sm:w-auto"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="border border-gray-300 text-gray-700 px-6 py-3 font-semibold rounded-md hover:bg-gray-100 transition-colors w-full sm:w-auto"
        >
          Back to Home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-gray-400">Reference: {error.digest}</p>
      )}
    </div>
  );
}
