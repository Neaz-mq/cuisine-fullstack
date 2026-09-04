"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { FaShoppingCart } from "react-icons/fa";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { isStaffRole, firstAllowedPath, staffMenuLabel } from "@/lib/permissions";

/**
 * src/components/SiteNavbar.tsx
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
 *   (gradient pill) + cart button (black circle, 46x46) — logged OUT.
 *   Logged IN: those two pills are replaced by an avatar+chevron trigger
 *   that opens a small dropdown (Admin Dashboard / Logout), and the cart
 *   button stays put. See the FIX note below for why this wasn't showing.
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
 * FIX (dropdown not appearing after Google login): this component never
 * read the session at all — it always rendered the static Log In / Sign
 * Up pills, so the avatar+dropdown you get elsewhere (AccountMenu.tsx,
 * wired into the now-unused TopBar.tsx) never had anywhere to show up
 * here. useSession() is added below so this navbar actually reacts to
 * being logged in. The dropdown is intentionally short — just the
 * staff/admin destination and Logout — per the simplified reference
 * design, instead of AccountMenu's fuller My Orders / Loyalty list.
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
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click — same pattern as
  // AccountMenu.tsx / AdminTopbar.tsx.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const showAdminLink = isStaffRole(role);
  const displayName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "Account";

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
            {status === "loading" ? (
              // Session still resolving — avoid a Login/SignUp flash
              // right before it turns into the avatar.
              <div className="h-[46px] w-[46px] animate-pulse rounded-full bg-black/10" />
            ) : session ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex h-[46px] items-center gap-2 rounded-full border border-black/10 bg-white pl-1 pr-3 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={38}
                      height={38}
                      referrerPolicy="no-referrer"
                      className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-black font-sora text-[14px] font-semibold text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden max-w-[120px] truncate font-sora text-[15px] font-semibold text-black sm:inline">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-black/50 transition-transform ${
                      menuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-[20px] border border-black/5 bg-white p-2 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
                  >
                    <div className="truncate px-3.5 pb-2 pt-1 font-sora text-[13px] text-black/50">
                      {session.user?.email}
                    </div>

                    {showAdminLink && (
                      <Link
                        href={firstAllowedPath(role)}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 font-sora text-[15px] text-black transition-colors hover:bg-black/[0.05]"
                      >
                        <LayoutDashboard className="h-4 w-4 shrink-0" />
                        {staffMenuLabel(role)}
                      </Link>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left font-sora text-[15px] text-black transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}

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