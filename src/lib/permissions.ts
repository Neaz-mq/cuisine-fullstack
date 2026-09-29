/**
 * src/lib/permissions.ts
 *
 * Single source of truth for the RBAC permission matrix: which staff
 * role can access which admin "scope" (roughly, one admin section / one
 * group of API routes). Both page-level guards (lib/require-admin.ts)
 * and API route guards read from here, so there's exactly one place to
 * change if the matrix ever needs adjusting.
 */

export const STAFF_ROLES = [
  "OWNER",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "DELIVERY",
  "KITCHEN",
  "CLEANER",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type Scope =
  | "menu"
  | "categories"
  | "inventory"
  // The Suppliers page (who we buy from, their contacts and delivery
  // history). Split from "inventory" so a MANAGER can keep suppliers
  // without seeing stock levels, costs and purchase entries.
  | "suppliers"
  | "orders"
  // Issuing money back is deliberately its own scope, separate from
  // "orders". Plenty of staff need to move an order through its statuses;
  // far fewer should be able to send a customer's money back to their
  // card. Bundling the two would have made every shift lead a refund
  // authority by accident.
  | "refunds"
  | "kitchen"
  | "tables"
  | "reservations"
  | "coupons"
  | "reviews"
  | "loyalty"
  | "settings"
  | "insights"
  | "staff"
  | "marketing"
  | "myDeliveries"
  // The customer list (/admin/users) — who the restaurant's customers are,
  // their contact details and spend. OWNER-only (Figma manager panel has no
  // "Users"). Split from "staff", which a MANAGER needs for hiring.
  | "customers"
  // The restaurant's money at a glance: the dashboard's Total Revenue card
  // and the AI business summary. OWNER-only — a MANAGER runs the shift
  // (orders, kitchen, daily income), the owner sees the totals.
  | "finance";

const ALL_SCOPES: Scope[] = [
  "menu",
  "categories",
  "inventory",
  "suppliers",
  "orders",
  "refunds",
  "kitchen",
  "tables",
  "reservations",
  "coupons",
  "reviews",
  "loyalty",
  "settings",
  "insights",
  "staff",
  "marketing",
  "myDeliveries",
  "customers",
  "finance",
];

/**
 * MANAGER — Dashboard (without Total Revenue), Staff, Suppliers, Kitchen,
 * Orders, Payment (transactions only), Categories, Menu, Tables,
 * Reservations, Notification, Insights, Reviews.
 *
 * Not theirs: Settings, Inventory (stock, costs, purchases), the customer
 * list (Users), Offers and email broadcasts, Coupons, Loyalty, the revenue
 * totals and payment summaries ("finance"), and a rider's My Deliveries.
 */
const MANAGER_SCOPES: Scope[] = ALL_SCOPES.filter(
  (scope) =>
    ![
      "settings",
      "inventory",
      "customers",
      "finance",
      "marketing",
      "coupons",
      "loyalty",
      "myDeliveries",
    ].includes(scope)
);

/**
 * The permission matrix. OWNER gets every scope. MANAGER gets the day-to-
 * day running of the restaurant (MANAGER_SCOPES above) — and inside the
 * Staff section still can't create/edit/deactivate an OWNER or see salary
 * (see the staff API routes for those finer-grained checks).
 *
 * WAITER / CASHIER share "orders" (both touch order status at some point
 * in the flow), plus whatever's specific to their job. DELIVERY gets its
 * own narrower "myDeliveries" scope instead of "orders" — a rider should
 * only ever see the handful of orders assigned to them (their own
 * /admin/my-deliveries dashboard), never the restaurant's whole order
 * book with every customer's name/address on it. KITCHEN only gets
 * "kitchen" — menu availability toggling from the kitchen board is a
 * possible future addition, not part of this change.
 *
 * "marketing" (sending offer broadcasts to the whole customer audience)
 * is deliberately NOT given to WAITER/CASHIER/DELIVERY/KITCHEN — only
 * OWNER/MANAGER get it via ALL_SCOPES, same as "staff" and "settings".
 *
 * "inventory" (stock levels, recipes, purchase/wastage/adjustment
 * entries, cost-per-unit) is the same OWNER/MANAGER-only shape — a
 * KITCHEN staffer preps food using their existing "kitchen" scope, but
 * doesn't get to record purchases or edit costPerUnit. If KITCHEN ever
 * needs a read-only low-stock glance, that's a narrower addition to make
 * later (e.g. surfacing it inside the kitchen board itself), not full
 * "inventory" scope access.
 */
const PERMISSION_MATRIX: Record<StaffRole, Scope[]> = {
  OWNER: ALL_SCOPES,
  MANAGER: MANAGER_SCOPES,
  WAITER: ["orders", "tables", "reservations"],
  CASHIER: ["orders", "tables", "loyalty"],
  DELIVERY: ["myDeliveries"],
  KITCHEN: ["kitchen"],
  // CLEANER holds nothing, and that is the whole point of the role.
  //
  // Every other staff role exists partly so its holder can do something
  // in this panel. A cleaner's work leaves no trace here: no orders to
  // move, no stock to count, no tables to seat. What they need is a
  // StaffProfile — employee id, salary, employment type, hire date —
  // so payroll and the Users page's "Cleaners" count are correct.
  //
  // An empty scope list is therefore deliberate, not an oversight, and
  // firstAllowedPath() below has a branch for exactly this case. Giving
  // them a scope "so the login goes somewhere" would hand a cleaner the
  // restaurant's order book to solve a routing problem.
  CLEANER: [],
};

/** The admin path each scope's section lives at — used to bounce a staff
 * member who hits a page/route they can't use toward somewhere they can. */
const SCOPE_PATH: Record<Scope, string> = {
  menu: "/admin/menu",
  categories: "/admin/categories",
  inventory: "/admin/inventory",
  suppliers: "/admin/suppliers",
  orders: "/admin/orders",
  // No page of its own — refunds are issued from an order's detail page.
  // The path exists only so a role holding this scope and nothing else
  // still has somewhere to land.
  refunds: "/admin/orders",
  kitchen: "/admin/kitchen",
  tables: "/admin/tables",
  reservations: "/admin/reservations",
  coupons: "/admin/coupons",
  reviews: "/admin/reviews",
  loyalty: "/admin/loyalty",
  settings: "/admin/settings",
  insights: "/admin/insights",
  staff: "/admin/staff",
  // The Offers page. The email broadcast (/admin/marketing) sits under the
  // same scope and is reached from there.
  marketing: "/admin/offers",
  myDeliveries: "/admin/my-deliveries",
  customers: "/admin/users",
  finance: "/admin",
};

// Nav / redirect priority order — first scope in this list that a role has
// is treated as "their" home section.
const SCOPE_PRIORITY: Scope[] = [
  "orders",
  "myDeliveries",
  "kitchen",
  "tables",
  "reservations",
  "menu",
  "categories",
  "inventory",
  "suppliers",
  "coupons",
  "reviews",
  "loyalty",
  "staff",
  "settings",
  "insights",
  "marketing",
  "customers",
  "finance",
  // Last: nobody's home section is "refunds" — it has no page, and anyone
  // holding it holds "orders" too. Present only so the list stays
  // exhaustive over Scope.
  "refunds",
];

export function isStaffRole(role?: string | null): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function hasPermission(role?: string | null, scope?: Scope): boolean {
  if (!isStaffRole(role) || !scope) return false;
  return PERMISSION_MATRIX[role].includes(scope);
}

export function hasAnyPermission(role?: string | null, scopes?: Scope[]): boolean {
  if (!scopes || scopes.length === 0) return false;
  return scopes.some((scope) => hasPermission(role, scope));
}

export function getScopesForRole(role?: string | null): Scope[] {
  if (!isStaffRole(role)) return [];
  return PERMISSION_MATRIX[role];
}

/** Where to send a staff member if they land somewhere they don't have
 * access to (e.g. the financial dashboard, for a WAITER). Falls back to
 * "/admin" itself only if a role somehow has zero scopes.
 *
 * OWNER/MANAGER are special-cased to "/admin" itself (the real dashboard)
 * rather than walking SCOPE_PRIORITY — since they hold ALL_SCOPES, the
 * priority walk would otherwise match "orders" (first in the list) and
 * send them to /admin/orders, contradicting staffMenuLabel's "Admin
 * Dashboard" text for these two roles. */
export function firstAllowedPath(role?: string | null): string {
  if (role === "OWNER" || role === "MANAGER") return "/admin";

  const scopes = getScopesForRole(role);
  const first = SCOPE_PRIORITY.find((scope) => scopes.includes(scope));
  if (first) return SCOPE_PATH[first];

  /**
   * ⚠️ Zero-scope roles (CLEANER) must NOT fall back to "/admin".
   *
   * The old fallback did, and with CLEANER that turns into an infinite
   * redirect: /admin checks hasPermission(role, "insights"), fails, and
   * redirects to firstAllowedPath(role) — which was "/admin" again.
   *
   * That was latent before this role existed, because every role had at
   * least one scope and the branch was unreachable. Adding a role with
   * none is what makes it reachable, so it is fixed here rather than
   * left as a trap for the next role someone adds.
   *
   * The storefront is the honest destination: a cleaner has a login
   * (payroll, profile) but nothing to do in this panel.
   */
  return "/";
}

/** Human-facing label for each role's "home" link in the storefront
 * account dropdown (AccountMenu.tsx) — pairs with firstAllowedPath, which
 * gives the destination. OWNER/MANAGER see the actual admin dashboard, so
 * "Admin Dashboard" fits; every other role only ever lands on their own
 * narrow section (their firstAllowedPath), so the label names that
 * section instead of the generic "Admin Dashboard" — a DELIVERY rider
 * isn't going to an admin dashboard, they're going to their deliveries. */
const STAFF_MENU_LABEL: Record<StaffRole, string> = {
  OWNER: "Admin Dashboard",
  MANAGER: "Manager Dashboard",
  WAITER: "Orders",
  CASHIER: "Orders",
  DELIVERY: "My Deliveries",
  KITCHEN: "Kitchen Display",
  // No panel to link to — the storefront is where they land.
  CLEANER: "Home",
};

export function staffMenuLabel(role?: string | null): string {
  return isStaffRole(role) ? STAFF_MENU_LABEL[role] : "Admin Dashboard";
}

/** Sidebar header title in /admin/layout.tsx — same "don't call it Admin
 * Panel for someone who isn't one" reasoning as staffMenuLabel above, just
 * for the panel's own name instead of the storefront dropdown link. A
 * DELIVERY rider staring at "Admin Panel" while they're just trying to
 * mark an order delivered is the kind of small mislabel that makes staff
 * doubt they're even looking at the right screen. */
const PANEL_LABEL: Record<StaffRole, string> = {
  OWNER: "Admin Panel",
  MANAGER: "Manager Panel",
  WAITER: "Staff Panel",
  CASHIER: "Staff Panel",
  DELIVERY: "Rider Panel",
  KITCHEN: "Kitchen Panel",
  // Never actually rendered — a CLEANER can't reach any admin page —
  // but Record<StaffRole, …> is exhaustive, and a placeholder here is
  // better than loosening the type and losing the compile-time check
  // that every future role gets a label.
  CLEANER: "Staff Panel",
};

export function panelLabel(role?: string | null): string {
  return isStaffRole(role) ? PANEL_LABEL[role] : "Admin Panel";
}

/** Can this role create/edit/deactivate a target user with `targetRole`?
 * OWNER can manage anyone. MANAGER can manage anyone except another OWNER
 * (and can't promote someone TO OWNER either — same rule, both directions). */
export function canManageStaffRole(
  actingRole?: string | null,
  targetRole?: string | null
): boolean {
  if (actingRole === "OWNER") return true;
  if (actingRole === "MANAGER") return targetRole !== "OWNER";
  return false;
}

/**
 * `StaffProfile.salary` is OWNER-only, both to read and to write.
 *
 * ⚠️ এটা আগে `nid`-ও ঢাকত। এখন আর নয়: NID কর্মী নিয়োগের কাগজপত্রের
 * অংশ, আর সেই কাজটা MANAGER-রাই করেন — ঘরটা তাঁদের কাছে না থাকলে নতুন
 * কর্মীর record অসম্পূর্ণ থেকে যেত। salary আলাদা: সেটা নিয়োগের তথ্য
 * নয়, ক্ষতিপূরণের তথ্য, আর একজন MANAGER-এর অন্য MANAGER-এর বেতন
 * জানার কোনো কাজ নেই।
 *
 * নামটা তবু `…SensitiveStaffFields` — কারণ salary সত্যিই একটা
 * সংবেদনশীল ক্ষেত্র, আর নাম বদলালে পুরনো staff পাতাগুলোর import-ও
 * ভাঙত। কী কী ঢাকে সেটা এই মন্তব্যই বলে দেয়।
 *
 * ⚠️ NID এখনো CSV export-এ **নেই** (দেখুন /api/admin/staff/export)।
 * অ্যাপের ভেতরে দেখা আর একটা ফাইলে সবার NID এক জায়গায় জমা করে
 * Downloads ফোল্ডারে পাঠানো — দুটো এক ঝুঁকি নয়।
 */
export function canViewSensitiveStaffFields(role?: string | null): boolean {
  return role === "OWNER";
}