"use client";

/**
 * ⚠ Breakpoint note — src/app/globals.css:
 *   --breakpoint-sm: 320px;
 * এই project-এ `sm:` Tailwind-এর default 640px নয়, 320px থেকেই চালু হয়।
 * তাই "মোবাইলের চেয়ে বড় screen" বোঝাতে এই ফাইলে কোথাও `sm:` নেই —
 * সব জায়গায় `md:` (768px), `lg:` (1024px), `xl:` (1280px) ব্যবহার করা হয়েছে।
 * নতুন class যোগ করার সময় ভুলেও `sm:` লিখো না, ওটা মোবাইলেই apply হবে।
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const PILL_BUTTON =
  "w-full h-[48px] xl:h-[56px] px-4 md:px-6 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

/**
 * login/forgot-password page-এর দুই-panel কাঠামো।
 *
 * এই page-এর তিনটে অবস্থা (form, token নেই, সম্পন্ন) — প্রতিটাতেই বাম
 * দিকের image panel আর বাইরের grid হুবহু এক। inline করলে ~90 লাইন markup
 * তিনবার লিখতে হতো, আর পরে ছবি বা stats বদলালে একটা জায়গা বাদ পড়ে
 * যাওয়াটা সময়ের ব্যাপার মাত্র।
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    /* Page — Figma mobile frame: 320px wide, BG #F9F6F3, padding 20px top/bottom
       ও 16px left/right (px-4 py-5)। */
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

        {/* Form panel — login page-এর সাথে অভিন্ন কাঠামো */}
        <div className="w-full min-w-0 h-full bg-white rounded-[20px] p-5 md:p-8 lg:bg-[#F9F6F3] lg:rounded-[30px] lg:p-0 lg:px-8 lg:py-10 xl:px-[50px] xl:py-[30px] flex flex-col lg:justify-center lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* mobile-এ 320px frame মানে content ঠিক 248px (288 - 20 - 20)। xl-এ 510px */}
          <div className="w-full max-w-[510px] mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
      <AuthShell>
        <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
          Link Incomplete
        </h1>
        <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
          This reset link is missing its token — some email apps shorten long links.
          Request a fresh one and open it directly from the email.
        </p>
        <Link href="/forgot-password" className={`${PILL_BUTTON} mt-8`}>
          Request a New Link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
          Password Updated
        </h1>
        <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
          You can now log in with your new password.
        </p>
        {/* ইচ্ছাকৃতভাবে auto-login করা হয়নি: reset-এর সবচেয়ে সাধারণ
            কারণ হলো account-টা হাতছাড়া হয়েছে বলে সন্দেহ। এমন মুহূর্তে
            নতুন password টাইপ করে একবার ঢোকাটাই কাম্য — তাতে
            ব্যবহারকারী নিশ্চিত হন যে যা সেট করেছেন তা কাজ করছে। */}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className={`${PILL_BUTTON} mt-8`}
        >
          Go to Login
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* Heading — Frank Ruhl Libre 500, 36px, LH 130%, tracking 0, #000000।
          Subtitle — Sora 400, 12px, LH 160%, black/70। login page-এর সাথে অভিন্ন। */}
      <div className="mb-8">
        <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
          Choose a New Password
        </h1>
        <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
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

      {/* space-y-5 = Figma card-এর 20px gap। xl-এ 24px */}
      <form onSubmit={handleSubmit} className="space-y-5 xl:space-y-6">
        <div>
          {/* Labels — Figma: Frank Ruhl Libre 500, 14px, LH 160%, black/100 */}
          <label
            htmlFor="password"
            className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
          >
            New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            {/* Input — Figma mobile: height 40px, radius 12, bg #F9F6F3।
                lg থেকে white + border, কারণ তখন panel-টা cream — না দিলে
                input আর background একই রঙ হয়ে মিলিয়ে যেত। */}
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 pr-11 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
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
          {/* একই `showPassword` state — দুটো field আলাদা করে toggle করলে
              "দুটো মিলছে কিনা চোখে দেখে নিই" কাজটাই কঠিন হয়ে যেত। */}
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full h-[40px] md:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] md:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
            placeholder="Type it again"
          />
        </div>

        {/* Update Password — login-এর Login button-এর সাথে একদম identical */}
        <div className="pt-5 xl:pt-0">
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className={PILL_BUTTON}
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

      {/* Log in line — Figma: Sora 400, 12px, LH 160%, center। xl-এ 16px */}
      <p className="text-center font-sora font-normal text-[12px] xl:text-[16px] leading-[160%] text-black/70 mt-4 xl:mt-7">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-black hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

/**
 * useSearchParams() prerender-এর সময় Suspense boundary দাবি করে —
 * না দিলে build-এ "missing suspense boundary with useSearchParams"
 * error দিয়ে থেমে যায়। fallback-এ পুরো shell-টাই render করা হয়, শুধু
 * ভেতরটা ফাঁকা: token পড়া হয় client-এ, তাই অবস্থাটা এক frame-ই থাকে,
 * আর shell আগে থেকে বসে থাকায় content এলে layout লাফায় না।
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell>{null}</AuthShell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
