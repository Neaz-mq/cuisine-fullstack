import { describe, it, expect } from "vitest";
import {
  STAFF_ROLES,
  isStaffRole,
  hasPermission,
  hasAnyPermission,
  getScopesForRole,
  firstAllowedPath,
  canManageStaffRole,
  canViewSensitiveStaffFields,
  staffMenuLabel,
  panelLabel,
  type StaffRole,
} from "@/lib/permissions";

/**
 * permissions.ts is the single source of truth for the RBAC matrix — both
 * page guards and API guards (require-admin.ts) read from it. A silent
 * regression here (e.g. WAITER accidentally gaining "staff" scope) would
 * be a real access-control bug, not just a UI glitch, so the matrix
 * itself is worth locking down with tests independent of any HTTP layer.
 */

describe("isStaffRole", () => {
  it("accepts every role in STAFF_ROLES", () => {
    for (const role of STAFF_ROLES) {
      expect(isStaffRole(role)).toBe(true);
    }
  });

  it("rejects CUSTOMER, undefined, null, and garbage strings", () => {
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole("OWNERR")).toBe(false);
  });
});

describe("hasPermission — the core access-control matrix", () => {
  it("OWNER and MANAGER can access every scope", () => {
    const allScopes = getScopesForRole("OWNER");
    for (const scope of allScopes) {
      expect(hasPermission("OWNER", scope)).toBe(true);
      expect(hasPermission("MANAGER", scope)).toBe(true);
    }
    // Sanity check the matrix isn't accidentally empty.
    expect(allScopes.length).toBeGreaterThan(5);
  });

  it("WAITER can reach orders/tables/reservations but not staff or settings", () => {
    expect(hasPermission("WAITER", "orders")).toBe(true);
    expect(hasPermission("WAITER", "tables")).toBe(true);
    expect(hasPermission("WAITER", "reservations")).toBe(true);
    expect(hasPermission("WAITER", "staff")).toBe(false);
    expect(hasPermission("WAITER", "settings")).toBe(false);
    expect(hasPermission("WAITER", "marketing")).toBe(false);
  });

  it("CASHIER can reach orders/tables/loyalty but not kitchen or staff", () => {
    expect(hasPermission("CASHIER", "orders")).toBe(true);
    expect(hasPermission("CASHIER", "loyalty")).toBe(true);
    expect(hasPermission("CASHIER", "kitchen")).toBe(false);
    expect(hasPermission("CASHIER", "staff")).toBe(false);
  });

  it("DELIVERY can ONLY reach myDeliveries — never the full order book", () => {
    expect(hasPermission("DELIVERY", "myDeliveries")).toBe(true);
    expect(hasPermission("DELIVERY", "orders")).toBe(false);
    expect(hasPermission("DELIVERY", "kitchen")).toBe(false);
    expect(getScopesForRole("DELIVERY")).toEqual(["myDeliveries"]);
  });

  it("KITCHEN can ONLY reach kitchen", () => {
    expect(hasPermission("KITCHEN", "kitchen")).toBe(true);
    expect(hasPermission("KITCHEN", "orders")).toBe(false);
    expect(getScopesForRole("KITCHEN")).toEqual(["kitchen"]);
  });

  it("CUSTOMER, missing role, and missing scope all deny", () => {
    expect(hasPermission("CUSTOMER", "orders")).toBe(false);
    expect(hasPermission(undefined, "orders")).toBe(false);
    expect(hasPermission("OWNER", undefined)).toBe(false);
  });

  it("marketing is OWNER/MANAGER-only — never given to operational staff", () => {
    const nonManagement: StaffRole[] = ["WAITER", "CASHIER", "DELIVERY", "KITCHEN"];
    for (const role of nonManagement) {
      expect(hasPermission(role, "marketing")).toBe(false);
      expect(hasPermission(role, "staff")).toBe(false);
      expect(hasPermission(role, "settings")).toBe(false);
    }
  });
});

describe("hasAnyPermission", () => {
  it("passes if the role has at least one of the listed scopes", () => {
    expect(hasAnyPermission("WAITER", ["kitchen", "orders"])).toBe(true);
    expect(hasAnyPermission("KITCHEN", ["kitchen", "orders"])).toBe(true);
  });

  it("fails if the role has none of the listed scopes", () => {
    expect(hasAnyPermission("DELIVERY", ["kitchen", "orders"])).toBe(false);
  });

  it("fails on an empty or missing scope list", () => {
    expect(hasAnyPermission("OWNER", [])).toBe(false);
    expect(hasAnyPermission("OWNER", undefined)).toBe(false);
  });
});

describe("firstAllowedPath — where a staff member lands after login", () => {
  it("sends WAITER to /admin/orders (their highest-priority scope)", () => {
    expect(firstAllowedPath("WAITER")).toBe("/admin/orders");
  });

  it("sends DELIVERY to /admin/my-deliveries, never the general orders page", () => {
    expect(firstAllowedPath("DELIVERY")).toBe("/admin/my-deliveries");
  });

  it("sends KITCHEN to /admin/kitchen", () => {
    expect(firstAllowedPath("KITCHEN")).toBe("/admin/kitchen");
  });

  it("falls back to /admin for a non-staff role", () => {
    expect(firstAllowedPath("CUSTOMER")).toBe("/admin");
    expect(firstAllowedPath(undefined)).toBe("/admin");
  });
});

describe("canManageStaffRole — OWNER vs MANAGER staff-editing limits", () => {
  it("OWNER can manage any role, including another OWNER", () => {
    expect(canManageStaffRole("OWNER", "OWNER")).toBe(true);
    expect(canManageStaffRole("OWNER", "MANAGER")).toBe(true);
    expect(canManageStaffRole("OWNER", "WAITER")).toBe(true);
  });

  it("MANAGER can manage anyone except OWNER", () => {
    expect(canManageStaffRole("MANAGER", "WAITER")).toBe(true);
    expect(canManageStaffRole("MANAGER", "MANAGER")).toBe(true);
    expect(canManageStaffRole("MANAGER", "OWNER")).toBe(false);
  });

  it("non-management roles can't manage staff at all", () => {
    expect(canManageStaffRole("WAITER", "WAITER")).toBe(false);
    expect(canManageStaffRole(undefined, "WAITER")).toBe(false);
  });
});

describe("canViewSensitiveStaffFields — nid/salary gate", () => {
  it("only OWNER can view sensitive staff fields", () => {
    expect(canViewSensitiveStaffFields("OWNER")).toBe(true);
    expect(canViewSensitiveStaffFields("MANAGER")).toBe(false);
    expect(canViewSensitiveStaffFields("WAITER")).toBe(false);
    expect(canViewSensitiveStaffFields(undefined)).toBe(false);
  });
});

describe("staff-facing labels stay role-appropriate", () => {
  it("DELIVERY sees 'My Deliveries' / 'Rider Panel', never 'Admin Dashboard'", () => {
    expect(staffMenuLabel("DELIVERY")).toBe("My Deliveries");
    expect(panelLabel("DELIVERY")).toBe("Rider Panel");
  });

  it("OWNER/MANAGER see the real admin labels", () => {
    expect(staffMenuLabel("OWNER")).toBe("Admin Dashboard");
    expect(panelLabel("MANAGER")).toBe("Admin Panel");
  });
});