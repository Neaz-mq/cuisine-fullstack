import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/require-admin";

/**
 * POST /api/admin/notifications/read — "Mark all as Read"।
 *
 * ⚠️ চিহ্নটা প্রতিটা staff-এর নিজের (`StaffProfile.notificationsReadAt`),
 * পুরো রেস্তোরাঁর একটা নয়। manager পড়ে ফেললে cashier-এর তালিকা পরিষ্কার
 * হয়ে যাওয়া মানে তাঁর কাছে খবরটা কখনো পৌঁছালই না।
 *
 * ⚠️ `updateMany`, `update` নয়: যাঁর StaffProfile সারি নেই (যেমন OWNER
 * অ্যাকাউন্ট, যেটা staff তালিকার বাইরে থেকেও admin panel দেখতে পারে)
 * তাঁর ক্ষেত্রে `update` "Record not found" দিয়ে ব্যর্থ হতো। updateMany
 * চুপচাপ ০ সারি বদলায়, আর বোতামটা তখন কেবল কিছুই করে না — error নয়।
 */
export async function POST() {
  const authResult = await requireApiStaff();
  if (authResult instanceof NextResponse) return authResult;

  const userId = authResult.user.id;

  const result = await prisma.staffProfile.updateMany({
    where: { userId },
    data: { notificationsReadAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
