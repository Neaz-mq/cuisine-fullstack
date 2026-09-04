"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import AccountMenu from "@/components/AccountMenu";
import { NAV_ITEMS } from "@/lib/landing-content";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * src/components/SiteNavbar.tsx
 *
 * Figma Frame 2147236005 — আড়াআড়ি navbar: logo বাঁয়ে, মাঝে লিঙ্ক,
 * ডানে Log In · Sign Up · cart। নিচে 1px `rgba(0,0,0,0.1)` রেখা।
 *
 * ── কেন নতুন ফাইল, পুরনোটা বদলে নয় ─────────────────────────────────
 *
 * ⚠️ পুরনো `Navbar.tsx` একটা **খাড়া বাঁ-দিকের rail** (`w-20`, sticky,
 * ভেতরে framer-motion-এর drawer)। Figma-র navbar গড়নে সম্পূর্ণ আলাদা —
 * ওটাকে "একটু বদলে" এটা বানানো যায় না, প্রায় প্রতিটা লাইনই আলাদা।
 * তাই নতুন ফাইল, আর পুরনোটা অক্ষত — নতুনটা চোখে দেখে পছন্দ হলে
 * তারপর মুছবেন। (`Banner.tsx`-এর ক্ষেত্রেও একই কথা।)
 *
 * ⚠️ cart-এর সংখ্যা আর অ্যাকাউন্টের menu পুরনো `TopBar` থেকে এসেছে,
 * নতুন করে লেখা হয়নি — `useCart()` আর `<AccountMenu />` দুটোই আগের।
 */
export default function SiteNavbar() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const isSignedIn = status === "authenticated";

  return (
    <header className="w-full bg-[#F9F6F3]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-10 xl:px-20">
        <nav
          aria-label="Primary"
          className="flex items-center justify-between gap-4 py-4 xl:py-5"
        >
          {/* Logo: Frank Ruhl Libre 700 30px, পাশে gradient চিহ্ন। */}
          <Link
            href="/"
            className={`flex shrink-0 items-center gap-3 ${FOCUS_RING}`}
            aria-label="Cuisine home"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] xl:h-10 xl:w-10"
              aria-hidden="true"
            />
            <span className="font-frank-ruhl text-[22px] font-bold leading-none text-black xl:text-[30px]">
              Cuisine
            </span>
          </Link>

          {/**
           * ⚠️ লিঙ্কগুলো lg-এর নিচে লুকোনো, drawer-এ চলে যায়। পাঁচটা
           * লিঙ্ক + দুটো বোতাম + cart এক সারিতে ৩২০px-এ অসম্ভব।
           */}
          <ul className="hidden items-center gap-6 lg:flex xl:gap-[30px]">
            {NAV_ITEMS.map((item) => {
              /**
               * ⚠️ হুবহু মিল, `startsWith` নয় — "/" দিয়ে শুরু হয় বলে
               * `startsWith` ব্যবহার করলে **প্রতিটা** পাতায় "Home"
               * সক্রিয় দেখাত।
               */
              const active = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    aria-current={active ? "page" : undefined}
                    className={`font-sora text-[16px] leading-[1.6] text-black transition-opacity hover:opacity-70 xl:text-[18px] ${
                      active ? "font-semibold" : "font-normal"
                    } ${FOCUS_RING}`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            {/**
             * ⚠️ Figma-তে সবসময় "Log In / Sign Up" — কিন্তু ঢুকে থাকা
             * ব্যবহারকারীকে ওদুটো দেখানো অর্থহীন। তাই সাইন-ইন থাকলে
             * প্রজেক্টের নিজের `AccountMenu`, নাহলে Figma-র বোতামজোড়া।
             * designer সম্ভবত কেবল লগ-আউট অবস্থাটাই এঁকেছেন।
             */}
            {isSignedIn ? (
              <AccountMenu />
            ) : (
              <>
                <Link
                  href="/login"
                  className={`hidden h-11 items-center justify-center rounded-[90px] border border-black px-5 font-sora text-[14px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white min-[480px]:flex xl:h-[46px] xl:text-[16px] ${FOCUS_RING}`}
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className={`flex h-11 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 xl:h-[46px] xl:text-[16px] ${FOCUS_RING}`}
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Button: 46×46, radius 90, কালো; ব্যাজ 16px, #D72A37। */}
            <Link
              href="/carts"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[90px] bg-black transition-opacity hover:opacity-90 xl:h-[46px] xl:w-[46px] ${FOCUS_RING}`}
            >
              <ShoppingCart className="h-5 w-5 text-white" strokeWidth={1.5} aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D72A37] px-1 font-sora text-[10px] font-medium leading-none text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[90px] border border-black lg:hidden ${FOCUS_RING}`}
            >
              {menuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <ul className="flex flex-col gap-1 pb-4 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-2xl px-4 py-3 font-sora text-[16px] leading-none text-black transition-colors hover:bg-black/5 ${
                    pathname === item.path ? "bg-white font-semibold" : "font-normal"
                  } ${FOCUS_RING}`}
                >
                  {item.name}
                </Link>
              </li>
            ))}

            {!isSignedIn && (
              <li className="min-[480px]:hidden">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-2xl px-4 py-3 font-sora text-[16px] font-normal leading-none text-black transition-colors hover:bg-black/5 ${FOCUS_RING}`}
                >
                  Log In
                </Link>
              </li>
            )}
          </ul>
        )}

        {/* Rectangle 34628973: 1px, rgba(0,0,0,0.1)। */}
        <div className="h-px w-full bg-black/10" aria-hidden="true" />
      </div>
    </header>
  );
}
