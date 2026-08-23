"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export interface PanelLink {
  label: string;
  href: string;
  /** কোন icon আঁকা হবে — নিচের PANEL_ICONS map দ্রষ্টব্য। */
  icon: "kitchen" | "manager";
}

interface AdminTopbarProps {
  name: string;
  email: string;
  role: string;
  /** Google sign-in থেকে আসে; credentials account-এ সাধারণত null। */
  image?: string | null;
  /**
   * Dropdown-এ যে panel shortcut গুলো দেখানো হবে। layout থেকে scope
   * অনুযায়ী ছেঁকে আসে — এখানে হিসাব করলে permission logic দুই জায়গায়
   * ছড়িয়ে পড়ত, আর KITCHEN role-এর কেউ "Manager Panel" দেখে click
   * করে 403 খেতেন।
   */
  panels?: PanelLink[];
  /**
   * NotificationBell server layout-এ তৈরি হয় কারণ কোন bell দেখানো হবে তা
   * role-এর উপর নির্ভর করে, আর সেই সিদ্ধান্ত ওখানেই আছে। এখানে শুধু
   * বসানোর জায়গা — এই component-কে permission নিয়ে ভাবতে হয় না।
   */
  notificationSlot?: React.ReactNode;
}

/**
 * Dropdown icon গুলো — Figma design-এর 24px outline set।
 * lucide-react project-এ আছে, কিন্তু এই কটার জন্য inline SVG-ই যথেষ্ট
 * আর bundle-এ কিছু যোগ করে না।
 */
