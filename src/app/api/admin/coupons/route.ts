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

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { code, percentOff } = body as { code?: string; percentOff?: number };

  const trimmedCode = code?.trim().toUpperCase();
  if (!trimmedCode) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  if (
    typeof percentOff !== "number" ||
    !Number.isInteger(percentOff) ||
    percentOff < 1 ||
    percentOff > 100
  ) {
    return NextResponse.json(
      { error: "Percent off must be a whole number between 1 and 100" },
      { status: 400 }
    );
  }

  try {
    const coupon = await prisma.coupon.create({
      data: { code: trimmedCode, percentOff },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A coupon with this code already exists." },
      { status: 409 }
    );
  }
}