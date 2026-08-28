"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminTopbar, { type PanelLink } from "@/components/admin/AdminTopbar";
import AdminSidebar, {
  type SidebarItem,
  type SidebarSection,
} from "@/components/admin/AdminSidebar";
import AdminNavRail from "@/components/admin/AdminNavRail";

/**
 * src/components/admin/AdminShell.tsx
 *
 * Topbar + sidebar + main — তিনটেকে একসাথে ধরে রাখা responsive খোলস।
 *
 * এই ফাইলটা আছে কেবল একটা কারণে: mobile drawer খোলা আছে কিনা সেই
 * তথ্যটা **দুই** component-এর লাগে — topbar-এর hamburger ওটা toggle
 * করে, sidebar ওটা দেখে ভেতরে ঢুকবে না বেরোবে ঠিক করে। state-টা তাই
 * দুজনের সবচেয়ে কাছের অভিন্ন পূর্বপুরুষে থাকতে হয়।
 *
 * layout.tsx নিজে server component (requireAdmin, prisma query) —
 * সেখানে useState রাখা যায় না। তাই এই পাতলা client স্তরটা মাঝখানে
 * বসল, আর layout-এর কাজ শুধু data জোগাড় করে নামিয়ে দেওয়া।
 *
 * `notificationSlot` JSX হিসেবেই আসে (server-এ তৈরি) — server থেকে
 * client component-এ ReactNode পাঠানো Next-এর স্বীকৃত slot pattern,
 * আর এতে NotificationBell-এর role-ভিত্তিক সিদ্ধান্তটা server-এই থেকে
 * যায়।
 *
 * ── Figma-র দুটো gap, দুটো আলাদা মান ──────────────────────────────
 * নিচে দু'জায়গায় gap আছে আর দুটো ইচ্ছাকৃতভাবে আলাদা, কারণ Figma-তে
 * এরা দুটো ভিন্ন frame:
 *
 *   বাইরের frame — Flow Vertical, gap 24px   → topbar ↕ নিচের সারি
 *   ভেতরের frame — Flow Horizontal, gap 40px → sidebar ↔ content
 *
 * একটাকে আরেকটার সমান করে দিলে মকআপের ছন্দটাই নষ্ট হয়: উল্লম্বে
 * জিনিসগুলো পুরো প্রস্থ জুড়ে থাকে বলে কম ফাঁকেই সীমানা বোঝা যায়,
 * অনুভূমিকে দুটো কার্ড পাশাপাশি বলে বেশি ফাঁক লাগে।
 */
