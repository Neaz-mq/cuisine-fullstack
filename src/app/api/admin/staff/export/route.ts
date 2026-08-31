import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { Prisma } from "@/generated/prisma/client";
import { ROLE_LABELS, isStaffRoleFilter } from "@/lib/staff-roles";
import { SHIFT_LABELS, isStaffShift } from "@/lib/staff-shift";
import type { StaffRole } from "@/lib/permissions";

/**
 * GET /api/admin/staff/export?q=&role=
 *
 * /admin/staff-এর "Export Report" বোতামের পেছনের route — /admin/users-এর
 * export-এর হুবহু প্রতিরূপ, শুধু গ্রাহকের বদলে কর্মীর তালিকা। পর্দায় যে
 * তালিকাটা দেখা যাচ্ছে ঠিক সেটাই নামে (একই search, একই role-ছাঁকনি), শুধু
 * page-এর ১০টা সারি নয়, পুরোটা।
 *
 * ⚠️ nid আর salary ইচ্ছাকৃতভাবে CSV-তে নেই — OWNER-এর জন্যও নয়।
 *
 * ওই দুটো field-এর OWNER-only নিয়মটা (canViewSensitiveStaffFields)
 * application code-এ, আর সেটা কাজ করে যতক্ষণ ডেটাটা app-এর ভেতরে থাকে।
 * CSV হলো ঠিক সেই মুহূর্ত যেখানে ডেটা app ছেড়ে বেরিয়ে যায় — একটা ফাইল
 * হয়ে Downloads ফোল্ডারে, তারপর email-এ, তারপর কারও Google Drive-এ।
 * প্রত্যেক কর্মীর জাতীয় পরিচয়পত্র নম্বর আর বেতন এক ফাইলে জমা করাটা
 * একটা spreadsheet-এর সুবিধার তুলনায় অনেক বড় দায়। কারও সত্যিই payroll
 * export লাগলে সেটা আলাদা, স্পষ্টভাবে নামকরণ করা, আলাদাভাবে scope করা
 * route হওয়া উচিত — এই সাধারণ "কর্মীর তালিকা" বোতামের পাশ দিয়ে নয়।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  // users-export-এর একই সীমা, একই কারণ: page limit ছাড়া পুরো তালিকা,
  // আর এটা ব্যক্তিগত তথ্য এক ফাইলে ঢালে।
  const rate = checkRateLimit(request, "staff-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const rawRole = searchParams.get("role");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়, শুধু
  // ছাঁকনিটা খুলে যায়। বাকি দুটো export route-এও একই আচরণ।
  const roleFilter = isStaffRoleFilter(rawRole) ? rawRole : null;

  /**
   * ⚠️ এই শর্তটা admin/staff/page.tsx-এর শর্তের হুবহু প্রতিরূপ হতে হবে —
   * নাহলে পর্দায় এক তালিকা আর ফাইলে আরেক, আর সেটা ধরা পড়ে অনেক পরে।
   * page.tsx-এ বদলালে এখানেও বদলাতে হবে।
   */
  const where: Prisma.UserWhereInput = {
    role: roleFilter ?? { not: "CUSTOMER" },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { staffProfile: { employeeId: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const staff = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      role: true,
      staffProfile: {
        select: {
          employeeId: true,
          phone: true,
          address: true,
          hireDate: true,
          shift: true,
          isActive: true,
        },
      },
    },
  });

  const header = [
    "Employee ID",
    "Name",
    "Email",
    "Role",
    "Phone",
    "Permanent Address",
    "Join Date",
    "Shift",
    "Status",
  ];

  const rows = staff.map((member) => {
    const profile = member.staffProfile;
    return [
      profile?.employeeId ?? "",
      member.name ?? "",
      member.email,
      ROLE_LABELS[member.role as StaffRole],
      // ⚠️ ফাঁকা, "—" নয় — ওটা পর্দার জন্য। spreadsheet-এ একটা dash মানে
      // "এই ঘরে dash লেখা আছে", আর তখন কলাম ধরে ছাঁকা যায় না।
      profile?.phone ?? "",
      profile?.address ?? "",
      // ISO তারিখ, "Jul 3, 2026" নয় — spreadsheet এটাকে তারিখ হিসেবে চেনে
      // আর সাজাতে পারে, আর locale বদলালেও অর্থ বদলায় না।
      profile ? profile.hireDate.toISOString().slice(0, 10) : "",
      profile?.shift && isStaffShift(profile.shift) ? SHIFT_LABELS[profile.shift] : "",
      // profile না থাকলে page.tsx-এর মতোই "Active" ধরা হয় (isActive ?? true)।
      (profile?.isActive ?? true) ? "Active" : "Inactive",
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = roleFilter ? roleFilter.toLowerCase() : "all";

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-staff-${suffix}-${stamp}.csv"`,
      // ব্যক্তিগত তথ্য — কোনো proxy বা CDN যেন ধরে না রাখে।
      "Cache-Control": "no-store",
    },
  });
}
