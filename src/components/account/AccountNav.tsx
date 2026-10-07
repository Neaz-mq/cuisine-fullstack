"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CalendarDays,
  ClipboardList,
  Gift,
  Lock,
  LogOut, 
  MapPin,
  Star,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { GRADIENT } from "./ui";

/**
 * src/components/account/AccountNav.tsx — Figma "Web/My Account" sidebar.
 *
 * ≥1024px: white card (radius 30, padding 30) — 80px photo, name (Frank
 *   Ruhl 600 30px), email (Sora 18 black/70), a divider, then the menu.
 *   Each item is Frank Ruhl 24px with a 24px icon; the active one gets the
 *   orange→pink gradient and a 4px gradient bar on its left.
 * <1024px: the same items as a sideways-scrolling pill row, so the page
 *   content starts right away on phones (what food apps do).
 *
 * Menu = Figma's (My Orders, Profile Details, Loyalty, My Reviews, Saved
 * Addresses, Change Password, Logout) plus Reservations, which this
 * restaurant also offers.
 */

export type AccountSummary = {
  name: string;
  email: string;
  image: string | null;
};

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV: NavItem[] = [
  { href: "/account", label: "My Orders", icon: ClipboardList, exact: true },
  { href: "/account/profile", label: "Profile Details", icon: UserRound },
  { href: "/account/loyalty", label: "Loyalty", icon: Gift },
  { href: "/account/reviews", label: "My Reviews", icon: Star },
  { href: "/my-reservations", label: "Reservations", icon: CalendarDays },
  { href: "/account/addresses", label: "Saved Addresses", icon: MapPin },
  { href: "/account/password", label: "Change Password", icon: Lock },
];

function Avatar({ summary, className }: { summary: AccountSummary; className: string }) {
  if (summary.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL; see SiteNavbar
      <img
        src={summary.image}
        alt=""
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full bg-[#D9D9D9] object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-black font-frank-ruhl font-semibold text-white ${className}`}
      aria-hidden="true"
    >
      {summary.name.charAt(0).toUpperCase()}
    </span>
  );
}

const FOCUS = "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function AccountNav({ summary }: { summary: AccountSummary }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <>
      {/* ── Phones & tablets ─────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-3 rounded-[24px] bg-white p-4">
          <Avatar summary={summary} className="h-14 w-14 text-[22px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black">
              {summary.name}
            </p>
            <p className="mt-1 truncate font-sora text-[13px] text-black/70">{summary.email}</p>
          </div>
        </div>
        <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-10 md:px-10">
          <ul className="flex w-max gap-2">
            {NAV.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 font-frank-ruhl text-[16px] leading-none tracking-[-0.01em] transition-colors ${FOCUS} ${
                      active ? `${GRADIENT} font-semibold text-white` : "bg-white text-black hover:bg-black/[0.04]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 font-frank-ruhl text-[16px] leading-none text-black transition-colors hover:bg-red-50 hover:text-red-600 ${FOCUS}`}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
                Logout
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── Desktop: Figma sidebar card ──────────────────────────────── */}
      <aside className="hidden self-start lg:sticky lg:top-6 lg:block">
        <div className="flex flex-col gap-6 rounded-[30px] bg-white p-6 xl:p-[30px]">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar summary={summary} className="h-16 w-16 text-[26px] xl:h-20 xl:w-20 xl:text-[30px]" />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="truncate font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black xl:text-[30px]">
                {summary.name}
              </p>
              <p className="truncate font-sora text-[15px] leading-[1.14] tracking-[-0.01em] text-black/70 xl:text-[18px]">
                {summary.email}
              </p>
            </div>
          </div>

          <span className="h-px w-full bg-[#D9D9D9]" aria-hidden="true" />

          <nav aria-label="Account">
            <ul className="flex flex-col gap-2 xl:gap-4">
              {NAV.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href} className="flex items-center gap-3">
                    {/* Figma "Rectangle 11": 4×50 gradient bar beside the active item. */}
                    <span
                      className={`h-[50px] w-1 shrink-0 rounded-full ${active ? GRADIENT : "bg-transparent"}`}
                      aria-hidden="true"
                    />
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-5 py-4 font-frank-ruhl text-[20px] leading-[1.14] tracking-[-0.01em] transition-colors xl:px-[30px] xl:py-[28px] xl:text-[24px] ${FOCUS} ${
                        active ? `${GRADIENT} font-semibold text-white` : "font-normal text-black hover:bg-[#F9F6F3]"
                      }`}
                    >
                      <Icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="flex items-center gap-3">
                <span className="h-[50px] w-1 shrink-0" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-5 py-4 text-left font-frank-ruhl text-[20px] font-normal leading-[1.14] tracking-[-0.01em] text-black transition-colors hover:bg-red-50 hover:text-red-600 xl:px-[30px] xl:py-[28px] xl:text-[24px] ${FOCUS}`}
                >
                  <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