export default function AdminShell({
  name,
  email,
  role,
  image,
  panels,
  navItems,
  sections,
  settingsItem,
  notificationSlot,
  children,
}: {
  name: string;
  email: string;
  role: string;
  image?: string | null;
  panels: PanelLink[];
  navItems: { label: string; href: string }[];
  sections: SidebarSection[];
  settingsItem?: SidebarItem | null;
  notificationSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  /**
   * "drawer কোন পাতায় খোলা হয়েছিল" — খোলা/বন্ধ boolean নয়।
   *
   * এতে "পাতা বদলালে drawer বন্ধ হবে" নিয়মটা আলাদা করে লিখতেই হয় না,
   * এমনিতেই বেরিয়ে আসে: pathname বদলালে openPath আর মেলে না, তাই
   * mobileOpen নিজে থেকেই false।
   *
   * আগে এটা একটা useEffect ছিল যেটা pathname বদলালে setMobileOpen(false)
   * ডাকত। কাজ করত, কিন্তু ভুল কাঠামো — আর CI-এর
   * react-hooks/set-state-in-effect ঠিক সেটাই ধরেছে: effect-এর শরীরে
   * setState মানে প্রতিটা navigation-এ বাড়তি একটা render pass, শুধু
   * এমন একটা তথ্য ঠিক করতে যেটা ইতিমধ্যেই render-এর সময় জানা।
   */
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath !== null && openPath === pathname;

  const openDrawer = () => setOpenPath(pathname);
  const closeDrawer = () => setOpenPath(null);

  /** Escape — যেকোনো overlay-র জন্য প্রত্যাশিত আচরণ। */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPath(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  /**
   * Drawer খোলা থাকলে পেছনের page-টা যেন scroll না করে।
   *
   * এটা ছাড়া mobile-এ drawer-এর উপর আঙুল টানলে নিচের dashboard-টা
   * গড়াতে থাকে (scroll chaining) — drawer বন্ধ করার পর ব্যবহারকারী
   * নিজেকে page-এর একেবারে অন্য জায়গায় খুঁজে পান।
   *
   * cleanup-এ আগের মানটা ফিরিয়ে দেওয়া হয়, খালি করে দেওয়া হয় না:
   * অন্য কোনো component (যেমন কোনো modal) যদি ইতিমধ্যেই lock বসিয়ে
   * থাকে, এটা বন্ধ হওয়ার সময় তারটাও তুলে নিত।
   */
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    /**
     * Figma-র বাইরের frame: Flow Vertical, gap 24px (`xl:gap-6`)।
     *
     * ছোট পর্দায় ২৪px বাড়াবাড়ি, কিন্তু আগের ১০px-ও কম ছিল: topbar
     * একটা গোল pill, তার নিচেই সরাসরি বড় শিরোনাম — এত কম ফাঁকে দুটো
     * একে অপরের গায়ে সেঁটে থাকত। ১৬px-এ pill-টা আলাদা করে "ভাসে"।
     *
     * প্রান্তের padding-ও ১২ থেকে ১৬: ফোনে কার্ডগুলো পর্দার কিনারা
     * ঘেঁষে থাকলে ধরে-রাখা হাতের বুড়ো আঙুল বারবার লেগে যায়।
     */
    <div className="mx-auto flex max-w-[1760px] flex-col gap-4 p-4 xl:gap-6 xl:p-[30px]">
      <AdminTopbar
        name={name}
        email={email}
        role={role}
        image={image}
        panels={panels}
        navItems={navItems}
        notificationSlot={notificationSlot}
        onMenuClick={openDrawer}
      />

      {/* Tablet-এর navigation — Figma-র নকশা অনুযায়ী শুধু icon-এর একটা
          অনুভূমিক সারি, drawer নয়।
          md–xl-এর মাঝেই কেবল: ফোনে ১৭টা icon পাশাপাশি রাখলে প্রতিটা
          এত ছোট হতো যে আঙুলে ঠিকভাবে চাপাই যেত না (তাই সেখানে drawer),
          আর xl-এ পুরো label সহ কলামই বেশি কাজের। */}
      <AdminNavRail
        sections={sections}
        settingsItem={settingsItem}
        className="hidden md:flex xl:hidden"
      />

      {/**
       * Figma-র ভেতরের frame: Flow Horizontal, gap 40px (`gap-10`,
       * অর্থাৎ 2.5rem)।
       *
       * xl-scoped, কারণ তার নিচে এই gap-এর কোনো অস্তিত্বই নেই:
       * xl-এর নিচে AdminSidebar হয় `fixed` (drawer), নয় `md:hidden` —
       * দুটোর কোনোটাই flex item নয়, তাই <main> একাই থাকে।
       */}
      <div className="flex gap-0 xl:gap-10">
        {/**
         * Backdrop — শুধু drawer যেখানে সত্যিই খুলতে পারে, অর্থাৎ
         * md-এর নিচে।
         *
         * আগে এটা `xl:hidden` ছিল, কিন্তু hamburger নিজেই `md:hidden`
         * আর sidebar-ও `md:hidden` — অর্থাৎ 768px থেকে উপরে drawer বলে
         * কিছু নেই, ওখানে AdminNavRail কাজটা করে। ফলে ফোনে drawer খুলে
         * tablet প্রস্থে ঘোরালে drawer উধাও হয়ে যেত অথচ কালো overlay
         * আর locked body scroll থেকে যেত।
         */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        <AdminSidebar
          name={name}
          email={email}
          sections={sections}
          settingsItem={settingsItem}
          mobileOpen={mobileOpen}
          onClose={closeDrawer}
          // একই পাতার link চাপলে pathname বদলায় না, তাই উপরের
          // derivation-টা drawer বন্ধ করে না। সেই ফাঁকটা এখানে বন্ধ।
          onNavigate={closeDrawer}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}