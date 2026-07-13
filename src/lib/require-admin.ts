import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission, hasAnyPermission, isStaffRole, type Scope } from "@/lib/permissions";

/**
 * src/lib/require-admin.ts
 *
 * Page-level and API-level RBAC guards, built on top of lib/permissions.ts.
 *
 * File name kept as "require-admin.ts" (not renamed to require-staff.ts)
 * since it's imported from ~25 places across the app; renaming it would
 * just be diff noise on top of the actual RBAC change.
 */

/** True if this staff user has been deactivated since their JWT was
 * issued. JWT sessions don't re-check the DB on every request by default,
 * so a deactivated staff member could otherwise keep using an
 * already-issued session until it expires. Only staff roles have a
 * StaffProfile row at all — CUSTOMER never hits this. */
async function isDeactivatedStaff(userId: string, role?: string) {
  if (!isStaffRole(role)) return false;
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { isActive: true },
  });
  // No profile at all for a staff-role user shouldn't normally happen,
  // but if it does, fail closed rather than silently granting access.
  return !profile || !profile.isActive;
}

/** Page-level guard: any staff role may pass. Section-level layout.tsx
 * files handle the finer-grained scope check for their own subtree. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!isStaffRole(role)) redirect("/");
  if (await isDeactivatedStaff(session.user.id, role)) redirect("/login");
  return session;
}

/** Page-level guard for a specific scope, e.g. requireStaff("settings").
 * Redirects non-staff to "/", and staff without this scope to "/admin"
 * (the layout there will bounce them further to a section they CAN see). */
export async function requireStaff(scope: Scope) {
  const session = await requireAdmin();
  const role = (session.user as { role?: string }).role;
  if (!hasPermission(role, scope)) redirect("/admin");
  return session;
}

/** Same as requireStaff, but passes if the role has ANY of the given
 * scopes — e.g. the orders-status endpoint is usable by "orders" staff
 * (waiter/cashier/delivery/manager/owner) AND "kitchen" staff. */
export async function requireStaffAny(scopes: Scope[]) {
  const session = await requireAdmin();
  const role = (session.user as { role?: string }).role;
  if (!hasAnyPermission(role, scopes)) redirect("/admin");
  return session;
}

/**
 * API-route guard for a specific scope. Unlike requireAdmin/requireStaff,
 * this does NOT call redirect() — inside a Route Handler, redirect() throws
 * a NEXT_REDIRECT error instead of actually producing a redirect response,
 * which isn't what an API consumer (fetch() from a client component) wants.
 * Instead this returns either the session or a ready-to-return
 * NextResponse, so callers do:
 *
 *   const result = await requireApiScope("menu");
 *   if (result instanceof NextResponse) return result;
 *   const session = result;
 */
export async function requireApiScope(scope: Scope) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (!hasPermission(role, scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (await isDeactivatedStaff(session.user.id, role)) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  return session;
}

/** Same idea as requireApiScope, but passes for ANY of the given scopes. */
export async function requireApiScopeAny(scopes: Scope[]) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (!hasAnyPermission(role, scopes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (await isDeactivatedStaff(session.user.id, role)) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  return session;
}

/** API-route guard: any staff role passes (no specific scope required) —
 * used by endpoints like upload-image that are shared infrastructure for
 * several sections rather than belonging to exactly one. */
export async function requireApiStaff() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (await isDeactivatedStaff(session.user.id, role)) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  return session;
}
