import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdmin();
  if (!authCheck.ok) return authCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be one of PENDING, APPROVED, REJECTED" },
      { status: 400 }
    );
  }

  try {
    const review = await prisma.review.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ review });
  } catch {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdmin();
  if (!authCheck.ok) return authCheck.response;

  const { id } = await params;

  try {
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}