import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { documentDecisionSchema } from "@/lib/validations/delivery";
import { describeDocument, isRiderDocumentType } from "@/lib/rider-documents";
import { signedDocumentUrl } from "@/lib/rider-documents-storage";

type Params = { params: Promise<{ id: string; type: string }> };

/** GET — open the rider's file (one-minute signed link). Owner / manager. */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;
  const { id, type } = await params;
  if (!isRiderDocumentType(type)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });

  const doc = await prisma.riderDocument.findUnique({
    where: { riderId_type: { riderId: id, type } },
    select: { filePath: true, fileName: true },
  });
  if (!doc) return NextResponse.json({ error: "Not uploaded yet." }, { status: 404 });

  const url = await signedDocumentUrl(doc.filePath, doc.fileName);
  if (!url) return NextResponse.json({ error: "Couldn't open the file. Please try again." }, { status: 502 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}

/**
 * PATCH { action: "VERIFIED" } or { action: "REJECTED", note } — after
 * checking the file. The rider sees the result (and the reason) on their
 * Profile and in their notifications.
 */
export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;
  const { id, type } = await params;
  if (!isRiderDocumentType(type)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });

  const parsed = await parseBody(request, documentDecisionSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const saved = await prisma.riderDocument.update({
      where: { riderId_type: { riderId: id, type } },
      data: {
        status: parsed.action,
        note: parsed.action === "REJECTED" ? parsed.note : null,
        reviewedAt: new Date(),
        reviewedById: authResult.user.id!,
      },
      select: { type: true, status: true, expiresAt: true, uploadedAt: true, fileName: true, note: true },
    });
    return NextResponse.json(describeDocument(type, saved));
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "This document hasn't been uploaded." }, { status: 404 });
    }
    console.error("[admin/staff/documents] update failed:", error);
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 });
  }
}
