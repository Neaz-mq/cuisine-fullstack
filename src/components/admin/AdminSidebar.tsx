"use client";

import { useState } from "react";
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
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        title={titleFor(item.label)}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-[14px] py-2.5 transition-colors ${
          collapsed ? "justify-center px-0" : "px-3"
        } ${
          active
            ? "bg-gradient-to-r from-[#F7A15C] to-[#EE6C6C] text-white shadow-[0_4px_12px_rgba(238,108,108,0.28)]"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {/* Figma-র বাঁ পাশের কমলা accent bar — active item-এর গায়ে
            লেগে থাকে। collapsed-এ বাদ: ওই প্রস্থে bar আর icon-এর মাঝে
            জায়গা থাকে না, icon-টাই কেন্দ্রচ্যুত দেখাত। */}
        {active && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[#F7A15C]"
          />
        )}

        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />

        {!collapsed && (
          <>
            <span className="flex-1 truncate font-sora text-[14px] font-medium">
              {item.label}
            </span>
            {!!item.badge && item.badge > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 font-sora text-[11px] font-semibold ${
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
      className={`sticky top-4 flex max-h-[calc(100vh-2rem)] shrink-0 flex-col self-start rounded-[24px] bg-white transition-[width] duration-200 ${
        collapsed ? "w-[76px]" : "w-64"
      }`}
    >
      {/* User card — Figma-তে sidebar-এর মাথায়। topbar-এও নাম/email আছে
          ঠিকই, কিন্তু ওটা সরু হলে (md-এর নিচে) লুকিয়ে যায়, তাই এখানে
          পুনরাবৃত্তি বরং কাজে লাগে। */}
      <div className={`border-b border-gray-100 ${collapsed ? "px-3 py-4" : "p-3"}`}>
        <div
          className={`flex items-center gap-2 rounded-[14px] ${
            collapsed ? "justify-center" : "border border-gray-200 px-3 py-2.5"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-sora text-[13px] font-semibold text-gray-900">
                {name}
              </p>
              <p className="truncate font-sora text-[11px] text-gray-400">{email}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section) => (
          <div key={section.heading} className="mb-3 last:mb-0">
            {/* collapsed-এ heading-এর বদলে একটা সরু বিভাজক — গোষ্ঠীর
                সীমানাটুকু থাকে, অথচ ৭৬px-এ "Marketing & Engagement"
                লেখার চেষ্টা করতে হয় না। */}
            {collapsed ? (
              <div aria-hidden="true" className="mx-2 mb-2 border-t border-gray-100 first:border-0" />
            ) : (
              <p className="px-3 pb-1.5 pt-2 font-sora text-[11px] font-semibold text-gray-400">
                {section.heading}
              </p>
            )}

            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-gray-100 px-3 py-3">
        {!collapsed && (
          <p className="px-3 pb-1.5 font-sora text-[11px] font-semibold text-gray-400">
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
          className={`flex w-full items-center gap-3 rounded-[14px] py-2.5 font-sora text-[14px] font-medium text-red-500 transition-colors hover:bg-red-50 ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {!collapsed && "Logout"}
        </button>

        {!collapsed && (
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 font-sora text-[13px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            ← Back to site
          </Link>
        )}
      </div>
    </aside>
  );
}