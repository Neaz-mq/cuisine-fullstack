"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Search-এ যেগুলোর মধ্যে খোঁজা হবে — sidebar-এর nav item। layout থেকে
 * আসে, এখানে হার্ডকোড করা হয় না: তালিকাটা ওখানে scope দিয়ে ছাঁকা
 * (visibleNavItems), তাই KITCHEN role-এর কেউ "staff" লিখলে সেটা
 * result-এই আসে না। এখানে আলাদা তালিকা রাখলে দুই জায়গা আলাদা হয়ে
 * যেত, আর search ব্যবহারকারীকে এমন page-এ পাঠাত যেটা খুললে 403।
 */
export interface NavItem {
  label: string;
  href: string;
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
  /** Search-এর উৎস — উপরে NavItem-এর comment দ্রষ্টব্য। */
  navItems?: NavItem[];
  /**
   * NotificationBell server layout-এ তৈরি হয় কারণ কোন bell দেখানো হবে তা
   * role-এর উপর নির্ভর করে, আর সেই সিদ্ধান্ত ওখানেই আছে। এখানে শুধু
   * বসানোর জায়গা — এই component-কে permission নিয়ে ভাবতে হয় না।
   */
  notificationSlot?: React.ReactNode;
  /** xl-এর নিচে nav drawer খোলে — AdminShell থেকে। */
  onMenuClick?: () => void;
}

/**
 * Default prop-এ `[]` সরাসরি লিখলে প্রতি render-এ নতুন array তৈরি হতো,
 * আর নিচের useMemo-র dependency প্রতিবারই বদলে যেত — অর্থাৎ memo করার
 * কোনো লাভই থাকত না। module scope-এ একটাই খালি array রেখে সেটা এড়ানো।
 */
