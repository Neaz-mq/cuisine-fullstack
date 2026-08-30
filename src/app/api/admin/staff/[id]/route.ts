import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import {
  STAFF_ROLES,
  canManageStaffRole,
  canViewSensitiveStaffFields,
  type StaffRole,
} from "@/lib/permissions";
import type { EmploymentType, Shift } from "@/generated/prisma/client";
import { updateStaffSchema } from "@/lib/validations/staff";
import { parseBody } from "@/lib/validations/parse";
import { type MoneyInput, toMoney } from "@/lib/money";

function serialize(
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: Date;
    staffProfile: {
      employeeId: string;
      department: string | null;
      employmentType: string;
      phone: string | null;
      hireDate: Date;
      // nid/salary-র মতো RBAC-গেটেড নয় — shift কার শিফট সেটা লুকানোর
      // কিছু নেই, তাই সবসময় serialize হয়, includeSensitive-এর বাইরে।
      shift: Shift | null;
      isActive: boolean;
      nid: string | null;
      // ⚠️ Decimal, number নয় — Prisma এখন এটাই দেয়। JSON-এ যাওয়ার
      // সময় নিচে .toNumber() হয়ে যায়।
      salary: MoneyInput | null;
    } | null;
  },
  includeSensitive: boolean
) {
  const { staffProfile, ...rest } = user;
  return {
    ...rest,
    staffProfile: staffProfile
      ? {
          employeeId: staffProfile.employeeId,
          department: staffProfile.department,
          employmentType: staffProfile.employmentType,
          phone: staffProfile.phone,
          hireDate: staffProfile.hireDate,
          shift: staffProfile.shift,
          isActive: staffProfile.isActive,
          ...(includeSensitive
            ? {
                nid: staffProfile.nid,
                // JSON.stringify একটা Decimal-কে string বানায় ("45000"),
                // আর StaffForm সেটাকে number ধরে নেয়। তাই boundary-তেই
                // রূপান্তর। বেতন কোনো order-এর হিসাবে ঢোকে না, শুধু
                // দেখানো ও সম্পাদনা — তাই float এখানে নিরাপদ।
                salary:
                  staffProfile.salary != null ? toMoney(staffProfile.salary).toNumber() : null,
              }
            : {}),
        }
      : null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const role = (authResult.user as { role?: string }).role;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      staffProfile: {
        select: {
          employeeId: true,
          department: true,
          employmentType: true,
          phone: true,
          hireDate: true,
          shift: true,
          isActive: true,
          nid: true,
          salary: true,
        },
      },
    },
  });

  if (!user || user.role === "CUSTOMER") {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  return NextResponse.json(serialize(user, canViewSensitiveStaffFields(role)));
}

/**
 * PATCH /api/admin/staff/[id]
 *
 * Editable: name, department, employmentType, phone, hireDate, shift,
 * isActive, password (optional reset), role, and — OWNER only —
 * nid/salary.
 *
 * Guardrails:
 *  - Can't deactivate your own account (would lock you out with no one
 *    else able to reactivate it, if you're the only owner online).
 *  - Can't change your own role (prevents accidental self-demotion).
 *  - Changing role to/from OWNER, or editing an existing OWNER's profile
 *    at all, requires the requester to already be OWNER — a MANAGER can't
 *    promote themself or anyone else to OWNER, and can't touch an OWNER's
 *    other fields either.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const actingRole = (authResult.user as { role?: string }).role;
  const actingUserId = authResult.user.id;

  const target = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true },
  });
  if (!target || target.role === "CUSTOMER") {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  // A MANAGER can't touch an OWNER's profile in any way, including
  // deactivating them or editing their non-sensitive fields.
  if (!canManageStaffRole(actingRole, target.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, updateStaffSchema);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;
  const isSelf = id === actingUserId;

  if (body.isActive === false && isSelf) {
    return NextResponse.json(
      { error: "You can't deactivate your own account." },
      { status: 400 }
    );
  }

  if (body.role !== undefined && body.role !== target.role) {
    if (isSelf) {
      return NextResponse.json(
        { error: "You can't change your own role." },
        { status: 400 }
      );
    }
    if (!STAFF_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid staff role" }, { status: 400 });
    }
    // Covers both directions: promoting someone TO owner, and (already
    // blocked above) a non-owner editing an EXISTING owner at all.
    if (!canManageStaffRole(actingRole, body.role as StaffRole)) {
      return NextResponse.json(
        { error: "Only an owner can grant or remove owner access." },
        { status: 403 }
      );
    }
  }

  const includeSensitive = canViewSensitiveStaffFields(actingRole);

  const userData: { name?: string; role?: StaffRole; password?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) userData.name = body.name.trim();
  if (body.role !== undefined && body.role !== target.role) userData.role = body.role;
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    userData.password = await bcrypt.hash(body.password, 10);
  }

  const profileData: {
    department?: string | null;
    employmentType?: EmploymentType;
    phone?: string | null;
    hireDate?: Date;
    shift?: Shift | null;
    isActive?: boolean;
    nid?: string | null;
    salary?: number | null;
  } = {};
  if (body.department !== undefined) profileData.department = body.department?.trim() || null;
  if (body.employmentType !== undefined) {
    profileData.employmentType = body.employmentType;
  }
  if (body.phone !== undefined) profileData.phone = body.phone?.trim() || null;
  if (body.hireDate) profileData.hireDate = new Date(body.hireDate);
  // ⚠️ `!== undefined`, `if (body.shift)` নয় — শিফট আবার null করে ফাঁকা
  // করার request-টাও একটা বৈধ আপডেট (updateStaffSchema-র মন্তব্য দ্রষ্টব্য),
  // আর `null` falsy বলে `if (body.shift)` সেটাকে "কিছু পাঠানো হয়নি"-র
  // সাথে গুলিয়ে ফেলত।
  if (body.shift !== undefined) profileData.shift = body.shift;
  if (typeof body.isActive === "boolean") profileData.isActive = body.isActive;
  // nid/salary are silently ignored (not rejected) for non-owner requesters
  // — a MANAGER's edit form simply doesn't send these fields at all.
  if (includeSensitive) {
    if (body.nid !== undefined) profileData.nid = body.nid?.trim() || null;
    if (typeof body.salary === "number") profileData.salary = body.salary;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user =
        Object.keys(userData).length > 0
          ? await tx.user.update({ where: { id }, data: userData })
          : target;
      const profile =
        Object.keys(profileData).length > 0
          ? await tx.staffProfile.update({ where: { userId: id }, data: profileData })
          : target.staffProfile;
      return { user, profile };
    });

    return NextResponse.json(
      serialize(
        {
          id: updated.user.id,
          name: updated.user.name,
          email: updated.user.email,
          role: updated.user.role,
          createdAt: updated.user.createdAt,
          staffProfile: updated.profile,
        },
        includeSensitive
      )
    );
  } catch (err) {
    console.error("PATCH /api/admin/staff/[id] error:", err);
    return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 });
  }
}
