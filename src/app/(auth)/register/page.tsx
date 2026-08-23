"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  type Country,
} from "@/components/CountryCodeSelect";
import { toE164, isValidPhone, examplePhone } from "@/lib/phone";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  // Consent must be an explicit action, so this starts unchecked. A
  // pre-ticked box is not valid consent under GDPR and is a dark pattern
  // regardless of jurisdiction.
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  // Field-level, kept apart from `error` so a phone problem is shown next
  // to the phone input rather than in the banner at the top of the form.
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Functional update: React batches these, and the object spread off a
    // captured `form` can drop a keystroke when two fire in one tick.
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear a stale phone error the moment they start correcting it —
    // it gets re-checked on blur.
    if (name === "phone" && phoneError) setPhoneError("");
  };

  /**
   * Validated on blur rather than on every keystroke: flagging "017" as
   * invalid while someone is still mid-way through typing it is noise, not
   * help.
   *
   * The country is passed in rather than read from state because the
   * country-change handler calls this with the NEW country, before the
   * state update has been applied.
   */
  const validatePhone = (national: string, forCountry: Country) => {
    if (!national.trim()) {
      setPhoneError("");
      return false;
    }
    const ok = isValidPhone(toE164(forCountry.dial, national));
    setPhoneError(ok ? "" : `Please enter a valid ${forCountry.name} number`);
    return ok;
  };

  /**
   * Re-check on country change: a number valid for one country usually
   * isn't for another (Bangladesh takes 10 national digits, Singapore 8),
   * so leaving a stale "valid" state here would let a bad number through.
   */
  const handleCountryChange = (next: Country) => {
    setCountry(next);
    validatePhone(form.phone, next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("Please agree to the Terms & Privacy Policy to continue");
      return;
    }

    // HTML `required` treats "   " as filled, so trim before validating.
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim().toLowerCase();

    if (!firstName) {
      setError("Please enter your first name");
      return;
    }

    // Same helper the API's zod schema uses, so the two can't drift apart.
    if (!validatePhone(form.phone, country)) {
      return;
    }
    const phone = toE164(country.dial, form.phone);

    setLoading(true);

    // ---- Step 1: create the account ----
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone,
          password: form.password,
        }),
      });

      // A 429 from the rate limiter, or a proxy error page, may not be
      // JSON at all — don't let the parse throw into the network branch.
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
    } catch {
      setError("Could not connect to server, please try again later");
      setLoading(false);
      return;
    }

    // ---- Step 2: the account now EXISTS ----
    // Nothing below may report "registration failed": if auto-login trips
    // on a network hiccup, telling the user to retry sends them back to a
    // 409 "email already exists" on an account that is genuinely theirs.
    // Any failure here is a login problem, so route them to login.
    try {
      const signInResult = await signIn("credentials", {
        email,
        password: form.password,
        redirect: false,
      });

      // Check `ok` too — a result can be unsuccessful with `error` unset.
      if (!signInResult?.ok || signInResult.error) {
        router.push("/login?registered=1");
        return;
      }

      router.push("/");
    } catch {
      router.push("/login?registered=1");
    }
  };

  return (
    /* Page — Figma mobile frame: 320px wide, BG #F9F6F3, padding 20px top/bottom
       ও 16px left/right (px-4 py-5)। lg থেকে আগের desktop padding।
       overflow-x-hidden: কোনো child সামান্য বেড়ে গেলেও horizontal bar আসবে না */
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F9F6F3] flex items-center justify-center px-4 py-5 lg:px-4 lg:py-10">
      {/* Wrapper — mobile-এ এটি শুধু grid holder, নিজের কোনো background/padding নেই।
          Figma mobile-এ card মাত্র একটাই (288px white), তাই এখানে white/padding দিলে
          double card হয়ে যেত। lg থেকে এটিই সেই Figma desktop outer card
          (1280×894, radius 30, padding 20, gap 20)। */}
      <div className="w-full max-w-[1280px] bg-transparent p-0 rounded-none lg:bg-white lg:rounded-[30px] lg:p-4 xl:p-5 grid grid-cols-1 lg:grid-cols-2 lg:gap-4 xl:gap-5 lg:min-h-[860px] xl:min-h-[894px]">
        {/* Left visual panel — lg-এর নিচে hidden, তাই mobile-এ form-ই পুরো screen পায়।
            min-w-0: grid child যেন কখনো নিজের content-এর কারণে column ছাড়িয়ে না যায় */}
        <div className="hidden lg:block relative rounded-[16px] xl:rounded-[22px] overflow-hidden w-full min-w-0 h-full">
          <Image
            src="https://res.cloudinary.com/dzi3u164c/image/upload/v1787220856/signup_czzdi1.webp"
            alt="Great food, delivered with care"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />

          {/* Bottom scrim — Figma: Rectangle 610×549, অর্থাৎ panel height-এর ~64%।
              ইচ্ছে করেই inset-0 নয়, যাতে image-এর উপরের অংশ পরিষ্কার থাকে। */}
          <div className="absolute bottom-0 left-0 right-0 h-[64%] bg-gradient-to-t from-black from-15% via-black/75 via-45% to-transparent" />

          {/* Logo — শুধু desktop-এর image panel-এ */}
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

          {/* Bottom content — xl-এ 50px inset মানে ঠিক 510px, form panel padding-এর সমান */}
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

            {/* Stats — xl-এ 510px ও 13.45px gap মিলে 161.03px cards হয় (Figma) */}
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

        {/* Form panel = Figma mobile-এর সেই একমাত্র white card:
            Fill 288px (320 - 16 - 16), radius 20, padding 20, gap 20, #FFFFFF।
            lg থেকে cream inner panel, আগের মতোই। */}
        <div className="w-full min-w-0 h-full bg-white rounded-[20px] p-5 sm:p-8 lg:bg-[#F9F6F3] lg:rounded-[30px] lg:p-0 lg:px-8 lg:py-10 xl:px-[50px] xl:py-[30px] flex flex-col lg:justify-center">
          {/* mobile-এ 320px frame মানে content ঠিক 248px (288 - 20 - 20),
              যেটা Figma-র heading width-এর সাথে মেলে। xl-এ 510px */}
          <div className="w-full max-w-[510px] mx-auto">
            {/* Back to Home — Figma mobile: 52×52 box (radius 16), label Sora 400 16px।
                card gap 20px, তাই mb-5 */}
            <Link
              href="/"
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
                Back to Home
              </span>
            </Link>

            {/* Heading — Figma inspect: Frank Ruhl Libre 500, 36px, LH 130%, tracking 0,
                #000000। 248px width-এ ঠিক দুই লাইনে ভাঙে (Figma-তে box height 94px)।
                mobile-এও 36px, ছোট করা হয়নি।
                Subtitle — Figma inspect: Sora 400, 12px, LH 160%, black/70।
                248×38 মানে ঠিক দুই লাইন (12 × 1.6 × 2 = 38.4)। */}
            <div className="mb-8 xl:mb-8">
              <h1 className="font-frank-ruhl font-medium text-[36px] leading-[130%] tracking-normal text-black">
                Create Your Account
              </h1>
              <p className="font-sora font-normal text-[12px] leading-[160%] tracking-normal text-black/70 mt-2">
                Join Cuisine to order, save favorites, and get exclusive deals.
              </p>
            </div>

            {/* role=alert + aria-live: a screen reader user who submits and
                gets rejected otherwise hears nothing at all change. */}
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
              {/* Figma mobile-এ First/Last একটার নিচে আরেকটা, tablet/desktop-এ পাশাপাশি।
                  Breakpoint `md` (768px) ইচ্ছে করেই — `sm` (640px)-এ দিলে প্রতিটা column
                  ~290px হয়ে placeholder কেটে যায়। 768px থেকে প্রতিটা ~340px, নিরাপদ। */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-4">
                <div className="min-w-0">
                  {/* Labels — Figma: Frank Ruhl Libre 500, 14px, LH 160%, black/100 */}
                  <label
                    htmlFor="firstName"
                    className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                  >
                    First Name <span className="text-red-500">*</span>
                  </label>
                  {/* Input — Figma mobile: height 40px, radius 12, bg #F9F6F3,
                      inner padding ~14px, Sora 14px */}
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                    className="w-full h-[40px] sm:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                    placeholder="First name"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="lastName"
                    className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                  >
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                    className="w-full h-[40px] sm:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                    placeholder="Last name"
                  />
                </div>
              </div>

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
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="w-full h-[40px] sm:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 rounded-xl text-black placeholder-black/35 text-[14px] sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>
                {/* overflow-hidden ইচ্ছে করেই নেই: থাকলে country dropdown clip হয়ে যেত।
                    তাই input-এ আলাদা করে rounded-r-xl দেওয়া হয়েছে */}
                <div
                  className={`flex items-stretch h-[40px] sm:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border rounded-xl focus-within:ring-2 ${
                    phoneError
                      ? "lg:border-red-300 ring-1 ring-red-300 focus-within:ring-red-400"
                      : "lg:border-gray-200 focus-within:ring-[#2C6252]/30"
                  }`}
                >
                  {/* Figma-তে country block ~104px, বাকিটা number। shrink-0 না দিলে
                      select flex-grow করে অর্ধেক জায়গা খেয়ে ফেলে। */}
                  <div className="shrink-0 flex items-stretch">
                    <CountryCodeSelect
                      value={country}
                      onChange={handleCountryChange}
                    />
                  </div>
                  {/* flex-1 + min-w-0: w-full দিলে flex row-এ input container ছাড়িয়ে
                      যেতে চায় আর placeholder কেটে যায় */}
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    onBlur={() => validatePhone(form.phone, country)}
                    required
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-invalid={!!phoneError}
                    aria-describedby={phoneError ? "phone-error" : undefined}
                    className="flex-1 min-w-0 bg-transparent px-3.5 rounded-r-xl text-black placeholder-black/35 text-[14px] sm:text-[15px] focus:outline-none"
                    // A real example number for the selected country, so the
                    // expected length is visible BEFORE they get it wrong.
                    placeholder={examplePhone(country.code) || "Phone number"}
                  />
                </div>
                {phoneError && (
                  <p
                    id="phone-error"
                    role="alert"
                    className="mt-1.5 font-sora text-[12px] leading-[160%] text-red-600"
                  >
                    {phoneError}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-frank-ruhl font-medium text-[14px] leading-[160%] text-black mb-2"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full h-[40px] sm:h-[50px] bg-[#F9F6F3] lg:bg-white border-0 lg:border lg:border-gray-200 px-3.5 pr-11 rounded-xl text-black placeholder-black/35 text-[14px] sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 transition-shadow"
                    placeholder="Min 6 characters"
                  />
                  {/* Reachable by keyboard: someone typing a password with an
                      on-screen keyboard needs this as much as a mouse user. */}
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

              {/* Custom checkbox — a11y/state-এর জন্য native input রাখা হয়েছে, শুধু visually hidden।
                  peer-focus-visible: sr-only input-এ focus গেলে custom box-এ ring দেখায়,
                  নাহলে keyboard user বুঝতেই পারবে না focus কোথায়।
                  Figma-তে box 18px, দুই লাইনের text-এর উল্লম্ব মাঝখানে বসে (items-center) */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="agreed"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only peer"
                />
                <span
                  className={`w-[18px] h-[18px] sm:w-5 sm:h-5 flex-shrink-0 rounded-[6px] border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#2C6252]/40 ${
                    agreed ? "bg-white border-black" : "bg-white border-black/25"
                  }`}
                >
                  {agreed && (
                    <svg
                      viewBox="0 0 12 12"
                      className="w-3 h-3"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6.2L4.5 8.7L10 3"
                        stroke="#000000"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 font-sora font-normal text-[14px] leading-[160%] text-black/80">
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    className="font-semibold text-black hover:underline"
                  >
                    Terms
                  </Link>{" "}
                  &{" "}
                  <Link
                    href="/privacy"
                    className="font-semibold text-black hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {/* Sign Up — Figma mobile: height 48, radius 100, gradient #FF9540 → #FF70C6,
                  label #F9F6F3 (pure white নয়), Sora 600 16px।
                  pt-5: Figma-তে checkbox আর button-এর মাঝে gap দ্বিগুণ (~40px) */}
              <div className="pt-5 xl:pt-0">
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="w-full h-[48px] xl:h-[56px] px-4 sm:px-6 flex items-center justify-center bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-[#F9F6F3] rounded-full font-sora font-semibold text-[16px] leading-[160%] hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 sm:gap-3">
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
                      Creating account...
                    </span>
                  ) : (
                    "Sign Up"
                  )}
                </button>
              </div>
            </form>

            {/* Google — একই pill (48px mobile), Sora 600 16px at black/100 (Figma) */}
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              disabled={loading}
              className="w-full h-[48px] xl:h-[56px] px-4 sm:px-6 mt-5 border border-black rounded-full flex items-center justify-center gap-3 font-sora font-semibold text-[16px] leading-[160%] text-black bg-white hover:bg-black/[0.03] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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

            {/* Log in line — Figma inspect: Sora 400, 12px, LH 160%, center।
                248×19 মানে এক লাইনেই বসে। xl-এ আগের desktop মাপ (16px)। */}
            <p className="text-center font-sora font-normal text-[12px] xl:text-[16px] leading-[160%] text-black/70 mt-4 xl:mt-7">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-black hover:underline"
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