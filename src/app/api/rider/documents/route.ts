import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  RIDER_DOCUMENT_TYPES,
  describeDocument,
  documentLabel,
  isRiderDocumentType,
  sniffDocumentType,
} from "@/lib/rider-documents";
import { removeDocumentFile, uploadDocumentFile } from "@/lib/rider-documents-storage";

/**
 * POST /api/rider/documents — Rider panel → My Profile → Documents → Upload.
 *
 * multipart/form-data: type, file, expiresAt ("YYYY-MM-DD", needed for the
 * licence and insurance). The file goes to the private bucket, replaces the
 * rider's previous one of that kind, and waits for the restaurant to check
 * it (PENDING).
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const rate = checkRateLimit(request, "rider-documents", { limit: 15, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
  }

  const type = form.get("type");
  if (!isRiderDocumentType(type)) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return NextResponse.json({ error: "The file must be 2MB or smaller." }, { status: 400 });
  }

  const rawExpiry = String(form.get("expiresAt") ?? "").trim();
  const needsExpiry = RIDER_DOCUMENT_TYPES.find((t) => t.value === type)?.needsExpiry ?? false;
  let expiresAt: Date | null = null;
  if (rawExpiry) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawExpiry);
    const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
    // "2027-02-30" rolls over to March in Date — compare back to catch it.
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== rawExpiry) {
      return NextResponse.json({ error: "Please enter a real expiry date." }, { status: 400 });
    }
    const today = new Date();
    if (date.getTime() < Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) {
      return NextResponse.json(
        { error: `This ${documentLabel(type).toLowerCase()} has already expired — please upload the renewed one.` },
        { status: 400 }
      );
    }
    expiresAt = date;
  } else if (needsExpiry) {
    return NextResponse.json({ error: "Please enter the expiry date printed on the document." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffDocumentType(bytes);
  if (!mimeType) {
    return NextResponse.json({ error: "Please use a PNG, JPG, WEBP or PDF file." }, { status: 400 });
  }

  const filePath = `${riderId}/${type.toLowerCase()}-${crypto.randomUUID()}.${DOCUMENT_MIME_TYPES[mimeType]}`;
  const fileName = file.name.slice(0, 120) || `${type.toLowerCase()}.${DOCUMENT_MIME_TYPES[mimeType]}`;

  try {
    const previous = await prisma.riderDocument.findUnique({
      where: { riderId_type: { riderId, type } },
      select: { filePath: true },
    });

    await uploadDocumentFile(filePath, bytes, mimeType);

    const saved = await prisma.riderDocument.upsert({
      where: { riderId_type: { riderId, type } },
      create: { riderId, type, filePath, fileName, mimeType, sizeBytes: file.size, expiresAt },
      update: {
        filePath,
        fileName,
        mimeType,
        sizeBytes: file.size,
        expiresAt,
        status: "PENDING",
        note: null,
        uploadedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
      },
      select: { type: true, status: true, expiresAt: true, uploadedAt: true, fileName: true, note: true },
    });
    await removeDocumentFile(previous?.filePath);

    return NextResponse.json(describeDocument(type, saved));
  } catch (error) {
    console.error("[rider/documents] upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
