import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { getScopesForRole, panelLabel, type Scope } from "@/lib/permissions";
import NotificationBell from "./NotificationBell";
import { type PanelLink } from "@/components/admin/AdminTopbar";
import {
  type NavIcon,
  type SidebarItem,
  type SidebarSection,
} from "@/components/admin/AdminSidebar";
import AdminShell from "@/components/admin/AdminShell";
import { countUnreadRiderNotifications } from "@/lib/rider-notifications";
import { countUnreadAdminNotifications } from "@/lib/admin-notifications";

type NavDef = {
  label: string;
  href: string;
  scope: Scope | null;
  icon: NavIcon;
};

/**
 * Figma sidebar-এর গোষ্ঠীবিন্যাস। কয়েকটা জায়গায় Figma-র নাম আর এই
 * app-এর বাস্তবতা মেলাতে হয়েছে:
 *
 *  • "Offers" → /admin/offers — product offers (a price cut on one dish
 *    for a time window). The email broadcast that used to sit here
 *    (/admin/marketing) is now reached from the "Email Subscribers"
 *    button on that page; same "marketing" scope.
 *  • Users / Suppliers / Payment / Notification — Figma-তে আছে, app-এ
 *    page ছিল না। প্রতিটার জন্য "Coming soon" placeholder বসানো হয়েছে,
 *    যাতে design-টা পুরো থাকে অথচ click করলে 404 না আসে।
 *  • My Deliveries / Inventory / Gift Cards — Figma-তে নেই, কিন্তু
 *    কাজ করা feature। সবচেয়ে কাছের গোষ্ঠীতে বসানো হয়েছে।
 *
 * scope গুলো নতুন করে বানানো হয়নি, বিদ্যমান matrix থেকেই নেওয়া:
 * Suppliers → "suppliers" (ওর API route-ও ঠিক এই scope চায়),
 * Users → "staff", Payment → "refunds" (টাকা ফেরতের অধিকার আলাদা
 * scope, দেখুন permissions.ts), Notification → "orders"।
 */
const NAV_SECTIONS: { heading: string; items: NavDef[] }[] = [
  {
    heading: "Overview",
    items: [
      // scope null — সবাই দেখতে পায়; page নিজেই দেখানোর মতো কিছু না
      // থাকলে redirect করে দেয়।
      { label: "Dashboard", href: "/admin", scope: null, icon: "dashboard" },
    ],
  },
  {
    heading: "User Management",
    items: [
      { label: "Users", href: "/admin/users", scope: "customers", icon: "users" },
      { label: "Staff", href: "/admin/staff", scope: "staff", icon: "staff" },
      { label: "Suppliers", href: "/admin/suppliers", scope: "suppliers", icon: "suppliers" },
    ],
  },
  {
    heading: "Management",
    items: [
      { label: "Kitchen", href: "/admin/kitchen", scope: "kitchen", icon: "kitchen" },
      { label: "Orders", href: "/admin/orders", scope: "orders", icon: "orders" },
      // (My Deliveries moved out: riders get their own menu — RIDER_NAV_SECTIONS.)
      { label: "Payment", href: "/admin/payment", scope: "refunds", icon: "payment" },
      // Riders' cash-out requests — the restaurant's money, so "finance" (owner).
      { label: "Rider Payouts", href: "/admin/rider-payouts", scope: "finance", icon: "riderPayouts" },
      // Cash riders collected on delivery and hand back — money coming IN, same authority.
      { label: "Rider Cash", href: "/admin/rider-cash", scope: "finance", icon: "riderCash" },
      { label: "Categories", href: "/admin/categories", scope: "categories", icon: "categories" },
      { label: "Menu", href: "/admin/menu", scope: "menu", icon: "menu" },
      { label: "Inventory", href: "/admin/inventory", scope: "inventory", icon: "inventory" },
      { label: "Tables", href: "/admin/tables", scope: "tables", icon: "tables" },
      {
        label: "Reservations",
        href: "/admin/reservations",
        scope: "reservations",
        icon: "reservations",
      },
      {
        label: "Notification",
        href: "/admin/notifications",
        scope: "orders",
        icon: "notification",
      },
    ],
  },
  {
    heading: "Marketing & Engagement",
    items: [
      { label: "Insights", href: "/admin/insights", scope: "insights", icon: "insights" },
      { label: "Reviews", href: "/admin/reviews", scope: "reviews", icon: "reviews" },
      { label: "Offers", href: "/admin/offers", scope: "marketing", icon: "offers" },
      { label: "Coupons", href: "/admin/coupons", scope: "coupons", icon: "coupons" },
      { label: "Loyalty", href: "/admin/loyalty", scope: "loyalty", icon: "loyalty" },
    ],
  },
];