const EMPTY_NAV: NavItem[] = [];

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
  navItems = EMPTY_NAV,
  notificationSlot,
  onMenuClick,
}: AdminTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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

  /**
   * Search result-এর ক্ষেত্রেও একই ব্যাপার — বাইরে click করলে বন্ধ।
   * এখানে Escape আলাদা করে input-এর onKeyDown-এও ধরা আছে, কারণ input-এ
   * focus থাকা অবস্থায় Escape চাপলে সেটা document পর্যন্ত পৌঁছায় ঠিকই,
   * কিন্তু browser-ভেদে `type="search"` input নিজেই Escape দিয়ে লেখা
   * মুছে ফেলে — দুই আচরণ যেন একসাথে না ঘটে।
   */
  useEffect(() => {
    if (!searchOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  /**
   * Figma-র "Search everything" এখানে মানে: sidebar-এর যে page গুলোতে
   * এই ব্যবহারকারীর access আছে, তার মধ্যে খোঁজা। পেছনে কোনো search API
   * নেই, তাই এটা সম্পূর্ণ client-side — তালিকাটা সর্বোচ্চ ১৭টা item,
   * প্রতিটা keystroke-এ filter করা হলেও কিছুই টের পাওয়া যায় না।
   *
   * substring match, শুধু prefix নয় — "cards" লিখে "Gift Cards" পাওয়া
   * যায়, "deliveries" লিখে "My Deliveries"। তবে prefix-এ মেলা item
   * আগে সাজানো হয়: "in" লিখলে "Inventory"/"Insights" আগে, আর যেগুলোর
   * মাঝখানে "in" আছে ("Marketing", "Settings") সেগুলো পরে।
   *
   * sort stable, তাই একই র‍্যাঙ্কের item গুলো sidebar-এর নিজস্ব ক্রমেই
   * থাকে — "m" চাপলে My Deliveries → Menu → Marketing, ঠিক যে ক্রমে
   * ওগুলো বাঁয়ে সাজানো আছে।
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMPTY_NAV;

    return navItems
      .filter((item) => item.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const aPrefix = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bPrefix = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        return aPrefix - bPrefix;
      });
  }, [navItems, query]);

  /**
   * লেখা বদলালে result কমে যেতে পারে, অথচ activeIndex আগের জায়গায় থেকে
   * যেতে পারে — তখন Enter চাপলে `results[activeIndex]` undefined হয়ে
   * crash করত। render আর Enter দুই জায়গাতেই এই clamp করা মানটাই ব্যবহার
   * হয়, তাই দুটো কখনো আলাদা হয় না।
   */
  const activeSafe = results.length > 0 ? Math.min(activeIndex, results.length - 1) : 0;

  const goTo = (href: string) => {
    setQuery("");
    setSearchOpen(false);
    setActiveIndex(0);
    router.push(href);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // preventDefault: নাহলে Safari/Chrome `type="search"`-এ Escape
      // দিয়ে input-ও খালি করে দেয়, অথচ ব্যবহারকারী শুধু dropdown বন্ধ
      // করতে চেয়েছিলেন।
      e.preventDefault();
      setSearchOpen(false);
      return;
    }

    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIndex((prev) => (Math.min(prev, results.length - 1) + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIndex(
        (prev) => (Math.min(prev, results.length - 1) - 1 + results.length) % results.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeSafe].href);
    }
  };

  // Avatar না থাকলে নামের প্রথম অক্ষর। credentials দিয়ে বানানো
  // account-এ image থাকে না, আর ভাঙা <img> icon-এর চেয়ে initial ভালো।
  const initial = (name || email).trim().charAt(0).toUpperCase();

  const showResults = searchOpen && query.trim().length > 0;

  return (
    <header className="bg-white rounded-[100px] px-3 sm:px-4 md:px-6 h-[72px] flex items-center gap-2 sm:gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Hamburger — শুধু xl-এর নিচে, যেখানে sidebar drawer হয়ে যায়।
          Desktop-এ sidebar এমনিতেই দৃশ্যমান, তাই সেখানে এটা কেবল
          বিভ্রান্তি বাড়াত। */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="shrink-0 rounded-lg p-2 text-black/60 transition-colors hover:bg-black/5 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 xl:hidden"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Logo — sidebar-এ আলাদা করে নেই, তাই brand mark এখানেই */}
      <Link href="/admin" className="hidden sm:flex items-center gap-2 shrink-0">
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

      {/* Search — max-w দিয়ে মাঝখানে, Figma-র মতো। <form> নয় একটা
          <div>: Enter এখানে "submit" নয়, "যেটা highlight করা আছে সেখানে
          যাও" — form হলে implicit submission আর নিচের onKeyDown দুটোই
          Enter-এ চলার চেষ্টা করত। */}
      <div ref={searchRef} className="relative flex-1 min-w-0 max-w-[520px] mx-auto">
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
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
            // নতুন লেখায় নতুন তালিকা — highlight আবার প্রথম item-এ।
            setActiveIndex(0);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search everything..."
          aria-label="Search pages"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="admin-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && results.length > 0 ? `admin-search-option-${activeSafe}` : undefined
          }
          className="w-full h-[44px] bg-[#F9F6F3] rounded-full pl-11 pr-4 font-sora text-[14px] text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#2C6252]/25 transition-shadow"
        />

        {showResults && (
          <div
            id="admin-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-[20px] shadow-[0_12px_32px_rgba(0,0,0,0.14)] p-2 z-50 max-h-[320px] overflow-y-auto"
          >
            {results.length === 0 ? (
              <p className="px-3.5 py-3 font-sora text-[14px] text-black/50">
                No pages match &ldquo;{query.trim()}&rdquo;
              </p>
            ) : (
              results.map((item, index) => (
                <button
                  key={item.href}
                  id={`admin-search-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeSafe}
                  // mouse দিয়ে hover করলেই highlight সরে আসে, যাতে
                  // keyboard আর mouse দুটো আলাদা "নির্বাচিত" item না
                  // দেখায় — Enter সবসময় যেটা দেখা যাচ্ছে সেটাতেই যাবে।
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo(item.href)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-sora text-[15px] text-left transition-colors ${
                    index === activeSafe ? "bg-[#F9F6F3] text-black" : "text-black/80"
                  }`}
                >
                  <svg
                    className="w-4 h-4 shrink-0 text-black/40"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 10h12m0 0l-4-4m4 4l-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

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
