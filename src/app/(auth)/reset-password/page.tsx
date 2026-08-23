"use client";

/**
 * ⚠ Breakpoint note — src/app/globals.css:
 *   --breakpoint-sm: 320px;
 * এই project-এ `sm:` Tailwind-এর default 640px নয়, 320px থেকেই চালু হয়।
 * তাই এই ফাইলে কোথাও `sm:` নেই — সব `md:` / `lg:` / `xl:`।
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const CARD =
  "w-full max-w-[560px] bg-white rounded-[20px] p-5 md:p-8 xl:rounded-[30px] xl:p-10";
const PAGE =
  "min-h-screen w-full overflow-x-hidden bg-[#F9F6F3] flex items-center justify-center px-4 py-5 lg:px-4 lg:py-10";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Confirm field-টা শুধু client-side — API-তে পাঠানো হয় না। এটা
    // টাইপো ধরার জন্য, নিরাপত্তার জন্য নয়, আর server-এ পাঠালে সেখানে
    // একই তুলনা আবার লিখতে হতো যার কোনো মানে নেই।
    if (password !== confirm) {
      setError("The two passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setDone(true);
    } catch {
      setError("Could not connect to server, please try again later");
      setLoading(false);
    }
  };

  // token ছাড়া এই page-এ আসার মানে link-টা কোথাও কেটে গেছে (email
  // client লম্বা URL ভেঙে ফেলেছে, বা কেউ হাতে টাইপ করেছেন)। form
  // দেখিয়ে লাভ নেই — submit করলে যেভাবেই হোক ব্যর্থ হতো।
  if (!token) {
    return (
      <div className={PAGE}>
        <div className={CARD}>
          <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] text-black">
            Link incomplete
          </h1>
          <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-2">
            This reset link is missing its token — some email apps shorten long
            links. Request a fresh one and open it directly from the email.
          </p>
          <Link
            href="/forgot-password"
            className="mt-8 w-full h-[48px] xl:h-[56px] px-4 md:px-6 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 transition"
          >
            Request a New Link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={PAGE}>
        <div className={CARD}>
          <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] text-black">
            Password updated
          </h1>
          <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-2">
            You can now log in with your new password.
          </p>
          {/* ইচ্ছাকৃতভাবে auto-login করা হয়নি: reset-এর সবচেয়ে সাধারণ
              কারণ হলো account-টা হাতছাড়া হয়েছে বলে সন্দেহ। এমন মুহূর্তে
              নতুন password টাইপ করে একবার ঢোকাটাই কাম্য — তাতে
              ব্যবহারকারী নিশ্চিত হন যে যা সেট করেছেন তা কাজ করছে। */}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-8 w-full h-[48px] xl:h-[56px] px-4 md:px-6 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 active:scale-[0.99] transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className={CARD}>
        <div className="mb-8">
          <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] text-black">
            Choose a New Password
          </h1>
          <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-2">
            Pick something you haven&apos;t used here before. This link works once.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 bg-red-50 text-red-600 text-[13px] p-3 mb-5 rounded-lg border border-red-100"
          >
            <svg
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="min-w-0">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 xl:space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
            >
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] border-0 px-3.5 pr-11 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                placeholder="Min 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg
                    className="w-[18px] h-[18px]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.359 1.359a2.5 2.5 0 013.14 3.14l1.359 1.359a4 4 0 00-5.858-5.858z" />
                    <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                  </svg>
                ) : (
                  <svg
                    className="w-[18px] h-[18px]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path
                      fillRule="evenodd"
                      d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.147.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
            >
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] border-0 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
              placeholder="Type it again"
            />
          </div>

          <div className="pt-5 xl:pt-0">
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full h-[48px] xl:h-[56px] px-4 md:px-6 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2 md:gap-3">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Updating...
                </span>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * useSearchParams() prerender-এর সময় Suspense boundary দাবি করে —
 * না দিলে build-এ "missing suspense boundary with useSearchParams"
 * error দিয়ে থেমে যায়। fallback-টা ইচ্ছাকৃতভাবে খালি card: token
 * পড়া হয় client-এ, তাই এই অবস্থাটা এক frame-ই থাকে, ওখানে spinner
 * দিলে শুধু ঝিলিক দিত।
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={PAGE}>
          <div className={CARD} />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
