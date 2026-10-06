import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/require-admin";

const bodySchema = z.object({
  // A feed item id: "order-<id>", "review-<id>", … (see
  // lib/admin-notifications.ts).
  id: z.string().min(1).max(200),
});

/**
 * POST /api/admin/notifications/read-item — a staff member (owner, manager, …) opened ONE notification.
 *
 * "Mark All as Read" (/api/admin/notifications/read) moves a single
 * timestamp, so it cannot mark one item and leave an older one unread.
 * This stores the item's id instead (NotificationRead). The row is always
 * the caller's own: the user id comes from the session, never the body.
 *
 * upsert, not create: clicking the same notification twice (or two tabs)
 * must be a no-op, not a unique-constraint error.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireApiStaff();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  await prisma.notificationRead.upsert({
    where: { userId_notificationId: { userId, notificationId: parsed.data.id } },
    update: {},
    create: { userId, notificationId: parsed.data.id },
  });

  return NextResponse.json({ ok: true });
}
