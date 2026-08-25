"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Award,
  BadgePercent,
  Bell,
  BookOpen,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  CreditCard,
  Gift,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Navigation,
  Package,
  PanelLeft,
  Settings,
  Star,
  Table,
  Ticket,
  Truck,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * src/components/admin/AdminSidebar.tsx
 *
 * Figma admin sidebar: user card → section-wise nav → System (Settings +
 * Logout) পায়ের কাছে।
 *
 * layout.tsx থেকে আলাদা করে client component করা হয়েছে দুটো কারণে —
 * active item চেনার জন্য usePathname লাগে, আর collapse toggle-এর জন্য
 * state। layout নিজে server component থাকায় সেখানে দুটোর কোনোটাই সম্ভব
 * নয়, আর পুরো layout-কে client করা মানে requireAdmin()/prisma query
 * browser-এ টেনে আনার চেষ্টা করা।
 *
 * ⚠️ কোন item দেখা যাবে সেই সিদ্ধান্ত এখানে নেওয়া হয় না — layout scope
 * দিয়ে ছেঁকে পাঠায়। AdminTopbar-এর panels/navItems-এও একই নিয়ম:
 * permission logic এক জায়গায়, presentational component-এ নয়।
 */

/** Figma-র icon set। নাম গুলো lucide-react-এর — string হিসেবে রাখা
 *  হয়েছে যাতে layout.tsx (server component) icon পাঠাতে পারে; সেখান
 *  থেকে সরাসরি component reference পাঠালে সেটা serialize হতো না। */
export type NavIcon =
  | "dashboard"
  | "users"
  | "staff"
  | "suppliers"
  | "kitchen"
  | "orders"
  | "deliveries"
  | "payment"
  | "categories"
  | "menu"
  | "inventory"
  | "tables"
  | "reservations"
  | "notification"
  | "insights"
  | "reviews"
  | "offers"
  | "coupons"
  | "giftCards"
  | "loyalty"
  | "settings";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  staff: User,
  suppliers: Truck,
  kitchen: ChefHat,
  orders: ClipboardList,
  // Suppliers-ও একটা truck, তাই rider-এর জন্য Navigation — একই icon দুটো
  // ভিন্ন জিনিসে বসালে collapsed অবস্থায় (যখন শুধু icon-ই দেখা যায়)
  // দুটোকে আলাদা করার কোনো উপায় থাকত না।
  deliveries: Navigation,
  payment: CreditCard,
  categories: LayoutGrid,
  menu: BookOpen,
  inventory: Package,
  tables: Table,
  reservations: CalendarCheck,
  notification: Bell,
  insights: Lightbulb,
  reviews: Star,
  offers: Ticket,
  coupons: BadgePercent,
  giftCards: Gift,
  loyalty: Award,
  settings: Settings,
};

export interface SidebarItem {
  label: string;
  href: string;
  icon: NavIcon;
  /** ডান পাশের ছোট গোল badge — 0 বা অনুপস্থিত হলে কিছুই দেখায় না। */
  badge?: number;
}

/**
 * Figma-র nav item spec, হুবহু — Layout panel থেকে: radius 12px,
 * padding 12px, gap 8px, height Hug (48px)।
 *
 * ৪৮px উচ্চতাটা আলাদা করে লেখা হয়নি, হিসাবেই এসে যায়: 12px padding +
 * 24px icon + 12px padding = 48। তাই icon-টা h-6 w-6 (24px) হওয়া
 * জরুরি — ছোট করলে row-টা Figma-র চেয়ে বেঁটে হয়ে যাবে, আর সব item
 * উপরে-নিচে সরে যাবে।
 */
const ITEM_BASE =
  "relative flex items-center gap-2 rounded-[12px] py-3 transition-colors";

