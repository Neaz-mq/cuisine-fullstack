"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import { RIDER_DOCUMENT_TYPES, type DocumentState, type RiderDocumentType, type RiderDocumentView } from "@/lib/rider-documents";
import { GRADIENT_BG } from "@/app/admin/my-deliveries/rider-ui";
import DocumentUploadDialog from "./DocumentUploadDialog";

/**
 * Rider panel → My Profile → Documents (Figma): one row per document.
 *
 *   Not uploaded   → [Upload]        (gradient button, Figma)
 *   In review      → (In Review)     + View · Replace
 *   Verified       → (Verified)      green, + View · Replace
 *   Renew soon     → (Renew Soon)    orange — opens the upload
 *   Expired        → [Renew]         red — opens the upload
 *   Rejected       → [Re-upload]     red — the reason is in the grey line
 *
 * The restaurant checks each upload on the Staff page. Files open through
 * a one-minute private link (/api/rider/documents/[type]).
 */

const CHIP: Record<DocumentState, { label: string; className: string; opensUpload: boolean }> = {
  MISSING: { label: "Upload", className: `${GRADIENT_BG} text-white hover:opacity-90`, opensUpload: true },
  PENDING: { label: "In Review", className: "bg-[#E5EDFF] text-[#0090FF]", opensUpload: false },
  VERIFIED: { label: "Verified", className: "bg-[#E8FFEC] text-[#0ECF00]", opensUpload: false },
  RENEW_SOON: { label: "Renew Soon", className: "bg-[#FFF2DA] text-[#FF9E00] hover:bg-[#FFE8BF]", opensUpload: true },
  EXPIRED: { label: "Renew", className: "bg-[#FFE9EC] text-[#FF3F5C] hover:bg-[#FFD9DF]", opensUpload: true },
  REJECTED: { label: "Re-upload", className: "bg-[#FFE9EC] text-[#FF3F5C] hover:bg-[#FFD9DF]", opensUpload: true },
};

const PILL = "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 font-sora text-[13px] leading-none min-[480px]:text-[14px]";
const LINK_BUTTON =
  "inline-flex items-center gap-1 whitespace-nowrap font-sora text-[12px] text-black/70 underline-offset-2 hover:text-black hover:underline focus:outline-none focus-visible:[outline:2px_solid_#FF9540]";

export default function RiderDocuments({ initial, today }: { initial: RiderDocumentView[]; today: string }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initial);
  const [editing, setEditing] = useState<RiderDocumentType | null>(null);
  const editingDoc = documents.find((d) => d.type === editing) ?? null;

  return (
    <section
      aria-labelledby="rider-documents-title"
      className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="rider-documents-title"
          className="font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[32px] xl:text-[36px]"
        >
          Documents
        </h2>
        <p className="font-sora text-[12px] leading-[1.6] text-black/60">
          Only you and the restaurant&apos;s managers can open these files. Each upload is checked by the restaurant.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {documents.map((doc) => {
          const chip = CHIP[doc.state];
          const hasFile = doc.state !== "MISSING";
          return (
            <li
              key={doc.type}
              className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:min-h-20 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white min-[400px]:flex">
                  <FileText className="h-5 w-5 text-black" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-frank-ruhl text-[18px] font-medium leading-[1.2] text-black md:text-[20px]">{doc.label}</span>
                  <span
                    className={`break-words font-sora text-[12px] leading-[1.7] ${
                      doc.state === "REJECTED" || doc.state === "EXPIRED" ? "text-[#FF3F5C]" : "text-black/70"
                    }`}
                  >
                    {doc.detail}
                  </span>
                </span>
              </span>

              <span className="flex shrink-0 flex-wrap items-center gap-3 min-[560px]:justify-end">
                {hasFile && (
                  <a href={`/api/rider/documents/${doc.type}`} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
                    View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                {hasFile && !chip.opensUpload && (
                  <button type="button" onClick={() => setEditing(doc.type)} className={LINK_BUTTON}>
                    Replace
                  </button>
                )}
                {chip.opensUpload ? (
                  <button
                    type="button"
                    onClick={() => setEditing(doc.type)}
                    className={`${PILL} transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${chip.className}`}
                  >
                    {chip.label}
                  </button>
                ) : (
                  <span className={`${PILL} ${chip.className}`}>{chip.label}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <DocumentUploadDialog
        document={editingDoc}
        needsExpiry={RIDER_DOCUMENT_TYPES.find((t) => t.value === editing)?.needsExpiry ?? false}
        today={today}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setDocuments((prev) => prev.map((d) => (d.type === saved.type ? saved : d)));
          setEditing(null);
          router.refresh();
        }}
      />
    </section>
  );
}