/**
 * Rider panel (DELIVERY role) — Figma rider sidebar. A separate menu, not
 * the admin one filtered: a rider's pages are all their own (their
 * deliveries, their earnings), none of them are admin sections.
 *
 * "Payout" is a dropdown: Earnings (delivery fees + tips) and Cash
 * Collected (cash-on-delivery money to hand in).
 */
const RIDER_BASE = "/admin/my-deliveries";

const RIDER_NAV_SECTIONS: SidebarSection[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: RIDER_BASE, icon: "dashboard", exact: true }],
  },
  {
    heading: "Deliveries",
    items: [
      { label: "Available Orders", href: `${RIDER_BASE}/available`, icon: "available" },
      { label: "Active Delivery", href: `${RIDER_BASE}/active`, icon: "activeDelivery" },
      { label: "Delivery History", href: `${RIDER_BASE}/history`, icon: "history" },
      { label: "Notification", href: `${RIDER_BASE}/notifications`, icon: "notification" },
    ],
  },
  {
    heading: "Earnings",
    items: [
      {
        label: "Payout",
        href: `${RIDER_BASE}/payout`,
        icon: "payout",
        children: [
          { label: "Earnings", href: `${RIDER_BASE}/earnings`, icon: "earnings" },
          { label: "Cash Out", href: `${RIDER_BASE}/cash-out`, icon: "cashOut" },
          { label: "Cash Collected", href: `${RIDER_BASE}/cash`, icon: "cash" },
        ],
      },
    ],
  },
];

const RIDER_SYSTEM_ITEMS: SidebarItem[] = [
  { label: "Profile", href: "/admin/profile", icon: "profile" },
  { label: "Settings", href: `${RIDER_BASE}/settings`, icon: "settings" },
];

/** System group — Figma-তে Settings আর Logout একসাথে পায়ের কাছে।
 *  Logout-এর কোনো scope লাগে না, তাই সেটা AdminSidebar নিজেই আঁকে;
 *  এখান থেকে শুধু Settings যায়। */
