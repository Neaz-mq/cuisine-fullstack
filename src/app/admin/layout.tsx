import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { getScopesForRole, panelLabel, type Scope } from "@/lib/permissions";
import NotificationBell from "./NotificationBell";
import AdminTopbar, { type PanelLink } from "@/components/admin/AdminTopbar";

const NAV_ITEMS: { label: string; href: string; scope: Scope | null }[] = [
  { label: "Dashboard", href: "/admin", scope: null }, // always visible; page itself redirects if there's nothing to show
  { label: "Orders", href: "/admin/orders", scope: "orders" },
  { label: "My Deliveries", href: "/admin/my-deliveries", scope: "myDeliveries" },
  { label: "Kitchen", href: "/admin/kitchen", scope: "kitchen" },
  { label: "Menu", href: "/admin/menu", scope: "menu" },
  { label: "Categories", href: "/admin/categories", scope: "categories" },
  { label: "Inventory", href: "/admin/inventory", scope: "inventory" },
  { label: "Insights", href: "/admin/insights", scope: "insights" },
  { label: "Reviews", href: "/admin/reviews", scope: "reviews" },
  { label: "Loyalty", href: "/admin/loyalty", scope: "loyalty" },
  { label: "Reservations", href: "/admin/reservations", scope: "reservations" },
  { label: "Tables", href: "/admin/tables", scope: "tables" },
  { label: "Coupons", href: "/admin/coupons", scope: "coupons" },
  { label: "Gift Cards", href: "/admin/gift-cards", scope: "giftCards" },
  { label: "Marketing", href: "/admin/marketing", scope: "marketing" },
  { label: "Staff", href: "/admin/staff", scope: "staff" },
  { label: "Settings", href: "/admin/settings", scope: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const role = (session.user as { role?: string }).role;
  const scopes = getScopesForRole(role);
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.scope === null || scopes.includes(item.scope)
  );

  const pendingReviewCount = scopes.includes("reviews")
    ? await prisma.review.count({ where: { status: "PENDING" } })
    : 0;

  /* Which bell (if any) makes sense depends on the role, not just
     "is staff" — a bell that navigates somewhere the viewer can't
     open is worse than no bell. DELIVERY riders get their own
     "new delivery assigned to you" bell (never the restaurant-wide
     new-orders one — they can't open /admin/orders at all, see
     that section's own scope guard). Order-taking roles
     (OWNER/MANAGER/WAITER/CASHIER, i.e. anyone with "orders")
     get the original new-orders bell. KITCHEN gets neither —
     no notification-worthy event of their own yet.

     সিদ্ধান্তটা এখানেই থাকে, topbar-এ নয়: AdminTopbar একটা presentational
     client component, ওকে permission নিয়ে ভাবতে দেওয়ার মানে scope logic
     দুই জায়গায় ছড়িয়ে পড়া। */
  const notificationBell =
    role === "DELIVERY" ? (
      <NotificationBell
        fetchUrl="/api/rider/notifications"
        countKey="newAssignmentsCount"
        latestKey="latestAssignedAt"
        navigateTo="/admin/my-deliveries"
        ariaLabel="New delivery assignment notifications"
      />
    ) : scopes.includes("orders") ? (
      <NotificationBell
        fetchUrl="/api/admin/notifications"
        countKey="newOrdersCount"
        latestKey="latestOrderAt"
        navigateTo="/admin/orders?status=PLACED"
        ariaLabel="New order notifications"
      />
    ) : null;

  /**
   * Dropdown-এর panel shortcut। scope দিয়ে ছাঁকা হচ্ছে, role দিয়ে নয়:
   * একজন OWNER-এর kitchen access আছে, একজন KITCHEN-এর নেই — এবং সেই
   * হিসাব permissions.ts-এ একবারই লেখা আছে। এখানে role নাম ধরে শর্ত
   * লিখলে নতুন role যোগ হলে এই তালিকা নীরবে ভুল হয়ে যেত।
   *
   * "Manager Panel" মানে dashboard — Figma-র নাম রাখা হয়েছে, কিন্তু
   * href সেই page যেখানে ব্যবস্থাপনার সব কিছু আছে।
   */
  const panels: PanelLink[] = [
    ...(scopes.includes("kitchen")
      ? [{ label: "Kitchen Panel", href: "/admin/kitchen", icon: "kitchen" as const }]
      : []),
    ...(scopes.includes("insights")
      ? [{ label: "Manager Panel", href: "/admin", icon: "manager" as const }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F9F6F3] p-3 md:p-4">
      {/* Topbar পুরো প্রস্থ জুড়ে, sidebar-এর উপরে — Figma design অনুযায়ী।
          আগে logo/email/bell sidebar-এর মাথায় ছিল; সেগুলো এখানে উঠে
          এসেছে, তাই sidebar-এ শুধু navigation থাকে। */}
      <AdminTopbar
        name={session.user.name || panelLabel(role)}
        email={session.user.email ?? ""}
        role={role ?? ""}
        image={session.user.image}
        panels={panels}
        notificationSlot={notificationBell}
      />

      <div className="flex gap-3 md:gap-4 mt-3 md:mt-4">
        <aside className="w-60 shrink-0 bg-white rounded-[24px] flex flex-col self-start sticky top-4 max-h-[calc(100vh-2rem)]">
          {/* overflow-y-auto: nav item অনেকগুলো (OWNER-এর ১৭টা), ছোট
              laptop-এ পুরোটা দেখা যায় না। sticky + max-h মিলে sidebar
              নিজে scroll করে, পুরো page নয়। */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {visibleNavItems.map((item) => (
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

        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
