"use client";

/**
 * ⚠ Breakpoint note — src/app/globals.css:
 *   --breakpoint-sm: 320px;
 * এই project-এ `sm:` Tailwind-এর default 640px নয়, 320px থেকেই চালু হয়।
 * তাই "মোবাইলের চেয়ে বড় screen" বোঝাতে এই ফাইলে কোথাও `sm:` নেই —
 * সব জায়গায় `md:` (768px), `lg:` (1024px), `xl:` (1280px) ব্যবহার করা হয়েছে।
 */

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      // 429 বা proxy error page JSON নাও হতে পারে — parse যেন network
      // branch-এ throw না করে।
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Could not connect to server, please try again later");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F9F6F3] flex items-center justify-center px-4 py-5 lg:px-4 lg:py-10">
      <div className="w-full max-w-[560px] bg-white rounded-[20px] p-5 md:p-8 xl:rounded-[30px] xl:p-10">
        {/* Back — login/register-এর মতোই 52×52 box, radius 16 */}
        <Link
          href="/login"
          className="inline-flex items-center gap-3 group mb-5 xl:mb-10"
        >
          <span className="w-[52px] h-[52px] xl:w-[60px] xl:h-[60px] shrink-0 rounded-[16px] bg-[#F9F6F3] flex items-center justify-center text-black group-hover:opacity-80 transition-opacity">
            <svg
              className="w-6 h-6 xl:w-[30px] xl:h-[30px]"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-sora font-normal text-[16px] xl:text-[18px] leading-[160%] text-black/70 group-hover:text-black transition-colors whitespace-nowrap">
            Back to Login
          </span>
        </Link>

        {sent ? (
          /* সফল অবস্থা — ইচ্ছাকৃতভাবে "we sent you an email" নয়।
             API নিবন্ধিত আর অনিবন্ধিত ঠিকানায় একই উত্তর দেয়, তাই
             নিশ্চিত করে বললে সেই গোপনীয়তা এখানেই ফাঁস হয়ে যেত।
             "if an account exists" শব্দগুলো সেই আচরণটাকেই সৎভাবে
             বলছে, আর টাইপো করা ব্যবহারকারীকেও বুঝতে সাহায্য করছে
             কেন তাঁর inbox খালি। */
          <div>
            <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] text-black">
              Check your inbox
            </h1>
            <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-2">
              If an account exists for <span className="text-black">{email}</span>,
              we&apos;ve sent a link to reset your password. It expires in an hour and
              can be used once.
            </p>
            <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-4">
              Nothing arrived? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-semibold text-black hover:underline"
              >
                try a different email
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] text-black">
                Forgot Password
              </h1>
              <p className="font-sora font-normal text-[12px] leading-[160%] text-black/70 mt-2">
                Enter the email you signed up with and we&apos;ll send you a link to
                choose a new password.
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
                  htmlFor="email"
                  className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] border-0 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                  placeholder="you@example.com"
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
                      Sending link...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>
            </form>

            <p className="text-center font-sora font-normal text-[12px] xl:text-[16px] leading-[160%] text-black/70 mt-4 xl:mt-7">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-black hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
