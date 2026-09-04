"use client";

import Link from "next/link";
import Image from "next/image";
import {
  FaApple,
  FaGooglePlay,
  FaInstagram,
  FaLinkedinIn,
  FaFacebookF,
} from "react-icons/fa";

/**
 * src/components/landing/Footer.tsx
 *
 * Figma "Footer - Desktop" — বাইরের wrapper 1440px, padding 60px 80px,
 * bg #000000। ভিতরে max-w 1280px (max-width 1320px) centered container,
 * gap 78px। এই কম্পোনেন্ট OneAppSection.tsx-এর মতোই
 * max-w-[1280px] + responsive px-4/md:px-10/xl:px-20 প্যাটার্ন ফলো করে,
 * যাতে ফুটার বাকি সেকশনগুলোর সাথে ঠিক একই গ্রিডে align হয়।
 *
 * Customer Services / Our Information / Contact Info — Figma-তে এই তিনটা
 * একই "Menus" auto-layout group-এর ভেতরে sibling column (space-between)।
 * তাই কোডেও তিনটাকে একই flex row-এ রাখা হয়েছে, no flex-wrap on md+ —
 * আলাদা group করলে বা wrap রাখলে দ্বিতীয় কলাম নিচে নেমে যায় (আগের bug)।
 *
 * FIX (logo): previously used a hand-drawn placeholder `<BellLogo />`
 * (a flat orange bell), which is why it looked different from the real
 * mark. Swapped it for the actual `/logo.svg` from the public folder —
 * the same gradient bell-with-hand icon `Navbar.tsx` already uses —
 * via `next/image`, so the footer and navbar logos are pixel-identical.
 */

const customerServiceLinks = [
  { label: "My Account", href: "#" },
  { label: "Track Your Order", href: "#" },
  { label: "Return", href: "#" },
  { label: "FAQ", href: "#" },
];

const informationLinks = [
  { label: "Privacy", href: "#" },
  { label: "User Terms & Condition", href: "#" },
  { label: "Return Policy", href: "#", underline: true },
];

const socialLinks = [
  { icon: FaInstagram, label: "Instagram", href: "#" },
  { icon: FaLinkedinIn, label: "LinkedIn", href: "#" },
  { icon: FaFacebookF, label: "Facebook", href: "#" },
];

function FooterMenuLink({
  href,
  label,
  underline,
}: {
  href: string;
  label: string;
  underline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`font-sora text-[14px] leading-[1.6] text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
        underline ? "underline" : ""
      }`}
    >
      {label}
    </Link>
  );
}

function StoreButtonSmall({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant: "apple" | "play";
}) {
  return (
    <a
      href="#"
      aria-label={label}
      className={`flex h-[46px] items-center justify-center gap-[5px] rounded-full px-5 font-sora text-[13px] font-semibold leading-[1.6] transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
        variant === "apple" ? "bg-[#FF9540] text-white" : "bg-white text-black"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="flex flex-col items-center bg-black px-4 py-10 md:px-10 md:py-14 xl:px-20 xl:py-[60px]">
      {/* Container — mirrors the 1280px content width used across every landing section */}
      <div className="flex w-full max-w-[1280px] flex-col items-center gap-12 md:gap-16 xl:gap-[78px]">
        {/* Content: top (logo/desc/social) + menu columns + contact */}
        <div className="flex w-full flex-col items-start gap-12 md:flex-row md:justify-between md:gap-10 xl:gap-[80px]">
          {/* Top: logo + description + socials */}
          <div className="flex w-full max-w-[370px] flex-col items-start gap-[30px]">
            <div className="flex flex-col items-start gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo 2.svg"
                  alt="Cuisine logo"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
                <span className="font-frank-ruhl text-[28px] font-bold leading-[1.26] tracking-[-0.01em] text-[#FF9540]">
                  Cuisine
                </span>
              </Link>
              <p className="font-sora text-[16px] leading-[1.6] text-white/70">
                Cuisine brings your favorite restaurants and delicious meals
                together in one seamless food delivery experience.
              </p>
            </div>

            <div className="flex items-center gap-5">
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-5 w-5 items-center justify-center text-white transition-opacity hover:opacity-70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Menus: Customer Services + Our Information + Contact Info — one row, three columns */}
          <div className="flex w-full flex-col gap-10 sm:flex-row sm:flex-wrap sm:gap-x-16 sm:gap-y-10 md:w-auto md:flex-1 md:flex-nowrap md:justify-between md:gap-10 xl:gap-16">
            <div className="flex flex-col items-start gap-4">
              <h3 className="font-frank-ruhl text-[18px] font-semibold leading-[1.3] text-white">
                Customer Services
              </h3>
              <div className="flex flex-col items-start gap-[7px]">
                {customerServiceLinks.map((link) => (
                  <FooterMenuLink key={link.label} {...link} />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-4">
              <h3 className="font-frank-ruhl text-[18px] font-semibold leading-[1.3] text-white">
                Our Information
              </h3>
              <div className="flex flex-col items-start gap-[7px]">
                {informationLinks.map((link) => (
                  <FooterMenuLink key={link.label} {...link} />
                ))}
              </div>
            </div>

            <div className="flex w-full max-w-[300px] flex-col items-start gap-4 sm:w-auto">
              <h3 className="font-frank-ruhl text-[18px] font-semibold leading-[1.3] text-white">
                Contact Info
              </h3>
              <div className="flex flex-col items-start gap-[7px]">
                <a
                  href="tel:+0123456789"
                  className="font-sora text-[14px] leading-[1.6] text-white"
                >
                  +0123-456-789
                </a>
                <a
                  href="mailto:example@gmail.com"
                  className="font-sora text-[14px] leading-[1.6] text-white underline"
                >
                  example@gmail.com
                </a>
                <p className="font-sora text-[14px] leading-[1.6] text-white">
                  8602 Preston Rd. Inglewood, Maine 98380
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom content: copyright — divider — install/store buttons */}
        <div className="flex w-full flex-col items-center gap-6 md:flex-row md:gap-[26px]">
          <p className="font-sora text-[12px] leading-[1.7] text-white/50">
            © 2026 Cuisine. All rights reserved.
          </p>

          <span
            className="hidden h-px flex-1 bg-[#52525A]/10 md:block"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
            <span className="font-sora text-[12px] leading-[1.7] text-white/70">
              Install on your device
            </span>
            <div className="flex items-center gap-2">
              <StoreButtonSmall
                icon={<FaApple className="h-4 w-4" aria-hidden="true" />}
                label="Apple Store"
                variant="apple"
              />
              <StoreButtonSmall
                icon={<FaGooglePlay className="h-4 w-4" aria-hidden="true" />}
                label="Play store"
                variant="play"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}