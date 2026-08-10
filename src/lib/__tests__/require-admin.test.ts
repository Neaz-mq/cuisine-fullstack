import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests mock "@/auth" and "@/lib/prisma" entirely — same approach as
 * order-checkout-shared.test.ts — so the suite never needs a real NextAuth
 * session, a live database, or a generated Prisma client. What's under
 * test is the ACCESS-CONTROL LOGIC itself: given a session shape and a
 * user row, does the guard correctly return 401/403 or let the request
 * through. That logic is exactly what stands between a WAITER account
 * and, say, the staff-management API — worth pinning down directly rather
 * than only exercising it indirectly through route tests.
 *
 * ⚠️ IMPORTANT — the guards no longer read the role from the session.
 *
 * They used to: `const role = (session.user as { role?: string }).role`.
 * But that value comes from the JWT, which auth.config.ts only writes at
 * login. Demote a MANAGER to WAITER and their live token still says
 * MANAGER, so hasPermission handed them the whole admin panel until the
 * token expired. The old isDeactivatedStaff caught a *deactivated*
 * account but never a *demoted* one — and in a restaurant, role changes
 * are far more common than firings.
 *
 * Now loadActiveRole() reads role + isActive from the database on every
 * request, and the session role is ignored entirely. Several tests below
 * deliberately set a session role that DISAGREES with the database row,
 * to prove the database is what decides.
 *
 * Only the API-route guards (requireApiScope / requireApiScopeAny /
 * requireApiStaff) are covered here. The page-level guards (requireAdmin /
 * requireStaff / requireStaffAny) call next/navigation's redirect(), which
 * throws outside a real Next request context — not exercised here to keep
 * this suite fast and dependency-free; their logic is a thin wrapper
 * around the same hasPermission/isStaffRole checks tested below and in
 * permissions.test.ts.
 */

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

import { requireApiScope, requireApiScopeAny, requireApiStaff } from "@/lib/require-admin";
import { NextResponse } from "next/server";

/** A NextAuth session shape. The `role` here is what the JWT carries —
 * deliberately NOT what the guards trust. Several tests pass a role here
 * that differs from dbUser() below. */
function session(id: string, role: string) {
  return { user: { id, role } };
}

/** What prisma.user.findUnique resolves to: the authoritative role plus
 * the staff profile's isActive flag. `staffProfile: null` models a
 * staff-role user whose profile row is missing. */
function dbUser(role: string, isActive: boolean | null = true) {
  return {
    role,
    staffProfile: isActive === null ? null : { isActive },
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockFindUnique.mockReset();
});

describe("requireApiScope", () => {
  it("returns 401 when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    // No session means no user id to look up — the DB is never touched.
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 403 when the role lacks the requested scope", async () => {
    mockAuth.mockResolvedValue(session("u1", "WAITER"));
    mockFindUnique.mockResolvedValue(dbUser("WAITER"));
    const result = await requireApiScope("staff");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the session when the role has the scope and is active staff", async () => {
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(dbUser("OWNER"));
    const result = await requireApiScope("menu");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { user: { id: string } }).user.id).toBe("u1");
  });

  it("returns 403 'Account deactivated' for a deactivated staff member, even with the right scope", async () => {
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(dbUser("OWNER", false));
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/deactivat/i);
  });

  it("fails closed when a staff-role user has no StaffProfile row at all", async () => {
    // loadActiveRole treats a missing profile as deactivated, not as "no
    // restriction" — this should never happen in practice, but if it does,
    // access must be denied rather than silently granted.
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(dbUser("OWNER", null));
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 403 when the user row no longer exists at all", async () => {
    // Account deleted while a session was still live. Nothing to grant a
    // role from, so deny.
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(null);
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies a CUSTOMER", async () => {
    mockAuth.mockResolvedValue(session("u1", "CUSTOMER"));
    mockFindUnique.mockResolvedValue(dbUser("CUSTOMER", null));
    const result = await requireApiScope("menu");
    expect((result as NextResponse).status).toBe(403);
  });

  // ---------------------------------------------------------------------
  // The reason this whole change exists: the DB decides, not the token.
  // ---------------------------------------------------------------------

  it("ignores a stale OWNER role in the session when the DB says WAITER", async () => {
    // The exact scenario the old code got wrong: someone was demoted, but
    // their already-issued JWT still carries the old role. Trusting the
    // session here handed a WAITER the staff-management API.
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(dbUser("WAITER"));
    const result = await requireApiScope("staff");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("honours a promotion recorded in the DB even though the session still says WAITER", async () => {
    // The mirror case — a fresh grant of access shouldn't require the
    // staff member to log out and back in before it takes effect.
    mockAuth.mockResolvedValue(session("u1", "WAITER"));
    mockFindUnique.mockResolvedValue(dbUser("MANAGER"));
    const result = await requireApiScope("staff");
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("looks the user up by the session's user id", async () => {
    mockAuth.mockResolvedValue(session("u-42", "OWNER"));
    mockFindUnique.mockResolvedValue(dbUser("OWNER"));
    await requireApiScope("menu");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-42" } })
    );
  });
});

describe("requireApiScopeAny", () => {
  it("passes if the role has at least one of the listed scopes", async () => {
    mockAuth.mockResolvedValue(session("u2", "KITCHEN"));
    mockFindUnique.mockResolvedValue(dbUser("KITCHEN"));
    const result = await requireApiScopeAny(["orders", "kitchen"]);
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("denies if the role has none of the listed scopes", async () => {
    mockAuth.mockResolvedValue(session("u2", "DELIVERY"));
    mockFindUnique.mockResolvedValue(dbUser("DELIVERY"));
    const result = await requireApiScopeAny(["orders", "kitchen"]);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies a deactivated staff member who would otherwise match a scope", async () => {
    mockAuth.mockResolvedValue(session("u2", "KITCHEN"));
    mockFindUnique.mockResolvedValue(dbUser("KITCHEN", false));
    const result = await requireApiScopeAny(["orders", "kitchen"]);
    expect((result as NextResponse).status).toBe(403);
  });
});

describe("requireApiStaff", () => {
  it("passes for any staff role regardless of specific scope", async () => {
    mockAuth.mockResolvedValue(session("u3", "KITCHEN"));
    mockFindUnique.mockResolvedValue(dbUser("KITCHEN"));
    const result = await requireApiStaff();
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("denies a CUSTOMER", async () => {
    mockAuth.mockResolvedValue(session("u3", "CUSTOMER"));
    mockFindUnique.mockResolvedValue(dbUser("CUSTOMER", null));
    const result = await requireApiStaff();
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies a deactivated staff member", async () => {
    mockAuth.mockResolvedValue(session("u3", "KITCHEN"));
    mockFindUnique.mockResolvedValue(dbUser("KITCHEN", false));
    const result = await requireApiStaff();
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when there is no session at all", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireApiStaff();
    expect((result as NextResponse).status).toBe(401);
  });
});