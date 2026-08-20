"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("Please agree to the Terms & Privacy Policy to continue");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // NOTE: current /api/register only accepts { name, email, password }.
          // firstName + lastName are combined below. `phone` is collected but
          // not yet sent — extend the API route + Prisma schema first if you
          // want it persisted, then add it here.
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Log the user in directly right after registration
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // If registration succeeded but auto-login fails, send to login page
        router.push("/login");
        return;
      }

      router.push("/");
    } catch {
      setError("Could not connect to server, please try again later");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F9F6F3] flex items-center justify-center px-4 py-6 lg:py-10">
      {/* Outer white card — radius 30, padding 20, gap 20 (from Figma Dev Mode) */}
      <div className="w-full max-w-[1320px] bg-white rounded-[30px] p-3 lg:p-5 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5 shadow-sm lg:h-[894px]">
        {/* Left visual panel — hidden on small screens */}
        <div className="hidden lg:block relative rounded-[22px] overflow-hidden w-full h-full">
          <Image
            src="https://res.cloudinary.com/dzi3u164c/image/upload/v1787220856/signup_czzdi1.webp"
            alt="Great food, delivered with care"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />

          {/* Dark gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5" />

          {/* Logo */}
          <Link
            href="/"
            className="absolute top-10 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2"
            aria-label="Back to home"
          >
            <Image
              src="/logo.svg"
              alt="Cuisine Logo"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="font-frank-ruhl font-bold text-[30px] leading-[126%] tracking-[-0.01em] text-white">
              Cuisine
            </span>
          </Link>

          {/* Bottom content — centered as a block, per Figma */}
          <div className="absolute bottom-10 left-10 right-10 z-10 text-white text-center">
            <h2 className="font-frank-ruhl text-[38px] font-semibold leading-[114%] tracking-[-0.01em] text-white">
              Great Food, Delivered
              <br />
              With Care
            </h2>
            <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-white/80 mt-4 max-w-sm mx-auto">
              Sign in to track your orders, save your favorite dishes, and
              get personalized offers from Cuisine.
            </p>

            {/* Stats — 3 × 161.03px + 2 × 12px gap = 507px (Figma Dev Mode) */}
            <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-[507px] mx-auto">
              <div className="bg-[#F9F6F3] rounded-[14px] h-[73px] px-[30px] flex flex-col items-center justify-center gap-2">
                <div className="font-sora font-semibold text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  50K+
                </div>
                <div className="font-sora font-normal text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Happy Guests
                </div>
              </div>
              <div className="bg-[#F9F6F3] rounded-[14px] h-[73px] px-[30px] flex flex-col items-center justify-center gap-2">
                <div className="font-sora font-semibold text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  4.9
                </div>
                <div className="font-sora font-normal text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Average Rating
                </div>
              </div>
              <div className="bg-[#F9F6F3] rounded-[14px] h-[73px] px-[30px] flex flex-col items-center justify-center gap-2">
                <div className="font-sora font-semibold text-[14px] leading-[120%] tracking-normal text-[#000000] whitespace-nowrap">
                  24/7
                </div>
                <div className="font-sora font-normal text-[12px] leading-[120%] tracking-normal text-[#2D5132]/70 whitespace-nowrap">
                  Live Kitchen
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel — its own cream card (BG #F9F6F3, radius 30, padding 30/50/30/50, gap 24 per Figma), same fixed height as the image panel */}
        <div className="w-full h-full bg-[#F9F6F3] rounded-[30px] flex items-center justify-center px-5 py-8 sm:px-[50px] sm:py-[30px] overflow-y-auto">
          <div className="w-full max-w-md">
            {/* Mobile-only logo */}
            <div className="flex lg:hidden items-center justify-between mb-6">
              <Link
                href="/"
                className="flex items-center gap-2"
                aria-label="Back to home"
              >
                <Image
                  src="/logo.svg"
                  alt="Cuisine Logo"
                  width={40}
                  height={40}
                  className="w-10 h-10"
                />
                <span className="font-frank-ruhl font-bold text-2xl leading-[126%] tracking-[-0.01em] text-[#2C6252]">
                  Cuisine
                </span>
              </Link>
            </div>

            {/* Back to Home — boxed chevron + separate label, matches Figma */}
            <Link
              href="/"
              className="hidden lg:inline-flex items-center gap-3 mb-10 group"
            >
              <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-700 group-hover:bg-gray-50 transition-colors shadow-sm">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M12.5 15L7.5 10L12.5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                Back to Home
              </span>
            </Link>

            <div className="mb-8">
              <h1 className="font-frank-ruhl text-3xl font-bold text-gray-900">
                Create Your Account
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Join Cuisine to order, save favorites, and get exclusive
                deals.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm p-3 mb-5 rounded-lg border border-red-100">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-200 bg-white px-3.5 py-2.5 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 focus:border-[#2C6252] transition-colors"
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className="w-full border border-gray-200 bg-white px-3.5 py-2.5 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 focus:border-[#2C6252] transition-colors"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-200 bg-white px-3.5 py-2.5 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 focus:border-[#2C6252] transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-stretch border border-gray-200 bg-white rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2C6252]/30 focus-within:border-[#2C6252]">
                  <div className="flex items-center gap-1.5 px-3.5 border-r border-gray-200 text-sm text-gray-700 shrink-0">
                    <span className="inline-block w-4 h-3 rounded-[2px] bg-[#006A4E] relative overflow-hidden">
                      <span className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full bg-[#F42A41]" />
                    </span>
                    <span>+880</span>
                    <svg
                      className="w-3.5 h-3.5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none"
                    placeholder="1XXXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full border border-gray-200 bg-white px-3.5 py-2.5 pr-10 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 focus:border-[#2C6252] transition-colors"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.359 1.359a2.5 2.5 0 013.14 3.14l1.359 1.359a4 4 0 00-5.858-5.858z" />
                        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
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

              {/* Custom checkbox — native input kept for a11y/state, visually hidden */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 w-[18px] h-[18px] flex-shrink-0 rounded-[5px] border flex items-center justify-center transition-colors ${
                    agreed
                      ? "bg-white border-gray-900"
                      : "bg-white border-gray-300"
                  }`}
                >
                  {agreed && (
                    <svg
                      viewBox="0 0 12 12"
                      className="w-2.5 h-2.5"
                      fill="none"
                    >
                      <path
                        d="M2 6.2L4.5 8.7L10 3"
                        stroke="#111827"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-gray-600">
                  I agree to the{" "}
                  <Link href="/terms" className="font-semibold text-gray-900 hover:underline">
                    Terms
                  </Link>{" "}
                  &{" "}
                  <Link href="/privacy" className="font-semibold text-gray-900 hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F4A261] to-[#EE6C8B] text-white py-3.5 rounded-full font-semibold text-sm hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
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
                    Creating account...
                  </span>
                ) : (
                  "Sign Up"
                )}
              </button>
            </form>

            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full mt-3 border border-gray-900 py-3.5 rounded-full flex items-center justify-center gap-2.5 text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 transition"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign Up with Google
            </button>

            <p className="text-center text-sm text-gray-500 mt-7">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-gray-900 font-semibold hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}