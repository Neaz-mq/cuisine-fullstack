"use client";

/**
 * ⚠ Breakpoint note — src/app/globals.css:
 *   --breakpoint-sm: 320px;
 * এই project-এ `sm:` Tailwind-এর default 640px নয়, 320px থেকেই চালু হয়।
 * তাই "মোবাইলের চেয়ে বড় screen" বোঝাতে এই ফাইলে কোথাও `sm:` নেই —
 * সব জায়গায় `md:` (768px), `lg:` (1024px), `xl:` (1280px) ব্যবহার করা হয়েছে।
 * নতুন class যোগ করার সময় ভুলেও `sm:` লিখো না, ওটা মোবাইলেই apply হবে।
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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
    /* Page — Figma mobile frame: 320px wide, BG #F9F6F3, padding 20px top/bottom
       ও 16px left/right (px-4 py-5)। login/register page-এর সাথে হুবহু একই। */
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F9F6F3] flex items-center justify-center px-4 py-5 lg:px-4 lg:py-10">
      {/* Wrapper — mobile-এ শুধু grid holder, নিজের background/padding নেই।
          Figma mobile-এ card মাত্র একটাই (288px white)। lg থেকে এটিই Figma
          desktop outer card (1280×894, radius 30, padding 20, gap 20)।

          ⚠ উচ্চতা — চার auth page-এ (register / login / forgot-password /
          reset-password) এই class দুটো হুবহু এক রাখতে হবে:
              lg:h-[940px] xl:h-[1000px]
          `min-h` নয়, fixed `h` — ইচ্ছাকৃতভাবে। min-h মেঝে, ছাদ নয়: register-এর
          form লম্বা বলে সেটা floor ছাড়িয়ে বাড়তেই থাকত আর login ঠিক floor-এ
          থেমে যেত, ফলে এক page থেকে আরেক page-এ গেলে card লাফ দিত। fixed
          height-এ উচ্চতা আর content-এর উপর নির্ভর করে না, তাই লাফও নেই।
          ভেতরের form panel-এ lg:overflow-y-auto আছে — কখনো content উচ্চতা
          ছাড়ালে card না বেড়ে panel-টাই scroll করবে। সঙ্গে scrollbar-এর
          chrome লুকানো ([scrollbar-width:none] + ::-webkit-scrollbar:hidden):
          register-এর form 940-এ ঠিক আঁটছিল না বলে card-এর ভেতরে একটা ধূসর
          bar বসে যাচ্ছিল। উচ্চতা 1000-এ তোলায় স্বাভাবিক অবস্থায় scroll
          লাগেই না; bar লুকানোটা শুধু নিরাপত্তা জাল, wheel/keyboard দিয়ে
          scroll তখনো কাজ করে।
          */}
      <div className="w-full max-w-[1280px] bg-transparent p-0 rounded-none lg:bg-white lg:rounded-[30px] lg:p-4 xl:p-5 grid grid-cols-1 lg:grid-cols-2 lg:gap-4 xl:gap-5 lg:h-[940px] xl:h-[1000px]">
        {/* Left visual panel — login page-এর সাথে অভিন্ন */}
        <div className="hidden lg:block relative rounded-[16px] xl:rounded-[22px] overflow-hidden w-full min-w-0 h-full">
          <Image
            src="https://res.cloudinary.com/dzi3u164c/image/upload/v1787220856/signup_czzdi1.webp"
            alt="Great food, delivered with care"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />

          <div className="absolute bottom-0 left-0 right-0 h-[64%] bg-gradient-to-t from-black from-15% via-black/75 via-45% to-transparent" />

          <Link
            href="/"
            className="absolute top-8 xl:top-10 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2"
            aria-label="Back to home"
          >
            <Image
              src="/logo.svg"
              alt="Cuisine Logo"
              width={40}
              height={40}
              className="w-9 h-9 xl:w-10 xl:h-10"
            />
            <span className="font-frank-ruhl font-bold text-[26px] xl:text-[30px] leading-[126%] tracking-[-0.01em] text-white">
              Cuisine
            </span>
          </Link>

          <div className="absolute bottom-6 left-6 right-6 xl:bottom-10 xl:left-[50px] xl:right-[50px] z-10 text-white text-center">
            <h2 className="font-frank-ruhl text-[30px] xl:text-[38px] font-semibold leading-[114%] tracking-[-0.01em] text-white">
              Great Food, Delivered
              <br />
              With Care
            </h2>
            <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-white/80 mt-3 xl:mt-4 max-w-sm mx-auto">
              Sign in to track your orders, save your favorite dishes, and get
              personalized offers from Cuisine.
            </p>

            <div className="mt-6 xl:mt-8 grid grid-cols-3 gap-2 xl:gap-[13.45px] w-full">
              <div className="min-w-0 bg-[#F9F6F3] rounded-[14px] h-[64px] xl:h-[73px] px-2 xl:px-[30px] flex flex-col items-center justify-center gap-1.5 xl:gap-2">
                <div className="font-sora font-semibold text-[13px] xl:text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  50K+
                </div>
                <div className="font-sora font-normal text-[11px] xl:text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Happy Guests
                </div>
              </div>
              <div className="min-w-0 bg-[#F9F6F3] rounded-[14px] h-[64px] xl:h-[73px] px-2 xl:px-[30px] flex flex-col items-center justify-center gap-1.5 xl:gap-2">
                <div className="font-sora font-semibold text-[13px] xl:text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  4.9
                </div>
                <div className="font-sora font-normal text-[11px] xl:text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Average Rating
                </div>
              </div>
              <div className="min-w-0 bg-[#F9F6F3] rounded-[14px] h-[64px] xl:h-[73px] px-2 xl:px-[30px] flex flex-col items-center justify-center gap-1.5 xl:gap-2">
                <div className="font-sora font-semibold text-[13px] xl:text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  24/7
                </div>
                <div className="font-sora font-normal text-[11px] xl:text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Live Kitchen
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form panel — login page-এর সাথে অভিন্ন কাঠামো, শুধু ভেতরের content আলাদা */}
        <div className="w-full min-w-0 h-full bg-white rounded-[20px] p-5 md:p-8 lg:bg-[#F9F6F3] lg:rounded-[30px] lg:p-0 lg:px-8 lg:py-10 xl:px-[50px] xl:py-[30px] flex flex-col lg:justify-center lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* mobile-এ 320px frame মানে content ঠিক 248px (288 - 20 - 20)। xl-এ 510px */}
          <div className="w-full max-w-[510px] mx-auto">
            {/* Back — login/register-এর মতোই 52×52 box (radius 16), label Sora 400 16px।
                গন্তব্য "/" নয়, "/login": এখানে আসার একমাত্র পথ login page,
                আর ব্যবহারকারী কাজটা শেষ করে ওখানেই ফিরতে চাইবেন। */}
            <Link
              href="/login"
              className="inline-flex items-center gap-3 group mb-5 xl:mb-10"
            >
              <span className="w-[52px] h-[52px] xl:w-[60px] xl:h-[60px] shrink-0 rounded-[16px] bg-[#F9F6F3] lg:bg-white flex items-center justify-center text-black group-hover:opacity-80 transition-opacity">
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
              <span className="font-sora font-normal text-[16px] xl:text-[18px] leading-[160%] tracking-normal text-black/70 group-hover:text-black transition-colors whitespace-nowrap">
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
                <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
                  Check Your Inbox
                </h1>
                <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
                  If an account exists for{" "}
                  <span className="text-black break-all">{email}</span>, we&apos;ve sent
                  a link to reset your password. It expires in an hour and can be used
                  once.
                </p>
                <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-4">
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

                <Link
                  href="/login"
                  className="w-full h-[48px] xl:h-[56px] px-4 md:px-6 mt-8 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 active:scale-[0.99] transition whitespace-nowrap"
                >
                  Back to Login
                </Link>
              </div>
            ) : (
              <>
                {/* Heading — Frank Ruhl Libre 500, 36px, LH 130%, tracking 0, #000000।
                    Subtitle — Sora 400, 12px, LH 160%, black/70। login page-এর সাথে অভিন্ন। */}
                <div className="mb-8">
                  <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
                    Forgot Your Password
                  </h1>
                  <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
                    Enter the email you signed up with and we&apos;ll send you a link to
                    choose a new one.
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

                {/* space-y-5 = Figma card-এর 20px gap। xl-এ 24px */}
                <form onSubmit={handleSubmit} className="space-y-5 xl:space-y-6">
                  <div>
                    {/* Labels — Figma: Frank Ruhl Libre 500, 14px, LH 160%, black/100 */}
                    <label
                      htmlFor="email"
                      className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                    >
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    {/* Input — Figma mobile: height 40px, radius 12, bg #F9F6F3,
                        inner padding ~14px, Sora 14px। lg থেকে white + border,
                        কারণ তখন panel-টা cream। */}
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                      placeholder="you@example.com"
                    />
                  </div>

                  {/* Send Reset Link — login-এর Login button-এর সাথে একদম identical */}
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

                {/* Log in line — Figma: Sora 400, 12px, LH 160%, center। xl-এ 16px */}
                <p className="text-center font-sora font-normal text-[12px] xl:text-[16px] leading-[160%] text-black/70 mt-4 xl:mt-7">
                  Remembered it?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-black hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
