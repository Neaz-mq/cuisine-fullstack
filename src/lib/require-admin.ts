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

/**
 * এই user-এর বর্তমান role, নাকি null যদি user না থাকে বা staff হিসেবে
 * deactivated হয়ে থাকে।
 *
 * ⚠️ session.user.role কখনো authorization-এ ব্যবহার করা যাবে না। ওটা
 * JWT-তে বসে login-এর মুহূর্তে — auth.config.ts-এর jwt callback শুধু
 * `user` object থাকলেই role লেখে, অর্থাৎ প্রথমবার। এরপর প্রতিটা
 * request-এ token যেমন ছিল তেমনই ফেরত যায়, DB-র সাথে আর কোনো যোগাযোগ
 * হয় না।
 *
 * ফলে token.role হলো "login-এর মুহূর্তে এই user-এর role কী ছিল",
 * "এখন কী" নয়। কাউকে MANAGER থেকে WAITER করে দিলে তার চলমান session-এর
 * token এখনো MANAGER বলে, আর hasPermission সেটা পড়ে /admin/staff,
 * salary, marketing broadcast — সব খুলে দেয়।
 *
 * আগের isDeactivatedStaff শুধু isActive দেখত, তাই deactivate করা ধরত
 * কিন্তু demote করা ধরত না — অথচ বাস্তবে একটা রেস্তোরাঁয় role বদলানো
 * কাউকে বরখাস্ত করার চেয়ে অনেক বেশি ঘটে।
 *
 * খরচ অপরিবর্তিত: আগেও প্রতি request-এ একটা DB lookup হতো
 * (staffProfile), এখন সেই একই query-তে role-ও আসে। শুধু একটা lookup
 * আরেকটা দিয়ে বদলে গেছে, নতুন round trip যোগ হয়নি।
 */
/**
 * Exported so lib/order-access.ts can reuse it.
 *
 * ⚠️ Do NOT reimplement this anywhere. The whole point is that role comes
 * from the database on every request, never from the session/JWT — a
 * demoted MANAGER's token still says MANAGER until it expires. A second
 * copy of this logic is exactly how that bug comes back.
 */
export async function loadActiveRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, staffProfile: { select: { isActive: true } } },
  });
  if (!user) return null;

  // staff-role user-এর StaffProfile না থাকা স্বাভাবিক নয়, কিন্তু হলে
  // চুপচাপ access দেওয়ার চেয়ে বন্ধ করে দেওয়াই নিরাপদ — আগের কোডেও এই
  // fail-closed আচরণই ছিল। CUSTOMER-এর কোনো StaffProfile থাকে না, তাই
  // isStaffRole guard-টা জরুরি।
  if (isStaffRole(user.role) && !user.staffProfile?.isActive) return null;

  return user.role;
}

/** Page-level guard: any staff role may pass. Section-level layout.tsx
 * files handle the finer-grained scope check for their own subtree. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = await loadActiveRole(session.user.id);
  // null = account মুছে গেছে বা deactivate করা হয়েছে। দুটোতেই আবার
  // login করতে পাঠানো হয়, যাতে তারা একটা টাটকা session পায় (বা
  // deactivated হলে login-ই আটকে যায় — auth.ts দেখুন)।
  if (!role) redirect("/login");
  if (!isStaffRole(role)) redirect("/");

  return session;
}

/** Page-level guard for a specific scope, e.g. requireStaff("settings").
 * Redirects non-staff to "/", and staff without this scope to "/admin"
 * (the layout there will bounce them further to a section they CAN see).
 *
 * requireAdmin()-কে ডেকে তার উপর scope check করার বদলে পুরোটা এখানে
 * লেখা হয়েছে — নাহলে loadActiveRole দুবার চলত (একবার requireAdmin-এর
 * ভেতরে, আরেকবার এখানে scope মেলাতে), অর্থাৎ প্রতি page load-এ দুটো
 * অপ্রয়োজনীয় DB query। */
export async function requireStaff(scope: Scope) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = await loadActiveRole(session.user.id);
  if (!role) redirect("/login");
  if (!isStaffRole(role)) redirect("/");
  if (!hasPermission(role, scope)) redirect("/admin");

  return session;
}

/** Same as requireStaff, but passes if the role has ANY of the given
 * scopes — e.g. the orders-status endpoint is usable by "orders" staff
 * (waiter/cashier/delivery/manager/owner) AND "kitchen" staff. */
export async function requireStaffAny(scopes: Scope[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = await loadActiveRole(session.user.id);
  if (!role) redirect("/login");
  if (!isStaffRole(role)) redirect("/");
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

  const role = await loadActiveRole(session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  if (!hasPermission(role, scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

/** Same idea as requireApiScope, but passes for ANY of the given scopes. */
export async function requireApiScopeAny(scopes: Scope[]) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await loadActiveRole(session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  if (!hasAnyPermission(role, scopes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const role = await loadActiveRole(session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }
  if (!isStaffRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}