const SETTINGS_NAV: NavDef = {
  label: "Settings",
  href: "/admin/settings",
  scope: "settings",
  icon: "settings",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const role = (session.user as { role?: string }).role;
  const scopes = getScopesForRole(role);

  const canSee = (scope: Scope | null) => scope === null || scopes.includes(scope);
  const isRider = role === "DELIVERY";

  const canSeeReviews = scopes.includes("reviews");
  const canSeeOrders = scopes.includes("orders");

  /**
   * দুটো badge count — দুটোই শর্তসাপেক্ষ, যাতে যে role ওই section-টাই
   * দেখে না তার জন্য অকারণে একটা DB query না চলে। আগে review count-টা
   * একা await করা হতো; এখন দুটো একসাথে, তাই query দুটো হলেও অপেক্ষা
   * একটারই সময় নেয়।
   */
  const canSeeFinance = !isRider && scopes.includes("finance");
  const [pendingReviewCount, riderUnread, pendingPayouts, pendingCash, adminUnread] = await Promise.all([
    canSeeReviews ? prisma.review.count({ where: { status: "PENDING" } }) : 0,
    isRider ? countUnreadRiderNotifications(session.user.id!) : 0,
    canSeeFinance ? prisma.riderPayout.count({ where: { status: "PENDING" } }) : 0,
    // Rider hand-in reports waiting for the owner to confirm.
    canSeeFinance ? prisma.cashRemittance.count({ where: { status: "PENDING" } }) : 0,
    // Same people who can open /admin/notifications (the "orders" scope).
    !isRider && canSeeOrders ? countUnreadAdminNotifications(session.user.id!) : 0,
  ]);

  const badgeFor = (href: string): number | undefined => {
    if (href === "/admin/reviews") return pendingReviewCount;
    // Notification badge = this person's UNREAD notifications, so it
    // matches the page and drops when they read one. (It used to be the
    // number of PLACED orders, which never changed on reading.)
    if (href === "/admin/notifications") return adminUnread || undefined;
    // Cash-out requests waiting for the owner to pay them.
    if (href === "/admin/rider-payouts") return pendingPayouts || undefined;
    if (href === "/admin/rider-cash") return pendingCash || undefined;
    return undefined;
  };

  const toSidebarItem = (item: NavDef): SidebarItem => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    badge: badgeFor(item.href),
  });

  /**
   * scope দিয়ে ছেঁকে নেওয়া। একটা section-এর একটাও item না টিকলে পুরো
   * section-টাই বাদ — নাহলে KITCHEN role-এর কাছে "User Management"
   * heading-টা ঝুলে থাকত, নিচে কিছু ছাড়াই।
   */
  const sections: SidebarSection[] = isRider
    ? RIDER_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.href === `${RIDER_BASE}/notifications` ? { ...item, badge: riderUnread } : item
        ),
      }))
    : NAV_SECTIONS.map((section) => ({
        heading: section.heading,
        items: section.items.filter((item) => canSee(item.scope)).map(toSidebarItem),
      })).filter((section) => section.items.length > 0);

  const settingsItem = canSee(SETTINGS_NAV.scope) ? toSidebarItem(SETTINGS_NAV) : null;
  const systemItems: SidebarItem[] = isRider ? RIDER_SYSTEM_ITEMS : settingsItem ? [settingsItem] : [];

  /**
   * Topbar-এর search এই একই ছাঁকা তালিকা থেকেই খোঁজে (Settings সহ), তাই
   * search কখনো এমন page দেখাতে পারে না যেটা sidebar-এ নেই — অর্থাৎ
   * খুললে 403 খেতে হবে এমন কিছু।
   */
  const searchableNavItems = [...sections.flatMap((section) => section.items), ...systemItems]
    .flatMap((item) => item.children ?? [item])
    .map((item) => ({ label: item.label, href: item.href }));

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
        navigateTo="/admin/my-deliveries/active"
        ariaLabel="New delivery assignment notifications"
      />
    ) : canSeeOrders ? (
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
   */
  const panels: PanelLink[] = [
    ...(scopes.includes("kitchen")
      ? [{ label: "Kitchen Panel", href: "/admin/kitchen", icon: "kitchen" as const }]
      : []),
    // ⚠️ "Manager Panel" শর্টকাট ইচ্ছাকৃতভাবে বাদ। Dropdown-এ এখন কেবল
    // Profile, (scope থাকলে) Kitchen Panel আর Logout। Dashboard-এ যেতে
    // sidebar-এর "Dashboard" লিঙ্ক আছে, তাই আলাদা শর্টকাট অপ্রয়োজনীয়।
  ];

  const displayName = session.user.name || panelLabel(role);

  return (
    /**
     * এই server component-এর কাজ শুধু data জোগাড় করা — কে কী দেখতে
     * পাবে (scope), badge-এর সংখ্যা, কোন bell। পর্দার গঠন আর
     * mobile drawer-এর state AdminShell-এর দায়িত্ব, কারণ সেগুলোর
     * জন্য useState/usePathname লাগে আর সেটা server-এ সম্ভব নয়।
     *
     * বাইরের div-টা পুরো প্রস্থে background ধরে রাখে; ভেতরে shell
     * নিজেই ১৭৬০-এ থেমে মাঝখানে বসে।
     */
    <div className="min-h-screen bg-[#F9F6F3]">
      <AdminShell
        name={displayName}
        email={session.user.email ?? ""}
        role={role ?? ""}
        image={session.user.image}
        panels={panels}
        navItems={searchableNavItems}
        sections={sections}
        systemItems={systemItems}
        notificationSlot={notificationBell}
        showClock={isRider}
      >
        {children}
      </AdminShell>
    </div>
  );
}