const ICONS = {
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" fill="currentColor" />
      <path
        d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
        fill="currentColor"
      />
    </>
  ),
  kitchen: (
    <>
      <rect x="6" y="9" width="11" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 11h1.5a2 2 0 010 4H17" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 6v1.5M12 6v1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  manager: (
    <>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 17.5c1-2 2.6-3 4.5-3s3.5 1 4.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  switch: (
    <>
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  logout: (
    <>
      <path d="M14 8V6.5A1.5 1.5 0 0012.5 5h-6A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19h6a1.5 1.5 0 001.5-1.5V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 12h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
} as const;

function MenuIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/**
 * src/components/admin/AdminTopbar.tsx
 *
 * Figma admin design-এর উপরের bar: logo, search, notification, user menu।
 */
export default function AdminTopbar({
  name,
  email,
  role,
  image,
  panels = [],
  notificationSlot,
}: AdminTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * বাইরে click করলে menu বন্ধ। `mousedown`, `click` নয় — click-এ করলে
   * menu item-এর নিজের onClick চলার আগেই DOM থেকে সরে যেতে পারে।
   */
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    // Escape — keyboard user-এর কাছে menu থেকে বেরোনোর একমাত্র পথ,
    // নাহলে tab করে পুরোটা পেরিয়ে যেতে হতো।
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    /**
     * ⚠️ এটা /admin/orders-এ `q` query param পাঠায়। ওই page এখনো `q`
     * পড়ে কিনা জানি না — না পড়লে search কেবল order list-এ নিয়ে যাবে,
     * filter করবে না। Figma-র "Search everything" আসলে global search
     * বোঝায়, কিন্তু পেছনে কোনো search API নেই; order code দিয়ে খোঁজাই
     * সবচেয়ে বাস্তব প্রথম ধাপ, কারণ admin-রা ওটাই সবচেয়ে বেশি খোঁজেন।
     */
    router.push(`/admin/orders?q=${encodeURIComponent(q)}`);
  };

  // Avatar না থাকলে নামের প্রথম অক্ষর। credentials দিয়ে বানানো
  // account-এ image থাকে না, আর ভাঙা <img> icon-এর চেয়ে initial ভালো।
  const initial = (name || email).trim().charAt(0).toUpperCase();

  return (
    <header className="bg-white rounded-[24px] px-4 md:px-6 h-[72px] flex items-center gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Logo — sidebar-এ আলাদা করে নেই, তাই brand mark এখানেই */}
      <Link href="/admin" className="flex items-center gap-2 shrink-0">
        <Image
          src="/logo.svg"
          alt=""
          width={32}
          height={32}
          className="w-8 h-8"
        />
        <span className="font-frank-ruhl font-bold text-[22px] leading-none tracking-[-0.01em] text-black hidden md:inline">
          Cuisine
        </span>
      </Link>

      {/* Search — max-w দিয়ে মাঝখানে, Figma-র মতো। form ব্যবহার করা
          হয়েছে যাতে Enter কাজ করে; button ছাড়া শুধু input দিলে
          keyboard-only user submit করতে পারতেন না। */}
      <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-[520px] mx-auto">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-black/40 pointer-events-none"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M13.5 13.5L17 17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders..."
            aria-label="Search orders"
            className="w-full h-[44px] bg-[#F9F6F3] rounded-full pl-11 pr-4 font-sora text-[14px] text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#2C6252]/25 transition-shadow"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Bell — role অনুযায়ী layout থেকে আসে, বা কিছুই আসে না */}
        {notificationSlot}

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 bg-[#F9F6F3] rounded-full pl-1.5 pr-3 py-1.5 hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
          >
            {image ? (
              <Image
                src={image}
                alt=""
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-9 h-9 rounded-full bg-[#2C6252] text-white font-sora font-semibold text-[14px] flex items-center justify-center shrink-0">
                {initial}
              </span>
            )}

            {/* মোবাইলে নাম/email লুকানো — 320px-এ ওটুকু জায়গা নেই,
                avatar-ই যথেষ্ট affordance */}
            <span className="hidden md:flex flex-col items-start min-w-0">
              <span className="font-sora font-semibold text-[14px] leading-tight text-black truncate max-w-[160px]">
                {name}
              </span>
              <span className="font-sora text-[12px] leading-tight text-black/50 truncate max-w-[160px]">
                {email}
              </span>
            </span>

            <svg
              className={`w-4 h-4 text-black/50 shrink-0 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-[248px] bg-white rounded-[24px] shadow-[0_12px_32px_rgba(0,0,0,0.14)] p-2 z-50"
            >
              {/* মোবাইলে trigger button-এ নাম দেখানো হয় না, তাই এখানে —
                  নাহলে কোন account-এ আছি সেটা জানার উপায় থাকত না */}
              <div className="px-3 pt-2 pb-3 md:hidden">
                <p className="font-sora font-semibold text-[14px] text-black truncate">
                  {name}
                </p>
                <p className="font-sora text-[12px] text-black/50 truncate">{email}</p>
              </div>

              {/* Profile — Figma-র প্রথম item, cream pill দিয়ে হাইলাইট করা।
                  ⚠️ href নিয়ে নিশ্চিত নই: app-এ আলাদা কোনো profile page
                  নেই, /account/orders আর /account/loyalty আছে। আপাতত
                  orders-এ পাঠানো হচ্ছে — আসল profile page হলে বদলে নিও। */}
              <Link
                href="/account/orders"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-[#F9F6F3] font-sora text-[15px] text-black hover:bg-black/[0.06] transition-colors"
              >
                <MenuIcon name="profile" />
                Profile
              </Link>

              {/* Panel shortcut — কোনগুলো দেখাবে তা layout scope থেকে ঠিক
                  করে পাঠায়। একটাও না থাকলে (যেমন শুধু WAITER) পুরো
                  অংশটাই render হয় না, ফাঁকা জায়গা পড়ে থাকে না। */}
              {panels.map((panel) => (
                <Link
                  key={panel.href}
                  href={panel.href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] font-sora text-[15px] text-black hover:bg-black/[0.04] transition-colors"
                >
                  <MenuIcon name={panel.icon} />
                  {panel.label}
                </Link>
              ))}

              {/* role badge — Figma-তে নেই, কিন্তু এই app-এ একজনের একাধিক
                  panel-এ access থাকতে পারে, তাই "আমি এখন কোন ভূমিকায়" —
                  সেটা দেখানোটা কাজে লাগে। */}
              <p className="px-3.5 pt-2 pb-1 font-sora text-[11px] font-semibold uppercase tracking-wide text-[#2C6252]">
                {role}
              </p>

              {/* Switch Account — Figma-তে "Add Account" লেখা, কিন্তু নামটা
                  ইচ্ছাকৃতভাবে বদলানো। "Add" বললে বোঝায় দুটো account
                  একসাথে থাকবে, Gmail-এর মতো — NextAuth একবারে একটাই
                  session ধরে, তাই সেটা মিথ্যে প্রতিশ্রুতি হতো। এখানে
                  আসলে logout হয়ে login page-এ যাওয়া হয়, আর "Switch"
                  ঠিক সেটাই বলে।

                  callbackUrl "/login" — logout-এর "/" নয়: ব্যবহারকারী
                  অন্য account-এ ঢুকতে চাইছেন, তাঁকে homepage-এ ফেলে
                  আবার login খুঁজতে বলার কোনো মানে নেই। */}
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[16px] font-sora text-[15px] text-black hover:bg-black/[0.04] transition-colors"
              >
                <MenuIcon name="switch" />
                Switch Account
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[16px] font-sora text-[15px] text-black hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <MenuIcon name="logout" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
