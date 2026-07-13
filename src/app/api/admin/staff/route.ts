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
import { nextEmployeeId } from "@/lib/staff";

/**
 * src/app/api/admin/staff/route.ts
 *
 * GET  /api/admin/staff  -> list every staff user (role != CUSTOMER) with
 *                            their StaffProfile. nid/salary are stripped
 *                            out of the response for anyone who isn't OWNER.
 * POST /api/admin/staff  -> create a new staff member (User + StaffProfile,
 *                            in one transaction). MANAGER can create anyone
 *                            except OWNER; only OWNER can create OWNER.
 */

// Shape returned to the client — omits password always, and omits
// nid/salary unless the requester is OWNER.
function serializeStaff(
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
      isActive: boolean;
      nid: string | null;
      salary: number | null;
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
          isActive: staffProfile.isActive,
          ...(includeSensitive
            ? { nid: staffProfile.nid, salary: staffProfile.salary }
            : {}),
        }
      : null,
  };
}

export async function GET() {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  const role = (authResult.user as { role?: string }).role;
  const includeSensitive = canViewSensitiveStaffFields(role);

  const staff = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: { createdAt: "asc" },
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
          isActive: true,
          nid: true,
          salary: true,
        },
      },
    },
  });

  return NextResponse.json(staff.map((s) => serializeStaff(s, includeSensitive)));
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  const actingRole = (authResult.user as { role?: string }).role;
  const body = await req.json();

  const {
    name,
    email,
    password,
    role,
    department,
    employmentType,
    phone,
    hireDate,
    nid,
    salary,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid staff role" }, { status: 400 });
  }
  if (!canManageStaffRole(actingRole, role as StaffRole)) {
    return NextResponse.json(
      { error: "Only an owner can create another owner account." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const includeSensitive = canViewSensitiveStaffFields(actingRole);
  const hashedPassword = await bcrypt.hash(password, 10);

  // Retry once on an employeeId collision (rare race between two
  // simultaneous staff creations) rather than wrapping the whole thing in
  // extra locking machinery for an infrequent admin operation.
  for (let attempt = 0; attempt < 2; attempt++) {
    const employeeId = await nextEmployeeId();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: name.trim(),
            email,
            password: hashedPassword,
            role,
          },
        });
        const profile = await tx.staffProfile.create({
          data: {
            userId: user.id,
            employeeId,
            department: typeof department === "string" ? department.trim() || null : null,
            employmentType: ["FULL_TIME", "PART_TIME", "CONTRACT"].includes(employmentType)
              ? employmentType
              : "FULL_TIME",
            phone: typeof phone === "string" ? phone.trim() || null : null,
            hireDate: hireDate ? new Date(hireDate) : new Date(),
            nid: includeSensitive && typeof nid === "string" ? nid.trim() || null : null,
            salary: includeSensitive && typeof salary === "number" ? salary : null,
          },
        });
        return { user, profile };
      });

      const { id, name: createdName, email: createdEmail, role: createdRole, createdAt } = created.user;
      return NextResponse.json(
        serializeStaff(
          {
            id,
            name: createdName,
            email: createdEmail,
            role: createdRole,
            createdAt,
            staffProfile: created.profile,
          },
          includeSensitive
        ),
        { status: 201 }
      );
    } catch (err) {
      const isEmployeeIdConflict =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002" &&
        attempt === 0;
      if (!isEmployeeIdConflict) {
        console.error("POST /api/admin/staff error:", err);
        return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
      }
      // fall through and retry with a freshly-computed employeeId
    }
  }

  return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
}
