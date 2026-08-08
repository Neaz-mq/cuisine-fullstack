import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests mock "@/auth" and "@/lib/prisma" entirely — same approach as
 * order-checkout-shared.test.ts — so the suite never needs a real NextAuth
 * session, a live database, or a generated Prisma client. What's under
 * test is the ACCESS-CONTROL LOGIC itself: given a session shape and a
 * staff-profile row, does the guard correctly return 401/403 or let the
 * request through. That logic is exactly what stands between a WAITER
 * account and, say, the staff-management API — worth pinning down
 * directly rather than only exercising it indirectly through route tests.
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
    staffProfile: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

import { requireApiScope, requireApiScopeAny, requireApiStaff } from "@/lib/require-admin";
import { NextResponse } from "next/server";

function session(id: string, role: string) {
  return { user: { id, role } };
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
  });

  it("returns 403 when the role lacks the requested scope", async () => {
    mockAuth.mockResolvedValue(session("u1", "WAITER"));
    const result = await requireApiScope("staff");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    // A denied-by-scope check must never even query staffProfile —
    // there's nothing to look up once the role itself is disqualified.
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns the session when the role has the scope and is active staff", async () => {
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue({ isActive: true });
    const result = await requireApiScope("menu");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { user: { id: string } }).user.id).toBe("u1");
  });

  it("returns 403 'Account deactivated' for a deactivated staff member, even with the right scope", async () => {
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue({ isActive: false });
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/deactivat/i);
  });

  it("fails closed when a staff-role user has no StaffProfile row at all", async () => {
    // isDeactivatedStaff treats a missing profile as deactivated, not as
    // "no restriction" — this should never happen in practice, but if it
    // does, access must be denied rather than silently granted.
    mockAuth.mockResolvedValue(session("u1", "OWNER"));
    mockFindUnique.mockResolvedValue(null);
    const result = await requireApiScope("menu");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("never checks staffProfile for CUSTOMER — isDeactivatedStaff short-circuits", async () => {
    mockAuth.mockResolvedValue(session("u1", "CUSTOMER"));
    const result = await requireApiScope("menu");
    expect((result as NextResponse).status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("requireApiScopeAny", () => {
  it("passes if the role has at least one of the listed scopes", async () => {
    mockAuth.mockResolvedValue(session("u2", "KITCHEN"));
    mockFindUnique.mockResolvedValue({ isActive: true });
    const result = await requireApiScopeAny(["orders", "kitchen"]);
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("denies if the role has none of the listed scopes", async () => {
    mockAuth.mockResolvedValue(session("u2", "DELIVERY"));
    const result = await requireApiScopeAny(["orders", "kitchen"]);
    expect((result as NextResponse).status).toBe(403);
  });
});

describe("requireApiStaff", () => {
  it("passes for any staff role regardless of specific scope", async () => {
    mockAuth.mockResolvedValue(session("u3", "KITCHEN"));
    mockFindUnique.mockResolvedValue({ isActive: true });
    const result = await requireApiStaff();
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("denies a CUSTOMER", async () => {
    mockAuth.mockResolvedValue(session("u3", "CUSTOMER"));
    const result = await requireApiStaff();
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when there is no session at all", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireApiStaff();
    expect((result as NextResponse).status).toBe(401);
  });
});