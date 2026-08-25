"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminTopbar, { type PanelLink } from "@/components/admin/AdminTopbar";
import AdminSidebar, {
  type SidebarItem,
  type SidebarSection,
} from "@/components/admin/AdminSidebar";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  /**
   * পাতা বদলালে drawer নিজে থেকে বন্ধ হয়।
   *
   * এটা না থাকলে mobile-এ একটা link চাপার পর নতুন page-টা drawer-এর
   * পেছনে load হতো আর ব্যবহারকারীকে হাত দিয়ে বন্ধ করতে হতো — প্রতিবার।
   */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /** Escape — যেকোনো overlay-র জন্য প্রত্যাশিত আচরণ। */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
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
    <div className="mx-auto flex max-w-[1760px] flex-col gap-[10px] p-3 sm:p-4 xl:p-[30px]">
      <AdminTopbar
        name={name}
        email={email}
        role={role}
        image={image}
        panels={panels}
        navItems={navItems}
        notificationSlot={notificationSlot}
        onMenuClick={() => setMobileOpen(true)}
      />

      <div className="flex gap-[10px]">
        {/* Backdrop — শুধু xl-এর নিচে, আর শুধু খোলা থাকলে। xl:hidden
            না দিলে desktop-এ resize করার পর একটা অদৃশ্য স্তর click
            আটকে রাখত। */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 xl:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <AdminSidebar
          name={name}
          email={email}
          sections={sections}
          settingsItem={settingsItem}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
