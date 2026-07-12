import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Only isActive is editable after creation — code/percentOff are locked
  // once a coupon exists so a code that's already been shared/printed
  // can't silently change value out from under whoever has it. Delete and
  // recreate instead if a code needs different terms.
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json(
      { error: "Only isActive can be updated" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.coupon.update({
      where: { id },
      data: { isActive: body.isActive },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Note: there's no DB-level FK preventing this delete even for a used
  // coupon — Order only carries a denormalized `couponCode` string, not a
  // real foreign key to Coupon (see prisma/schema.prisma). So the
  // "already used" guard has to be an explicit application-level check
  // here, not something Prisma/Postgres would reject on its own.
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
  if (existing.usedByOrderId) {
    return NextResponse.json(
      {
        error:
          "Can't delete — this coupon has already been used on an order. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}