/**
 * Typography panel থেকে: Frank Ruhl Libre, weight 600, 20px,
 * line-height 100%, letter-spacing 0%।
 *
 * `font-frank-ruhl` globals.css-এ সংজ্ঞায়িত (next/font-এর
 * --font-frank-ruhl variable), Tailwind-এর `font-serif` নয় — ওটা
 * browser-এর default serif-এ পড়ে যেত।
 *
 * leading-6 (24px), `leading-none` নয় — যদিও Figma-তে line-height
 * 100% (20px) লেখা। দেখতে দুটো একই: 48px row-এ 24px icon-এর পাশে
 * text যেভাবেই হোক উল্লম্বভাবে কেন্দ্রে বসে, তাই baseline এক জায়গাতেই
 * পড়ে। পার্থক্য শুধু clip box-এ — label-এ `truncate` আছে (overflow
 * hidden), আর line-height ঠিক 20px হলে সেই box-টা glyph-এর সমান হয়ে
 * যায়, ফলে "My Deliveries"-এর y বা "Categories"-এর g-এর লেজ কেটে
 * যেত। 24px দিলে descender-এর জায়গা থাকে, অথচ row-এর উচ্চতা 48px-ই
 * থাকে (icon-টাই লম্বা)।
 * Weight আর রঙ এখানে নেই, ইচ্ছে করেই: Figma-তে active item 600/সাদা,
 * আর inactive 400/#121212 — অর্থাৎ শুধু size, leading আর tracking-টুকুই
 * দুজনের মধ্যে সাধারণ। বাকিটা renderItem-এ active অনুযায়ী বসে, এবং
 * span-এ font-weight না থাকায় সেটা Link থেকে উত্তরাধিকারসূত্রে আসে।
 */
const ITEM_TEXT = "font-frank-ruhl text-[20px] leading-6 tracking-normal";

/** Colors panel-এর Linear Gradient: #FF9540 → #FF70C6 (কমলা → গোলাপি)। */
const ACTIVE_GRADIENT = "bg-gradient-to-r from-[#FF9540] to-[#FF70C6]";

/**
 * বাকি তিনটে text style, প্রতিটাই Figma-র নিজস্ব inspect panel থেকে।
 * তিনটেতেই letter-spacing −1% (`tracking-[-0.01em]`) আর line-height
 * ১১৪% — Figma "113.99999…" দেখায়, যেটা আসলে 8/7-এর দশমিক রূপ, তাই
 * `leading-[1.14]`-ই যথেষ্ট কাছাকাছি।
 *
 * খেয়াল করার মতো: nav item-এর tracking 0%, কিন্তু এই তিনটের −1%।
 * একই ফাইলে দুরকম, তাই আলাদা constant — নাহলে একটাকে "ঠিক" করতে গিয়ে
 * অন্যটা নীরবে ভুল হয়ে যেত।
 */
const NAME_TEXT =
  "font-frank-ruhl text-[18px] font-semibold leading-[1.14] tracking-[-0.01em] text-black";

/** Black/70 — Figma-তে অস্বচ্ছতা দিয়ে, তাই `text-black/70`; ধূসর
 *  (gray-400 ইত্যাদি) দিলে সাদা ছাড়া অন্য background-এ মিলত না। */
const EMAIL_TEXT = "font-sora text-[12px] leading-[1.14] tracking-[-0.01em] text-black/70";

/** Section heading — Sora 16px Regular, পুরো কালো। এটা nav item-এর
 *  চেয়ে ছোট (16 vs 20) কিন্তু হালকা নয়: রঙ #000, আর item-এর #121212। */
const HEADING_TEXT = "font-sora text-[16px] leading-[1.14] tracking-[-0.01em] text-black";

export interface SidebarSection {
  heading: string;
  items: SidebarItem[];
}

interface AdminSidebarProps {
  name: string;
  email: string;
  sections: SidebarSection[];
  /** System group-এ Settings — scope না থাকলে layout এটা পাঠায় না। */
  settingsItem?: SidebarItem | null;
  /** xl-এর নিচে drawer খোলা কিনা — AdminShell থেকে। */
  mobileOpen?: boolean;
  onClose?: () => void;
  /** যেকোনো nav link চাপলে — drawer বন্ধ করার জন্য। */
  onNavigate?: () => void;
}

/**
 * `/admin` কে exact মেলাতে হয়, prefix হিসেবে নয় — নাহলে
 * `/admin/orders`-এ থাকা অবস্থায় Dashboard-ও active দেখাত, অর্থাৎ
 * একসাথে দুটো item জ্বলত। বাকিদের জন্য prefix match, যাতে
 * `/admin/menu/new` বা `/admin/orders/abc123`-এ গেলেও parent item
 * active থাকে।
 */
