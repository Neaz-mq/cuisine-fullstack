/**
 * src/lib/rider-documents.ts
 *
 * A rider's paperwork — the kinds, and how each one is shown. No database
 * or storage code here, so the Profile page (client) and the APIs share it.
 *
 *   no upload            → "Not uploaded yet"          [Upload]
 *   PENDING              → "Uploaded · In review"      (In Review)
 *   REJECTED             → "Rejected: <reason>"        [Re-upload]
 *   VERIFIED, expired    → "Expired on Jan 3, 2027"    [Renew]
 *   VERIFIED, ≤ 30 days  → "Expires in 12 days"        (Renew Soon)
 *   VERIFIED             → "Uploaded · Verified"       (Verified)
 */

export const RIDER_DOCUMENT_TYPES = [
  { value: "DRIVING_LICENSE", label: "Driving License", needsExpiry: true },
  { value: "VEHICLE_REGISTRATION", label: "Vehicle Registration", needsExpiry: false },
  { value: "INSURANCE", label: "Insurance Certificate", needsExpiry: true },
] as const;

export type RiderDocumentType = (typeof RIDER_DOCUMENT_TYPES)[number]["value"];

export function isRiderDocumentType(value: unknown): value is RiderDocumentType {
  return RIDER_DOCUMENT_TYPES.some((type) => type.value === value);
}

export function documentLabel(type: string): string {
  return RIDER_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Uploads: images like the Figma says, plus PDF (insurers send PDFs). */
export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Days before the expiry date when "Renew Soon" shows. */
export const RENEW_SOON_DAYS = 30;

export type DocumentState = "MISSING" | "PENDING" | "REJECTED" | "EXPIRED" | "RENEW_SOON" | "VERIFIED";

export type RiderDocumentView = {
  type: RiderDocumentType;
  label: string;
  state: DocumentState;
  /** Grey line under the name. */
  detail: string;
  fileName: string | null;
  /** "YYYY-MM-DD" or null. */
  expiresAt: string | null;
  uploadedAt: string | null;
};

type StoredDocument = {
  type: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  expiresAt: Date | null;
  uploadedAt: Date;
  fileName: string;
  note: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days from `today` (local calendar day) to a DATE column (UTC midnight). */
export function daysUntil(expiresAt: Date, today: Date): number {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expiresAt.getTime() - todayUtc) / DAY_MS);
}

export function describeDocument(
  type: RiderDocumentType,
  doc: StoredDocument | undefined,
  today: Date = new Date()
): RiderDocumentView {
  const label = documentLabel(type);
  const base = {
    type,
    label,
    fileName: doc?.fileName ?? null,
    expiresAt: doc?.expiresAt ? doc.expiresAt.toISOString().slice(0, 10) : null,
    uploadedAt: doc ? doc.uploadedAt.toISOString() : null,
  };
  if (!doc) return { ...base, state: "MISSING", detail: "Not uploaded yet" };
  if (doc.status === "REJECTED") {
    return { ...base, state: "REJECTED", detail: doc.note ? `Rejected: ${doc.note}` : "Rejected — please upload it again" };
  }
  if (doc.expiresAt) {
    const days = daysUntil(doc.expiresAt, today);
    if (days < 0) return { ...base, state: "EXPIRED", detail: `Expired on ${shortDate(doc.expiresAt)}` };
    if (doc.status === "VERIFIED" && days <= RENEW_SOON_DAYS) {
      return {
        ...base,
        state: "RENEW_SOON",
        detail: days === 0 ? "Expires today" : `Expires in ${days} ${days === 1 ? "day" : "days"}`,
      };
    }
  }
  if (doc.status === "PENDING") return { ...base, state: "PENDING", detail: "Uploaded · In review" };
  return {
    ...base,
    state: "VERIFIED",
    detail: doc.expiresAt ? `Uploaded · Verified · Valid till ${shortDate(doc.expiresAt)}` : "Uploaded · Verified",
  };
}

export function describeAllDocuments(docs: StoredDocument[], today: Date = new Date()): RiderDocumentView[] {
  return RIDER_DOCUMENT_TYPES.map((t) =>
    describeDocument(
      t.value,
      docs.find((d) => d.type === t.value),
      today
    )
  );
}

/** Magic bytes, not the file name — a renamed .exe must not pass. */
export function sniffDocumentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 5 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}
