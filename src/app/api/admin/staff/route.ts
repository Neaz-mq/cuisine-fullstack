import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import {
  canManageStaffRole,
  canViewSensitiveStaffFields,
  type StaffRole,
} from "@/lib/permissions";
import { nextEmployeeId } from "@/lib/staff";
import { createStaffSchema } from "@/lib/validations/staff";
import { parseBody } from "@/lib/validations/parse";
import { type MoneyInput, toMoney } from "@/lib/money";
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  resetPasswordUrl,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";
import { randomBytes } from "crypto";
import type { Shift } from "@/generated/prisma/client";

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
    // Figma-র সারিতে avatar — Google login-এ আসা ছবি, নয়তো "Add New
    // Staff" modal থেকে upload করা ছবির Supabase URL।
    image: string | null;
    staffProfile: {
      employeeId: string;
      department: string | null;
      employmentType: string;
      phone: string | null;
      hireDate: Date;
      // nid/salary-র মতো OWNER-only নয় — ঠিকানাটা modal-এর সাধারণ
      // ঘরগুলোর একটা, তাই includeSensitive-এর বাইরে।
      address: string | null;
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
          address: staffProfile.address,
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
      image: true,
      staffProfile: {
        select: {
          employeeId: true,
          department: true,
          employmentType: true,
          phone: true,
          hireDate: true,
          address: true,
          shift: true,
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

  const parsed = await parseBody(req, createStaffSchema);
  if (parsed instanceof NextResponse) return parsed;
  const {
    name,
    email,
    password,
    role,
    department,
    employmentType,
    phone,
    hireDate,
    shift,
    nid,
    salary,
    address,
    image,
    isActive,
  } = parsed;

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

  /**
   * password না পাঠালে কী হয় — এবং কেন সেটাই ডিফল্ট।
   *
   * Figma-র "Add New Staff" modal-এ password-এর কোনো ঘর নেই। তাই এখানে
   * একটা ৩২-byte random password বসানো হয়, যেটা কেউ কখনো দেখে না, আর
   * তারপর কর্মীকে একটা "নিজের password ঠিক করুন" link পাঠানো হয় —
   * forgot-password-এর ঠিক সেই একই token ব্যবস্থা (lib/password-reset.ts)।
   *
   * ⚠️ column-টা nullable নয়, তাই "password ছাড়া user" বানানো যেত না।
   * আর ফাঁকা/অনুমেয় কিছু (যেমন "changeme123") বসানো অনেক খারাপ হতো:
   * link আসার আগেই যে কেউ ওটা দিয়ে ঢুকে পড়তে পারত। random মানে
   * কার্যত কোনো password নেই, অথচ schema-র শর্তও ভাঙে না।
   */
  const shouldInvite = !password;
  const hashedPassword = await bcrypt.hash(
    password ?? randomBytes(32).toString("base64url"),
    10
  );

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
            // modal-এর drop-zone থেকে আসা Supabase URL। ফাঁকা string
            // এলে null — নাহলে UserAvatar `src` কে truthy ধরে একটা
            // ফাঁকা <img> বসাত, আর silhouette fallback-টা হারাত।
            image: image?.trim() || null,
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
            address: typeof address === "string" ? address.trim() || null : null,
            // modal-এর "Status" dropdown। না পাঠালে schema-র default
            // (true) — পুরনো StaffForm এটা পাঠায় না, তাই আচরণ অপরিবর্তিত।
            ...(typeof isActive === "boolean" ? { isActive } : {}),
            shift: shift ?? null,
            nid: includeSensitive && typeof nid === "string" ? nid.trim() || null : null,
            salary: includeSensitive && typeof salary === "number" ? salary : null,
          },
        });
        return { user, profile };
      });

      /**
       * Invite email — transaction-এর বাইরে, ইচ্ছাকৃতভাবে।
       *
       * ভেতরে রাখলে Resend ধীর হলে DB transaction ততক্ষণ খোলা থাকত, আর
       * email ব্যর্থ হলে সদ্য তৈরি staff record-টাই rollback হয়ে যেত —
       * অর্থাৎ "mail গেল না" সমস্যা "কর্মীই তৈরি হলো না" সমস্যা হয়ে
       * দাঁড়াত। helper নিজে কখনো throw করে না (দেখুন
       * send-password-reset-email.ts), তাই `void` এখানে নিরাপদ।
       */
      if (shouldInvite) {
        const token = generateResetToken();
        await prisma.passwordResetToken.create({
          data: {
            tokenHash: hashResetToken(token),
            userId: created.user.id,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        });
        void sendPasswordResetEmail({
          to: created.user.email,
          firstName: created.user.name?.trim().split(/\s+/)[0] || "there",
          resetUrl: resetPasswordUrl(token),
        });
      }

      const {
        id,
        name: createdName,
        email: createdEmail,
        role: createdRole,
        createdAt,
        image: createdImage,
      } = created.user;
      return NextResponse.json(
        serializeStaff(
          {
            id,
            name: createdName,
            email: createdEmail,
            role: createdRole,
            createdAt,
            image: createdImage,
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