function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({
  name,
  email,
  sections,
  settingsItem,
  mobileOpen = false,
  onClose,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();
  /**
   * ⚠️ এটা কেবল desktop-এর ধারণা। drawer-এ ৭২px সরু অবস্থার কোনো
   * অর্থ নেই — ওখানে হয় পুরোটা খোলা, নয় সম্পূর্ণ বন্ধ। তাই নিচের
   * class গুলোয় collapsed-এর প্রভাব `xl:` দিয়ে ঘেরা।
   */
  const [collapsed, setCollapsed] = useState(false);

  /**
   * নিচের দিকে হালকা fade — কেবল তখনই, যখন সত্যিই আরও item নিচে আছে।
   *
   * scrollbar লুকানো (নকশার দাবি), ফলে তালিকা যেখানে শেষ হয় সেখানে
   * কার্ডটা একটা item-এর মাঝখানে হঠাৎ কেটে যায় আর দেখে মনে হয় কিছু
   * ভেঙে গেছে — নিচে যে আরও আছে তার কোনো ইঙ্গিতই থাকে না।
   *
   * শর্তসাপেক্ষ হওয়াটা জরুরি: একেবারে নিচে পৌঁছে গেলেও fade থেকে গেলে
   * সেটা উল্টো মিথ্যে বলত ("আরও আছে"), আর ব্যবহারকারী অকারণে scroll
   * করতে থাকতেন।
   */
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // ১px-এর ছাড় — browser গুলো ভগ্নাংশ পিক্সেলে scrollTop রাখে, তাই
    // ঠিক সমান কখনোই মেলে না আর "নিচে পৌঁছেছি" অবস্থাটা ধরা পড়ত না।
    const scrollable = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setShowFade(scrollable && !atBottom);
  }, []);

  /**
   * ResizeObserver, কারণ fade-টা DOM মেপে ঠিক হয় — render-এর সময়
   * scrollHeight জানা সম্ভব নয়, তাই এটা derive করা যায় না।
   *
   * দুটো জিনিস মাপা হয়, কারণ দুটো আলাদা কারণে বদলায়:
   *   • aside নিজে — জানালার উচ্চতা বদলালে (clientHeight)
   *   • ভেতরের nav — collapse করলে heading গুলো বিভাজক হয়ে যায় আর
   *     তালিকা খাটো হয় (scrollHeight)
   *
   * শুধু aside দেখলে দ্বিতীয়টা ধরা পড়ত না: collapse করলে তার নিজের
   * মাপ একই থাকে, বদলায় কেবল ভেতরের বিষয়বস্তু।
   *
   * এটা আগের দুটো effect-এর জায়গা নিয়েছে (একটা mount-এ মেপে নিত,
   * আরেকটা window resize শুনত)। তিনটে লাভ: ResizeObserver পর্যবেক্ষণ
   * শুরু করার সাথে সাথেই একবার নিজে থেকে চলে, তাই প্রথম মাপটা এমনিতেই
   * হয়ে যায়; collapsed/sections কে নির্ভরতা হিসেবে লেখার দরকার নেই
   * (মাপই সত্য, অনুমান নয়); আর setState observer-এর callback-এ যায়,
   * effect-এর শরীরে নয় — react-hooks/set-state-in-effect ঠিক সেটাই
   * ধরেছিল, আর সেটা নিছক নিয়ম নয়: effect-এ setState মানে প্রতিবার
   * একটা বাড়তি render pass।
   */
  useEffect(() => {
    const aside = scrollRef.current;
    const content = contentRef.current;
    if (!aside || !content) return;

    const observer = new ResizeObserver(updateFade);
    observer.observe(aside);
    observer.observe(content);
    return () => observer.disconnect();
  }, [updateFade]);

  /**
   * Collapsed অবস্থায় label লুকিয়ে যায়, তাই `title` — icon-এর উপর
   * hover করলে অন্তত নামটা পাওয়া যায়। খোলা অবস্থায় এটা দিলে প্রতিটা
   * item-এ অপ্রয়োজনীয় tooltip আসত (label তো পাশেই লেখা), তাই শর্তসাপেক্ষ।
   */
  const titleFor = (label: string) => (collapsed ? label : undefined);

  const renderItem = (item: SidebarItem) => {
    const Icon = ICONS[item.icon];
    const active = isActivePath(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        // Drawer অবস্থায় link চাপার পর সেটা খোলা থেকে গেলে নতুন
        // page-টা তার পেছনে load হতো। desktop-এ onNavigate পাঠানোই
        // হয় না, তাই সেখানে এটা কিছুই করে না।
        onClick={onNavigate}
        title={titleFor(item.label)}
        aria-current={active ? "page" : undefined}
        className={`${ITEM_BASE} ${
          collapsed ? "justify-center px-0" : "px-3"
        } ${
          active
            ? `${ACTIVE_GRADIENT} font-semibold text-white`
            : "font-normal text-[#121212] hover:bg-gray-100"
        }`}
      >
        {/* Figma-র বাঁ পাশের কমলা accent bar — active item-এর গায়ে
            লেগে থাকে। collapsed-এ বাদ: ওই প্রস্থে bar আর icon-এর মাঝে
            জায়গা থাকে না, icon-টাই কেন্দ্রচ্যুত দেখাত। */}
        {active && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute -left-3 top-0 h-full w-[4px] rounded-full bg-[#FF9540]"
          />
        )}

        <Icon className="h-6 w-6 shrink-0" strokeWidth={1.8} aria-hidden="true" />

        {!collapsed && (
          <>
            <span className={`flex-1 truncate ${ITEM_TEXT}`}>
              {item.label}
            </span>
            {!!item.badge && item.badge > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 font-sora text-[12px] font-semibold ${
                  active ? "bg-white/25 text-white" : "bg-orange-50 text-[#FF4C15]"
                }`}
              >
                {item.badge}
              </span>
            )}
          </>
        )}

        {/* collapsed-এ badge-টা icon-এর কোণে একটা ছোট বিন্দু হয়ে যায় —
            সংখ্যাটা ওই জায়গায় পড়া যেত না, কিন্তু "কিছু একটা জমে আছে"
            সংকেতটুকু থাকা জরুরি, নাহলে collapse করলেই pending কাজ
            অদৃশ্য হয়ে যেত। */}
        {collapsed && !!item.badge && item.badge > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF4C15]"
          />
        )}
      </Link>
    );
  };

  return (
    <aside
      ref={scrollRef}
      onScroll={updateFade}
      /**
       * ২০টা nav item ৪৮px করে — কোনো সাধারণ পর্দাতেই পুরোটা আঁটে না।
       * আগে শুধু <nav>-টা scroll করত আর System দলটা পায়ে আটকানো ছিল,
       * ফলে মাঝের তালিকাটা চেপে গিয়ে একটা সরু জানালা হয়ে যেত — Kitchen-এর
       * পরের কিছুই দেখা যেত না।
       *
       * এখন পুরো aside-টাই একটামাত্র scroll এলাকা: সব item স্বাভাবিক
       * উচ্চতায় থাকে, System দলটা তালিকার শেষেই বসে (Figma-তেও তাই), আর
       * scrollbar-এর chrome লুকানো — auth page গুলোতে একই কায়দা।
       */
      /**
       * একই DOM node, দুটো সম্পূর্ণ আলাদা আচরণ:
       *
       * lg ও তার উপরে — page-এর সাথে বয়ে চলা কলাম (sticky), ৩০px নিচে
       * আটকানো। collapse toggle এখানেই অর্থবহ।
       *
       * xl-এর নিচে — বাঁ দিক থেকে বেরিয়ে আসা drawer (fixed, পূর্ণ
       * উচ্চতা)। ৩৬০px চওড়া ফোনে ২৫৬px sidebar স্থায়ীভাবে রাখলে
       * বিষয়বস্তুর জন্য ১০০px পড়ে থাকত।
       *
       * বন্ধ অবস্থায় translate দিয়ে সরানো, `hidden` দিয়ে নয় — তাতে
       * দুই দিকেই animation থাকে। কিন্তু শুধু translate যথেষ্ট নয়:
       * সরিয়ে রাখা জিনিসও keyboard-এর নাগালে থেকে যায়, তাই
       * `invisible`-ও লাগে, নাহলে বন্ধ drawer-এর ১৭টা link-এ Tab করে
       * পৌঁছানো যেত অথচ পর্দায় কিছুই দেখা যেত না।
       */
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col overflow-y-auto bg-white transition-transform duration-200 [scrollbar-width:none] xl:visible xl:sticky xl:inset-y-auto xl:top-[30px] xl:z-auto xl:max-h-[calc(100vh-60px)] xl:shrink-0 xl:translate-x-0 xl:self-start xl:rounded-[24px] [&::-webkit-scrollbar]:hidden ${
        mobileOpen ? "translate-x-0" : "invisible -translate-x-full"
      } ${collapsed ? "xl:w-[72px]" : "xl:w-64"}`}
    >
      {/* User card — Figma-তে sidebar-এর মাথায়। topbar-এও নাম/email আছে
          ঠিকই, কিন্তু ওটা সরু হলে (md-এর নিচে) লুকিয়ে যায়, তাই এখানে
          পুনরাবৃত্তি বরং কাজে লাগে। */}
      <div className={`sticky top-0 z-10 border-b border-gray-100 bg-white ${collapsed ? "px-3 py-4" : "p-3"}`}>
        <div
          className={`flex items-center gap-2 rounded-[12px] ${
            collapsed ? "justify-center" : "border border-gray-200 px-3 py-2.5"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className={`truncate ${NAME_TEXT}`}>{name}</p>
              <p className={`truncate ${EMAIL_TEXT}`}>{email}</p>
            </div>
          )}

          {/* একই কোণে দুটো ভিন্ন বোতাম, breakpoint অনুযায়ী।
              Desktop-এ collapse করার কোনো মানে হয়, mobile-এ হয় না
              (ওখানে drawer হয় খোলা, নয় বন্ধ) — সেখানে দরকার বন্ধ
              করার উপায়, নাহলে backdrop-এ tap করা ছাড়া উপায় থাকে না
              আর সেটা আবিষ্কার করতে হয়। */}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 xl:block"
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30 xl:hidden"
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav ref={contentRef} className="px-3 py-3">
        {sections.map((section) => (
          <div key={section.heading} className="mb-3 last:mb-0">
            {/* collapsed-এ heading-এর বদলে একটা সরু বিভাজক — গোষ্ঠীর
                সীমানাটুকু থাকে, অথচ ৭৬px-এ "Marketing & Engagement"
                লেখার চেষ্টা করতে হয় না। */}
            {collapsed ? (
              <div aria-hidden="true" className="mx-2 mb-2 border-t border-gray-100 first:border-0" />
            ) : (
              <p className={`px-3 pb-1.5 pt-2 ${HEADING_TEXT}`}>
                {section.heading}
              </p>
            )}

            <div className="space-y-2">{section.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-gray-100 px-3 py-3">
        {!collapsed && (
          <p className={`px-3 pb-1.5 ${HEADING_TEXT}`}>
            System
          </p>
        )}

        {settingsItem && renderItem(settingsItem)}

        {/* Logout — dropdown-এর মতোই `signOut`, callbackUrl "/" (storefront)।
            Figma-তে এটা System group-এর শেষ item, তাই nav-এর ভেতরে নয়,
            এখানেই। */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          title={titleFor("Logout")}
          className={`${ITEM_BASE} ${ITEM_TEXT} w-full font-normal text-red-500 hover:bg-red-50 ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {!collapsed && "Logout"}
        </button>

        {!collapsed && (
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 font-sora text-[13px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            ← Back to site
          </Link>
        )}
      </div>

      {/* sticky, absolute নয় — absolute হলে এটা বিষয়বস্তুর সাথে গড়িয়ে
          উপরে উঠে যেত। -mt-12 দিয়ে উচ্চতাটা কেটে দেওয়া হয়, তাই এটা
          কোনো বাড়তি জায়গা নেয় না, শুধু শেষ item-এর উপর ছায়া ফেলে। */}
      {showFade && (
        <div
          aria-hidden="true"
          className="pointer-events-none sticky bottom-0 -mt-12 h-12 shrink-0 rounded-b-[24px] bg-gradient-to-t from-white via-white/80 to-transparent"
        />
      )}
    </aside>
  );
}