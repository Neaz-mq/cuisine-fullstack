"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaShoppingCart } from "react-icons/fa";

/**
 * src/components/landing/Navbar.tsx
 *
 * Figma "Frame 2147236005" spec:
 * - Outer row (Frame 2147236004): 1280px wide, justify-between, items-center
 * - Logo (icon 40x40 + "Cuisine" wordmark, gap 12px) — wordmark is BLACK
 *   here (#000000), unlike the footer where it's orange.
 * - Nav links (Frame 2147235235): Home / Menu / Our Chefs / Reservation,
 *   gap 30px. NOTE: the CSS export only accounts for these 4 items
 *   (56+51+92+110 + 3*30 = 399px, matching the frame width exactly) —
 *   there is no "Gift Cards" item in the design, so it's removed here.
 * - Right side (Frame 2147235998): Log In (outline pill) + Sign Up
 *   (gradient pill) + cart button (black circle, 46x46).
 * - Divider: 1px full-width line at rgba(0,0,0,0.1) under the row.
 *
 * FIX (bg mismatch): the parent frame in Figma (`sections_css.txt`,
 * "Frame 2147236004" — the one wrapping the black top bar + this navbar
 * + the hero content) has `background: #F9F6F3`. This component was
 * previously transparent, so it fell through to whatever the page/layout
 * background happened to be (white in production) instead of the cream
 * tone. Setting the bg explicitly here means the navbar is correct
 * regardless of what wraps it.
 *
 * ⚠️ Logo: uses /logo.svg from your public folder directly instead of a
 * hand-drawn shape, since that file already contains the gradient bell
 * mark. Swap the `src` below if your file lives at a different path.
 */

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Menu", href: "/menu" },
  { label: "Our Chefs", href: "/our-chefs" },
  { label: "Reservation", href: "/reservation" },
];

export default function Navbar({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();

  return (
    <header className="w-full bg-[#F9F6F3]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start gap-[30px] px-4 pt-5 md:px-10 xl:px-0">
        {/* Row: logo + nav links + auth/cart buttons */}
        <div className="flex w-full items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Cuisine logo"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
            <span className="font-frank-ruhl text-[28px] font-bold leading-[1.26] tracking-[-0.01em] text-black">
              Cuisine
            </span>
          </Link>

          {/* Nav links — desktop only */}
          <nav className="hidden items-center gap-[30px] lg:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-sora text-[18px] leading-[1.6] transition-colors hover:text-black focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
                    isActive ? "font-semibold text-[#141921]" : "font-normal text-black/70"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth buttons + cart */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="flex h-[46px] items-center justify-center rounded-full border border-black px-5 font-sora text-[16px] font-semibold leading-[1.3] text-black transition-opacity hover:opacity-70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex h-[46px] items-center justify-center rounded-full bg-gradient-to-r from-[#FF9540] to-[#FF70C6] px-5 font-sora text-[16px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
            >
              Sign Up
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full bg-black transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
            >
              <FaShoppingCart className="h-[18px] w-[18px] text-white" />
              {/* Badge only renders when there's actually something in the cart */}
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF9540] px-1 font-sora text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Divider */}
        <span className="h-px w-full bg-black/10" aria-hidden="true" />
      </div>
    </header>
  );
}
