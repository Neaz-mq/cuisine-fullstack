"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ICONS,
  iconStateProps,
  isActivePath,
  type SidebarItem,
  type SidebarSection,
} from "./AdminSidebar";

/**
 * src/components/admin/AdminNavRail.tsx
 *
 * Tablet-এর navigation: একটাই সারিতে শুধু icon, কোনো লেখা নেই।
 *
 * কেন আলাদা component, AdminSidebar-এ আরেকটা mode না বানিয়ে —
 * AdminSidebar ইতিমধ্যেই দুটো আচরণ সামলায় (ফোনে drawer, desktop-এ
 * কলাম)। তৃতীয় একটা রূপ, যেটা অনুভূমিক আর গঠনগতভাবে সম্পূর্ণ আলাদা
 * (কোনো section heading নেই, কোনো user card নেই, কোনো collapse নেই),
 * ওখানে ঢোকালে প্রতিটা class-এ তিন স্তরের শর্ত জমত। আলাদা ফাইলে
 * দুটোই পড়া সহজ থাকে।
 *
 * তালিকা আর active-চেনার নিয়ম দুটোই AdminSidebar থেকে আমদানি করা —
 * এখানে আলাদা করে লিখলে একদিন দুই জায়গায় দুই রকম হয়ে যেত, আর
 * তখন tablet-এ একটা page active দেখাত অথচ desktop-এ নয়।
 */
export default function AdminNavRail({
  sections,
  settingsItem,
  className = "",
}: {
  sections: SidebarSection[];
  settingsItem?: SidebarItem | null;
  className?: string;
}) {
  const pathname = usePathname();

  /**
   * Section গুলো এখানে সমতল করে দেওয়া হয়, কারণ rail-এ heading দেখানোর
   * উপায় নেই। ক্রমটা অপরিবর্তিত — desktop-এ যে ক্রমে উপর থেকে নিচে,
   * এখানে সেই ক্রমেই বাঁ থেকে ডানে, যাতে একই যন্ত্রের অভ্যাস দুই
   * জায়গায় কাজে লাগে।
   */
  const items = [
    ...sections.flatMap((section) => section.items),
    ...(settingsItem ? [settingsItem] : []),
  ];

  return (
    <nav
      aria-label="Sections"
      /* overflow-x-auto — ১৭টা icon সব tablet-এ আঁটে না (৭৬৮px-এ ধরে
         ১২টা)। scrollbar লুকানো, বাকি পর্দাগুলোর মতোই। */
      className={`flex items-center gap-1 overflow-x-auto rounded-full bg-white px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            // লেখা নেই, তাই title আর aria-label দুটোই লাগে: প্রথমটা
            // চোখের জন্য (hover), দ্বিতীয়টা screen reader-এর জন্য।
            // কেবল icon থাকলে link-টার কোনো নামই থাকত না।
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full transition-colors ${
              active
                ? "bg-gradient-to-r from-[#FF9540] to-[#FF70C6] text-white"
                : "text-[#121212] hover:bg-gray-100"
            }`}
          >
            {/* সক্রিয় হলে icon ভরাট — AdminSidebar-এর একই নিয়ম, একই
                ব্যতিক্রম তালিকা। এখানে আলাদা করে লিখলে একদিন দুই
                জায়গায় দুই রকম হয়ে যেত। */}
            <Icon className="h-6 w-6" {...iconStateProps(item.icon, active)} aria-hidden="true" />

            {/* সংখ্যাটা ৫০px বৃত্তের কোণে পড়া যেত না, তাই শুধু একটা
                বিন্দু — "এখানে কিছু জমে আছে" ইঙ্গিতটুকু থাকে, আর
                পুরো সংখ্যাটা page-এ গেলেই পাওয়া যায়। */}
            {!!item.badge && item.badge > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full ${
                  active ? "bg-white" : "bg-[#FF4C15]"
                }`}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}