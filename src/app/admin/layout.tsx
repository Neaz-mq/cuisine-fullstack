import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Kitchen", href: "/admin/kitchen" },
  { label: "Menu", href: "/admin/menu" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Reservations", href: "/admin/reservations" },
  { label: "Tables", href: "/admin/tables" },
  { label: "Users", href: "/admin/users" },
  { label: "Settings", href: "/admin/settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const pendingReviewCount = await prisma.review.count({ where: { status: "PENDING" } });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Admin Panel</p>
            <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
          </div>
          <NotificationBell />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span>{item.label}</span>
              {item.href === "/admin/reviews" && pendingReviewCount > 0 && (
                <span className="text-[11px] font-semibold bg-orange-50 text-[#FF4C15] px-2 py-0.5 rounded-full">
                  {pendingReviewCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <Link
            href="/"
            className="block px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}