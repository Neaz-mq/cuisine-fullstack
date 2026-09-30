import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { describeAllDocuments } from "@/lib/rider-documents";

/**
 * GET /api/admin/staff/[id]/documents — a rider's documents for the View
 * Staff modal (owner / manager: "staff" scope). File contents are not in
 * the answer — each opens through /documents/[type] (signed link).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await params;

  const [docs, profile] = await Promise.all([
    prisma.riderDocument.findMany({
      where: { riderId: id },
      select: { type: true, status: true, expiresAt: true, uploadedAt: true, fileName: true, note: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: id },
      select: { vehicleType: true, vehicleModel: true, vehiclePlate: true, drivingLicenseNumber: true },
    }),
  ]);
  return NextResponse.json({ documents: describeAllDocuments(docs), vehicle: profile });
}
