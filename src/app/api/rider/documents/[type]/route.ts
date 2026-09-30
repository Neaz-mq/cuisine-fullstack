import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { isRiderDocumentType } from "@/lib/rider-documents";
import { signedDocumentUrl } from "@/lib/rider-documents-storage";

/**
 * GET /api/rider/documents/[type] — open the rider's own uploaded file.
 * Redirects to a one-minute signed link (the bucket is private).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const { type } = await params;
  if (!isRiderDocumentType(type)) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }

  const doc = await prisma.riderDocument.findUnique({
    where: { riderId_type: { riderId: authResult.user.id!, type } },
    select: { filePath: true, fileName: true },
  });
  if (!doc) return NextResponse.json({ error: "Not uploaded yet." }, { status: 404 });

  const url = await signedDocumentUrl(doc.filePath, doc.fileName);
  if (!url) return NextResponse.json({ error: "Couldn't open the file. Please try again." }, { status: 502 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
