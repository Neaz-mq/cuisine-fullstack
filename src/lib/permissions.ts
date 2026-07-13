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
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type Scope =
  | "menu"
  | "categories"
  | "orders"
  | "kitchen"
  | "tables"
  | "reservations"
  | "coupons"
  | "reviews"
  | "loyalty"
  | "settings"
  | "insights"
  | "staff";

const ALL_SCOPES: Scope[] = [
  "menu",
  "categories",
  "orders",
  "kitchen",
  "tables",
  "reservations",
  "coupons",
  "reviews",
  "loyalty",
  "settings",
  "insights",
  "staff",
];

/**
 * The permission matrix. OWNER and MANAGER both get every scope — the
 * distinction between them isn't which admin sections they can open, it's
 * what they can do to *other staff* inside the Staff section (a MANAGER
 * can't create/edit/deactivate an OWNER, and can't see/edit nid or salary
 * — see the staff API routes for those checks, which are finer-grained
 * than this scope matrix supports).
 *
 * WAITER / CASHIER / DELIVERY all share "orders" (all three touch order
 * status at some point in the flow), plus whatever's specific to their
 * job. KITCHEN only gets "kitchen" — menu availability toggling from the
 * kitchen board is a possible future addition, not part of this change.
 */
const PERMISSION_MATRIX: Record<StaffRole, Scope[]> = {
  OWNER: ALL_SCOPES,
  MANAGER: ALL_SCOPES,
  WAITER: ["orders", "tables", "reservations"],
  CASHIER: ["orders", "tables", "loyalty"],
  DELIVERY: ["orders"],
  KITCHEN: ["kitchen"],
};

/** The admin path each scope's section lives at — used to bounce a staff
 * member who hits a page/route they can't use toward somewhere they can. */
const SCOPE_PATH: Record<Scope, string> = {
  menu: "/admin/menu",
  categories: "/admin/categories",
  orders: "/admin/orders",
  kitchen: "/admin/kitchen",
  tables: "/admin/tables",
  reservations: "/admin/reservations",
  coupons: "/admin/coupons",
  reviews: "/admin/reviews",
  loyalty: "/admin/loyalty",
  settings: "/admin/settings",
  insights: "/admin/insights",
  staff: "/admin/staff",
};

// Nav / redirect priority order — first scope in this list that a role has
// is treated as "their" home section.
const SCOPE_PRIORITY: Scope[] = [
  "orders",
  "kitchen",
  "tables",
  "reservations",
  "menu",
  "categories",
  "coupons",
  "reviews",
  "loyalty",
  "staff",
  "settings",
  "insights",
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
 * "/admin" itself only if a role somehow has zero scopes. */
export function firstAllowedPath(role?: string | null): string {
  const scopes = getScopesForRole(role);
  const first = SCOPE_PRIORITY.find((scope) => scopes.includes(scope));
  return first ? SCOPE_PATH[first] : "/admin";
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

/** Sensitive StaffProfile fields (nid, salary) are OWNER-only, both to
 * read and to write — MANAGER sees/edit everything else on the profile. */
export function canViewSensitiveStaffFields(role?: string | null): boolean {
  return role === "OWNER";
}
