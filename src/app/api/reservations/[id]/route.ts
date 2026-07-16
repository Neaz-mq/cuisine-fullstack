import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { reservationStatusUpdateSchema } from "@/lib/validations/reservation";
import { parseBody } from "@/lib/validations/parse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("reservations");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, reservationStatusUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: parsed.status },
  });

  return NextResponse.json(updated);
}