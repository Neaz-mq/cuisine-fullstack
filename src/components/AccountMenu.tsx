"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Package, ChevronDown, Truck, ChefHat, ClipboardList, LayoutDashboard } from "lucide-react";
import { isStaffRole, firstAllowedPath, staffMenuLabel } from "@/lib/permissions";

/** Icon to pair with staffMenuLabel's text — kept here (not in
 * permissions.ts) since that file is imported by server code too and
 * shouldn't pull in a UI icon library. */
function StaffMenuIcon({ role }: { role?: string | null }) {
  const className = "w-4 h-4";
  switch (role) {
    case "DELIVERY":
      return <Truck className={className} />;
    case "KITCHEN":
      return <ChefHat className={className} />;
    case "WAITER":
    case "CASHIER":
      return <ClipboardList className={className} />;
    default:
      return <LayoutDashboard className={className} />;
  }
}

/**
 * src/components/AccountMenu.tsx
 *
 * Industry-standard account dropdown (একই pattern যেটা Amazon, Domino's,
 * Uber Eats ব্যবহার করে) — একটাই fixed UI slot, ভেতরের content
 * login state অনুযায়ী বদলায়, কিন্তু position/layout বদলায় না।
 *
 * Logged out: "Login" / "Sign Up" বাটন
 * Logged in: নাম + dropdown (My Orders, Logout)
 */
const AccountMenu = () => {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // বাইরে ক্লিক করলে dropdown বন্ধ হয়ে যাবে
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Loading state (session চেক হচ্ছে) ----
  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  // ---- Logged out: Login / Sign Up বাটন ----
  if (!session) {
    return (
      <div className="flex items-center gap-2 3xl:gap-3 2xl:gap-3 xl:gap-2 lg:gap-2 md:gap-2">
        <Link
          href="/login"
          className="text-[#2C6252] font-semibold whitespace-nowrap 3xl:text-[15px] 2xl:text-[14px] xl:text-[13px] lg:text-[12px] md:text-[12px] text-[10px] hover:text-[#FF4C15] transition-colors"
        >
          Login
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          href="/register"
          className="bg-[#FF4C15] text-white font-semibold whitespace-nowrap rounded-sm 3xl:text-[15px] 2xl:text-[14px] xl:text-[13px] lg:text-[12px] md:text-[12px] text-[10px] 3xl:px-4 2xl:px-3 xl:px-3 lg:px-2 px-2 3xl:py-2 2xl:py-2 xl:py-1.5 py-1 hover:bg-orange-600 transition-colors"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  // ---- Logged in: নাম + dropdown ----
  const displayName = session.user?.name || session.user?.email?.split("@")[0] || "Account";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 3xl:gap-2 text-[#2C6252] hover:text-[#FF4C15] transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        <div className="w-7 h-7 3xl:w-9 3xl:h-9 rounded-full bg-[#2C6252] flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 3xl:w-5 3xl:h-5 text-white" />
        </div>
        <span className="font-semibold whitespace-nowrap 3xl:text-[15px] 2xl:text-[14px] xl:text-[13px] lg:text-[12px] md:text-[12px] text-[10px] hidden sm:inline max-w-[80px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-100 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#2C6252] truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
          </div>

          <Link
            href="/account/orders"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Package className="w-4 h-4" />
            My Orders
          </Link>

          {isStaffRole((session.user as { role?: string })?.role) && (
            <Link
              href={firstAllowedPath((session.user as { role?: string })?.role)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <StaffMenuIcon role={(session.user as { role?: string })?.role} />
              {staffMenuLabel((session.user as { role?: string })?.role)}
            </Link>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
            type="button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;