import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { updateReviewStatusSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("reviews");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(request, updateReviewStatusSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const review = await prisma.review.update({
      where: { id },
      data: { status: parsed.status },
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
  const authResult = await requireApiScope("reviews");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}
