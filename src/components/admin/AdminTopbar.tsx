"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Search, X } from "lucide-react";
import { useScreenTier } from "@/components/admin/useScreenTier";

export interface PanelLink {
  label: string;
  href: string;
  /** কোন icon আঁকা হবে — নিচের PANEL_ICONS map দ্রষ্টব্য। */
  icon: "kitchen" | "manager";
}

/**
 * Search-এ যেগুলোর মধ্যে খোঁজা হবে — sidebar-এর nav item। layout থেকে
 * আসে, এখানে হার্ডকোড করা হয় না: তালিকাটা ওখানে scope দিয়ে ছাঁকা
 * (layout.tsx-এর `searchableNavItems`), তাই KITCHEN role-এর কেউ
 * "staff" লিখলে সেটা result-এই আসে না। এখানে আলাদা তালিকা রাখলে দুই
 * জায়গা আলাদা হয়ে যেত, আর search ব্যবহারকারীকে এমন page-এ পাঠাত
 * যেটা খুললে 403।
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * ৩৭৫px-এ hamburger, logo, search, bell আর avatar একসাথে রাখলে
   * search-এর জন্য পড়ে থাকে ~৭০px — placeholder "Search everything..."
   * ওখানে "Sea" হয়ে কেটে যায়, অর্থাৎ input-টা থেকেও কাজের নয়।
   *
   * তাই ফোনে ওটা একটা icon: চাপলে পুরো bar জুড়ে খোলে আর বাকি সব
   * সরে যায়। Gmail, YouTube, GitHub — সবার mobile-এ একই আচরণ, তাই
   * ব্যবহারকারীর কাছে এটা শেখার মতো নতুন কিছু নয়।
   */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  /**
   * ⚠️ icon-মোড থাকা সত্ত্বেও placeholder-টা ৩২০px-এ কাটে, আর সেটাই
   * এখানকার সূক্ষ্ম জায়গা। খোলার পর input পুরো bar জুড়ে ছড়ায় ঠিকই,
   * কিন্তু পাশে বন্ধ করার ✕ বোতামটা থেকে যায় — আর সেটা ছাড়া keyboard
   * ব্যবহারকারীর বেরোনোর পথ থাকে না, তাই ওটা সরানোও যায় না।
   *
   *   ২৮৮ (৩২০ − shell padding) − ৪৪ (✕ + gap) − ৪৮ (pl-12) − ১৬ (pr-4)
   *   = ১৮০px
   *
   * "Search everything..." Sora 16px-এ ~১৬৬ — কাগজে আঁটে, কিন্তু
   * ফাঁকটা এত সরু যে ফন্ট লোড হওয়ার আগে fallback ফন্টে মাপা হলেই
   * কেটে যায়। তাই ফোনে ছোট লেখা।
   *
   * ⚠️ `aria-label` বদলায় না — screen reader ব্যবহারকারী সব পর্দাতেই
   * পুরো বিবরণ শোনেন।
   */
  const tier = useScreenTier();

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

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setSearchOpen(false);
    setQuery("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // preventDefault: নাহলে Safari/Chrome `type="search"`-এ Escape
      // দিয়ে input-ও খালি করে দেয়, অথচ ব্যবহারকারী শুধু dropdown বন্ধ
      // করতে চেয়েছিলেন।
      e.preventDefault();

      // ফোনে search bar-টা খোলা থাকলে Escape-এ পুরোটাই গুটিয়ে যাওয়া
      // উচিত, শুধু dropdown নয় — নাহলে একটা খালি input খোলা থেকে যেত
      // আর ব্যবহারকারীকে আবার X খুঁজতে হতো। Desktop-এ bar বলে কিছু
      // নেই, তাই সেখানে আগের আচরণই থাকে।
      if (mobileSearchOpen) {
        closeMobileSearch();
        return;
      }

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

  // খুললেই keyboard আসুক — না হলে ব্যবহারকারীকে icon চেপে তারপর
  // input-এ আবার আঙুল দিতে হতো, দুই ধাপ যেখানে এক ধাপই যথেষ্ট।
  // focus() কোনো state বদলায় না, তাই effect-এ setState-এর প্রশ্ন নেই।
  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const showResults = searchOpen && query.trim().length > 0;

  /**
   * Figma layout panel: Hug 86px, radius 100px, justify space-between,
   * padding — উপরে/ডানে/নিচে 18px, বাঁয়ে 30px, BG #FFFFFF।
   *
   * `rounded-full`, `rounded-[100px]` নয়: border-radius কখনো উচ্চতার
   * অর্ধেকের বেশি হতে পারে না, তাই 86px উঁচু বারে 100px চাইলে browser
   * নিজে থেকেই 43-এ নামিয়ে আনে — অর্থাৎ পুরোপুরি গোল প্রান্ত, ঠিক যা
   * `rounded-full` দেয়। আগের `rounded-[24px]`-এই গোলাকৃতিটা হারিয়ে
   * যাচ্ছিল।
   *
   * বাঁ পাশে বেশি padding (30 vs 18) ইচ্ছাকৃত: বাঁয়ে খালি লেখা (logo),
   * ডানে গোল pill — গোল জিনিস প্রান্তের কাছে গেলে চোখে বেশি ফাঁক লাগে,
   * তাই কম padding দিলেই ভারসাম্য মেলে।
   */
  /**
   * ⚠️ ৩৯০px-এর নিচে পুরো bar-টা Figma-র মোবাইল frame-এর হুবহু মাপে,
   * আর সেটা করতে হয়েছে কারণ ৩২০px-এ "Cuisine" শব্দচিহ্নটা অন্যভাবে
   * আঁটেই না।
   *
   * Figma (Frame 2147236040): bar 288×56, padding 12, radius 100।
   * ভেতরে —
   *
   *   বাঁ দল  121 = hamburger 32 + gap 8 + (logo 20 + gap 6 + "Cuisine" 55)
   *   ডান দল  112 = search 32 + 8 + bell 32 + 8 + avatar 32
   *   মাঝের ফাঁক 31
   *   ────────────────────────────────────────────────────────
   *   12 + 121 + 31 + 112 + 12 = 288 ✓
   *
   * আগে বোতামগুলো ৪৪px ছিল (Apple/Google-এর স্পর্শ-লক্ষ্যের সুপারিশ),
   * আর তাতেই শব্দচিহ্নটা লুকিয়ে রাখতে হচ্ছিল — ৩২০px-এ ওই মাপে
   * "Cuisine"-এর জন্য পড়ে থাকত মোটে ৮px।
   *
   * ⚠️ কিন্তু ছোট স্পর্শ-লক্ষ্যের আপসটা **কেবল ৩৯০px-এর নিচেই**।
   * বাস্তবের প্রায় সব ফোন (iPhone 12/13/14/15, বেশির ভাগ Android)
   * ৩৯০ বা তার চেয়ে চওড়া, তাই সেখানে আগের ৪৪/৫০px মাপই ফিরে আসে।
   * অর্থাৎ Figma-র মকআপ মেলে, আর আঙুলও ছোট বোতামে আটকায় না।
   *
   * `sm:` ব্যবহার করা হয়নি — globals.css-এ sm = 320px, তাই ওটা
   * এখানে কার্যত সবসময় চালু থাকত।
   */
  return (
    <header className="bg-white rounded-full h-[56px] min-[390px]:h-[72px] md:h-[86px] flex items-center justify-between gap-3 px-3 min-[390px]:pl-4 min-[390px]:pr-3 md:pl-[30px] md:pr-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* বাঁ দল — hamburger + brand। ফোনে search খুললে পুরোটা সরে
          যায়, যাতে input পুরো প্রস্থ পায়। */}
      <div
        className={`items-center gap-2 shrink-0 ${
          mobileSearchOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Hamburger — শুধু xl-এর নিচে, যেখানে sidebar drawer হয়ে যায়।
            Desktop-এ sidebar এমনিতেই দৃশ্যমান, তাই সেখানে এটা কেবল
            বিভ্রান্তি বাড়াত। */}
        {/* md-এর নিচে, xl নয়: tablet-এ navigation-টা নিচের icon rail
            সামলায়, তাই সেখানে drawer খোলার কিছু নেই।

            আগে এটা background ছাড়া একটা পাতলা তিন-দাগ ছিল, পাশের গোল
            bell আর avatar-এর সাথে বেমানান। এখন ওদের মতোই গোল বোতাম —
            একই ভাষা। মাপ ৩২ (Figma-র ৩২০px frame) থেকে ৩৯০px-এ ৪৪
            (স্পর্শ-লক্ষ্যের স্বীকৃত ন্যূনতম); কারণ header-এর মন্তব্যে। */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-8 w-8 min-[390px]:h-11 min-[390px]:w-11 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-[#121212] transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 md:hidden"
        >
          <Menu className="h-4 w-4 min-[390px]:h-5 min-[390px]:w-5" strokeWidth={2} aria-hidden="true" />
        </button>

        {/**
         * Logo — sidebar-এ আলাদা করে নেই, তাই brand mark এখানেই।
         *
         * গন্তব্য `/` (storefront home), `/admin` নয় — designer-এর
         * সিদ্ধান্ত। Shopify/Stripe-এর মতো dashboard-এ logo সাধারণত
         * panel-এর নিজের home-এ ফেরায়, কিন্তু এখানে brand mark-টাকে
         * রেস্তোরাঁর সাইটে ফেরার দরজা হিসেবে ধরা হয়েছে।
         *
         * ⚠️ এই কারণেই AdminSidebar থেকে "← Back to site" link-টা
         * সরানো হয়েছে। দুটো একসাথে রাখলে একই গন্তব্যে দুটো রাস্তা
         * থাকত, আর তখন প্রশ্ন উঠত কোনটা "আসল" — বিশেষত যখন দুটো
         * পর্দার দুই প্রান্তে। একটাই থাকুক, সেটাই স্পষ্ট।
         *
         * Panel-এর dashboard-এ ফেরার পথ হারায়নি: sidebar-এর Overview
         * গোষ্ঠীর প্রথম item-ই "Dashboard" (/admin), আর সেটা প্রতিটা
         * role-ই দেখতে পায় (scope: null, দেখুন layout.tsx-এর
         * NAV_SECTIONS)।
         *
         * aria-label লাগে কারণ link-টার ভেতরে কোনো accessible text নেই:
         * <Image>-এ `alt=""` (সচেতনভাবে — পাশের wordmark একই কথা বলে,
         * দুটোই পড়লে screen reader "Cuisine Cuisine" বলত), আর
         * wordmark-টা `hidden md:inline`। ফলে ফোনে link-টা নামহীন হয়ে
         * যেত — screen reader শুধু "link" বলত, কোথায় যায় তার কোনো
         * ইঙ্গিত ছাড়াই। label-এ গন্তব্যটাও বলা আছে, কারণ admin panel-এ
         * বসে logo চাপলে যে সাইটে চলে যাবে সেটা আগেভাগে জানা দরকার।
         */}
        <Link
          href="/"
          aria-label="Cuisine — back to site"
          className="flex items-center gap-1.5 min-[390px]:gap-2 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
        >
          {/* Figma: মোবাইল frame-এ icon 20×20 (gap 6), ডেস্কটপে 34×34।
              `width/height` attribute-এ বড় মাপটাই থাকে — ওটা কেবল
              intrinsic size, আসল মাপ class থেকে আসে, আর বড় থেকে ছোট
              করলে ছবিটা ধারালো থাকে। */}
          <Image
            src="/logo.svg"
            alt=""
            width={34}
            height={34}
            className="h-5 w-5 min-[390px]:h-[34px] min-[390px]:w-[34px]"
          />
          {/* Figma typography panel: Frank Ruhl Libre, 600, 30px,
              line-height 100%, letter-spacing −3%, #000।

              ⚠️ tracking −3%, −1% নয় — sidebar-এর নাম/heading-এ −1%।
              শব্দচিহ্নটা বড় (30px) বলে অক্ষরগুলোকে বেশি টেনে আনা হয়েছে;
              বড় মাপে আলগা লাগে বলে এটা typography-র চেনা কৌশল।

              ⚠️ শব্দচিহ্নটা আগে `hidden md:inline` ছিল — অর্থাৎ ফোনে
              একেবারেই দেখা যেত না। কারণ ছিল জায়গার অভাব, কিন্তু
              অভাবটা তৈরি হয়েছিল আমাদের নিজেদের ৪৪px বোতাম থেকে,
              নকশা থেকে নয়। Figma-র মোবাইল frame-এ এটা স্পষ্ট আছে:
              Frank Ruhl 16px, প্রস্থ 55px, letter-spacing −1%।

              তিনটে ধাপ: 16px (Figma-র ৩২০px মকআপ) → 24px → 30px।
              tracking-ও বদলায়: বড় মাপে −3% (অক্ষর টেনে আনা), ছোট
              মাপে −1% — বড় লেখায় আলগা লাগে বলে বেশি টানা হয়, ছোট
              লেখায় বেশি টানলে পড়তে কষ্ট হয়। */}
          <span className="font-frank-ruhl font-semibold text-[16px] tracking-[-0.01em] min-[390px]:text-[24px] min-[390px]:tracking-[-0.03em] md:text-[30px] leading-none text-black">
            Cuisine
          </span>
        </Link>
      </div>

      {/* ডান দল — Figma-তে search, bell আর user card একসাথে ডান দিকে
          বসে, প্রায় ২০px ফাঁক দিয়ে। আগে search-টা `mx-auto` দিয়ে
          একেবারে মাঝখানে বসানো ছিল, তাই bell থেকে অনেক দূরে সরে
          যাচ্ছিল। */}
      <div className="flex items-center gap-2 md:gap-5 min-w-0 flex-1 justify-end">
        {/* <form> নয় একটা <div>: Enter এখানে "submit" নয়, "যেটা
            highlight করা আছে সেখানে যাও" — form হলে implicit submission
            আর নিচের onKeyDown দুটোই Enter-এ চলার চেষ্টা করত। */}
        <div
          ref={searchRef}
          /**
           * ⚠️ ট্যাবলেটে (৭৬৮–১০২৩px) search ঘরটা সরু — ২৮০px, ৫০৫ নয়।
           *
           * `flex-1` মানে ঘরটা যত জায়গা পায় ততটাই নেয়, আর parent-এ
           * `justify-end` থাকায় সেটা bell-এর গা ঘেঁষে ডানে বসার কথা।
           * কিন্তু ৭৬৮px-এ বাকি জায়গাটা ৫০৫-এর চেয়ে কম, তাই cap-টা
           * কার্যকরই হতো না — ঘরটা logo-র ঠিক পরেই শুরু হয়ে পুরোটা
           * টেনে নিত।
           *
           * Figma-র ৭০৮px মকআপে search ~২৮০px, আর তার বাঁ দিকে
           * logo-র সাথে একটা স্পষ্ট ফাঁক থাকে (দেখুন মকআপ)। lg থেকে
           * আবার ৫০৫, কারণ তখন জায়গার টান নেই।
           */
          className={`relative min-w-0 flex-1 max-w-[505px] md:max-w-[280px] lg:max-w-[505px] ${
            mobileSearchOpen ? "block" : "hidden"
          } md:block`}
        >
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/70 pointer-events-none"
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
            ref={searchInputRef}
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
            placeholder={tier === "narrow" ? "Search" : "Search everything..."}
            aria-label="Search pages"
            role="combobox"
            aria-expanded={showResults}
            aria-controls="admin-search-results"
            aria-autocomplete="list"
            aria-activedescendant={
              showResults && results.length > 0 ? `admin-search-option-${activeSafe}` : undefined
            }
            /* Figma: Sora 400, 16px, line-height 100%, letter-spacing 0%,
               placeholder #000 @70%। আগে 14px আর black/40 ছিল — ফিকে
               placeholder পড়া কঠিন, আর 70% স্পষ্টতই বেশি পাঠযোগ্য। */
            className="w-full h-[50px] bg-[#F9F6F3] rounded-full pl-12 pr-4 font-sora text-[16px] leading-none tracking-normal text-black placeholder-black/70 focus:outline-none focus:ring-2 focus:ring-[#2C6252]/25 transition-shadow"
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

        {/* ফোনে search বন্ধ করার বোতাম — খোলা অবস্থায় input-এর পাশে।
            এটা ছাড়া বেরোনোর একমাত্র উপায় হতো keyboard-এর back, যেটা
            আবিষ্কার করতে হয়। */}
        <button
          type="button"
          onClick={closeMobileSearch}
          aria-label="Close search"
          className={`h-8 w-8 min-[390px]:h-11 min-[390px]:w-11 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-[#121212] transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 md:hidden ${
            mobileSearchOpen ? "flex" : "hidden"
          }`}
        >
          <X className="h-4 w-4 min-[390px]:h-5 min-[390px]:w-5" strokeWidth={2} aria-hidden="true" />
        </button>

        {/* ফোনে search খোলার বোতাম, আর bell + avatar — তিনটেই একসাথে
            সরে যায় যখন search খোলা থাকে। */}
        <div
          className={`items-center gap-2 shrink-0 ${
            mobileSearchOpen ? "hidden md:flex" : "flex"
          } md:gap-5`}
        >
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Search"
            aria-expanded={mobileSearchOpen}
            className="flex h-8 w-8 min-[390px]:h-11 min-[390px]:w-11 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-[#121212] transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 md:hidden"
          >
            <Search className="h-4 w-4 min-[390px]:h-5 min-[390px]:w-5" strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Bell — role অনুযায়ী layout থেকে আসে, বা কিছুই আসে না */}
          {notificationSlot}

          {/* User menu */}
          <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            /* Figma layout panel: Hug 266×50, radius 100px,
               padding 6/12/6/6, gap 20px, BG #F9F6F3।
               উচ্চতা 50 − উপরে-নিচে 6 = ভেতরের সব কিছু 38px, তাই
               avatar-ও 38। */
            /* ⚠️ ৩৯০px-এর নিচে এটা নিছক একটা ৩২px গোল ছবি — কোনো
               cream মোড়ক বা padding নেই, কারণ Figma-র মোবাইল frame-এ
               avatar-টা ৩২×৩২ আর তার চারপাশে কিছু নেই। */
            className="flex items-center gap-3 xl:gap-5 h-8 min-[390px]:h-[50px] bg-transparent min-[390px]:bg-[#F9F6F3] rounded-full p-0 min-[390px]:p-1.5 xl:pr-3 hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
          >
            {image ? (
              <Image
                src={image}
                alt=""
                width={38}
                height={38}
                className="h-8 w-8 min-[390px]:h-[38px] min-[390px]:w-[38px] rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="h-8 w-8 min-[390px]:h-[38px] min-[390px]:w-[38px] rounded-full bg-[#2C6252] text-white font-sora font-semibold text-[12px] min-[390px]:text-[14px] flex items-center justify-center shrink-0">
                {initial}
              </span>
            )}

            {/* মোবাইলে নাম/email লুকানো — 320px-এ ওটুকু জায়গা নেই,
                avatar-ই যথেষ্ট affordance */}
            {/* Figma: এই দুই লাইনের ব্লকটা 166×38। উচ্চতাটাই মাপ দুটো
                নিশ্চিত করে — 18px নাম (line-height 1.14 ≈ 20.5) + 12px
                email (≈13.7) ≈ 38। sidebar-এর user card-এ হুবহু একই
                জোড়া, তাই দুটো জায়গা দেখতে এক লাগে। */}
            {/* xl-এর নিচে শুধু avatar — Figma-র tablet নকশায় trigger-টা
                একটা গোল ছবি, নাম/email নিচের dropdown-এ। ৭৬৮px-এ
                search আর ২৬৬px চওড়া pill একসাথে রাখলে search-টা
                "Searc..." হয়ে যেত। */}
            <span className="hidden xl:flex flex-col items-start min-w-0">
              <span className="font-frank-ruhl font-semibold text-[18px] leading-[1.14] tracking-[-0.01em] text-black truncate max-w-[166px]">
                {name}
              </span>
              <span className="font-sora text-[12px] leading-[1.14] tracking-[-0.01em] text-black/70 truncate max-w-[166px]">
                {email}
              </span>
            </span>

            <svg
              className={`hidden xl:block w-4 h-4 text-black/50 shrink-0 transition-transform ${
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
              {/* xl-এর নিচে trigger-এ শুধু avatar থাকে, তাই কোন
                  account-এ আছি সেটা জানার একমাত্র জায়গা এটাই। sidebar-এর
                  user card-এর মতোই একই typography, যাতে তিন জায়গা
                  দেখতে এক লাগে। */}
              <div className="px-3 pt-2 pb-3 xl:hidden">
                <p className="font-frank-ruhl font-semibold text-[18px] leading-[1.14] tracking-[-0.01em] text-black truncate">
                  {name}
                </p>
                <p className="font-sora text-[12px] leading-[1.14] tracking-[-0.01em] text-black/70 truncate">
                  {email}
                </p>
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
      </div>
    </header>
  );
}