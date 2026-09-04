import {
  FaFacebookF,
  FaLinkedinIn,
  FaInstagram,
  FaApple,
  FaGooglePlay,
} from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { FaPhone, FaLocationDot } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";

/**
 * src/components/Footer.tsx
 *
 * Figma-র নতুন কালো footer — আগের সবুজ (#2C6252) নকশার বদলে। রঙ ও
 * ফন্ট বাকি নতুন সেকশনগুলোর (AboutUs, OneAppSection ইত্যাদি) সাথে
 * একই: font-frank-ruhl / font-sora utility, accent #FF9540।
 *
 * ⚠️ দুটো জিনিস ইচ্ছা করেই Figma থেকে বদলানো হয়েছে:
 *   ১) কপিরাইট লাইনে Figma/আগের কোড দুটোতেই ভুল টেক্সট ছিল
 *      ("Grocery Website Design") — ব্র্যান্ডের নাম "Cuisine" বসানো
 *      হলো।
 *   ২) Figma-র CSS export-এ ইমেইল লেখা আছে "example@gmall.com"
 *      (বানান ভুল) — এখানে সঠিক "example@gmail.com" রাখা হয়েছে,
 *      কারণ ভুল বানানে mailto: লিংকটাও ভেঙে যেত।
 */

/** Customer Services / Our Information কলামের লিংক লিস্ট। */
function FooterLinkList({
  items,
}: {
  items: { label: string; underline?: boolean }[];
}) {
  return (
    <ul className="space-y-2.5 font-sora text-[14px] leading-[1.6] text-white">
      {items.map(({ label, underline }) => (
        <li key={label}>
          <a
            href="#"
            className={`focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
              underline ? "underline" : ""
            }`}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

const socialLinks = [
  { icon: FaInstagram, label: "Instagram" },
  { icon: FaLinkedinIn, label: "LinkedIn" },
  { icon: FaFacebookF, label: "Facebook" },
];

export default function Footer() {
  return (
    <footer
      className="bg-black text-white"
      role="contentinfo"
      aria-label="Site Footer"
    >
      <Container>
        <div className="flex flex-col gap-12 px-4 py-16 md:px-10 xl:px-20 xl:py-[60px]">
          {/* Top: brand column + three menu columns */}
          <div className="flex flex-col gap-10 text-center lg:flex-row lg:justify-between lg:gap-10 lg:text-left">
            {/* Brand */}
            <div className="flex max-w-[370px] flex-col items-center gap-4 lg:items-start">
              <Link
                href="/"
                aria-label="Navigate to homepage"
                className="flex items-center gap-3"
              >
                <Image src="/logo.svg" alt="" width={40} height={40} aria-hidden="true" />
                <span className="font-frank-ruhl text-[26px] font-bold leading-[1.26] tracking-[-0.01em] text-[#FF9540] md:text-[30px]">
                  Cuisine
                </span>
              </Link>
              <p className="font-sora text-[15px] leading-[1.6] text-white/70 md:text-[16px]">
                Cuisine brings your favorite restaurants and delicious meals
                together in one seamless food delivery experience.
              </p>
              <div className="flex items-center gap-5" aria-label="Follow Cuisine on social media">
                {socialLinks.map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="flex h-5 w-5 items-center justify-center text-white transition-opacity hover:opacity-70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                  >
                    <Icon className="h-full w-full" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {/* Menu columns */}
            <div className="flex flex-col items-center gap-10 sm:flex-row sm:justify-center sm:gap-16 lg:items-start lg:justify-start xl:gap-[142px]">
              <nav aria-labelledby="footer-customer-services">
                <h2
                  id="footer-customer-services"
                  className="mb-4 font-frank-ruhl text-[17px] font-semibold leading-[1.3] text-white md:text-[18px]"
                >
                  Customer Services
                </h2>
                <FooterLinkList
                  items={[
                    { label: "My Account" },
                    { label: "Track Your Order" },
                    { label: "Return" },
                    { label: "FAQ", underline: true },
                  ]}
                />
              </nav>

              <nav aria-labelledby="footer-our-information">
                <h2
                  id="footer-our-information"
                  className="mb-4 font-frank-ruhl text-[17px] font-semibold leading-[1.3] text-white md:text-[18px]"
                >
                  Our Information
                </h2>
                <FooterLinkList
                  items={[
                    { label: "Privacy" },
                    { label: "User Terms & Condition" },
                    { label: "Return Policy", underline: true },
                  ]}
                />
              </nav>

              <address className="not-italic">
                <h2 className="mb-4 font-frank-ruhl text-[17px] font-semibold leading-[1.3] text-white md:text-[18px]">
                  Contact Info
                </h2>
                <ul className="space-y-2.5 font-sora text-[14px] leading-[1.6] text-white">
                  <li className="flex items-center justify-center gap-2 lg:justify-start">
                    <FaPhone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href="tel:+0123456789"
                      className="underline focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                    >
                      +0123-456-789
                    </a>
                  </li>
                  <li className="flex items-center justify-center gap-2 lg:justify-start">
                    <MdEmail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href="mailto:example@gmail.com"
                      className="underline focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                    >
                      example@gmail.com
                    </a>
                  </li>
                  <li className="flex items-start justify-center gap-2 text-left lg:justify-start">
                    <FaLocationDot aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>8602 Preston Rd. Inglewood, Maine 98380</span>
                  </li>
                </ul>
              </address>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-white/10" aria-hidden="true" />

          {/* Bottom bar */}
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <span className="font-sora text-[12px] leading-[1.7] text-white/50">
              © {new Date().getFullYear()} Cuisine. All rights reserved.
            </span>

            <div className="flex items-center gap-4">
              <span className="font-sora text-[12px] leading-[1.7] text-white/70">
                Install on your device
              </span>
              <a
                href="#"
                aria-label="Apple Store"
                className="flex h-11 items-center gap-1.5 rounded-full bg-[#FF9540] px-5 font-sora text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
              >
                <FaApple className="h-4 w-4" aria-hidden="true" />
                Apple Store
              </a>
              <a
                href="#"
                aria-label="Play Store"
                className="flex h-11 items-center gap-1.5 rounded-full bg-white px-5 font-sora text-[13px] font-semibold text-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
              >
                <FaGooglePlay className="h-4 w-4" aria-hidden="true" />
                Play Store
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}