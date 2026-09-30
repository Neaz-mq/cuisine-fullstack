"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { ModalError, ReadOnlyField, TEXTAREA } from "@/components/admin/modal-ui";
import type { RiderDocumentType, RiderDocumentView } from "@/lib/rider-documents";

/**
 * View Staff (a rider) → "Vehicle & Documents": what the rider filled in on
 * their Profile, and their uploads to check.
 *
 *   View   opens the file through a one-minute private link
 *   Verify the paper is clear, valid and theirs
 *   Reject asks for a reason — the rider sees it and uploads again
 *
 * Verify/Reject only for people who can manage staff; everyone who can
 * open this modal can look.
 */

type Vehicle = {
  vehicleType: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  drivingLicenseNumber: string | null;
} | null;

const STATE_CHIP: Record<string, { label: string; className: string }> = {
  MISSING: { label: "Not uploaded", className: "bg-white text-black/60" },
  PENDING: { label: "To check", className: "bg-[#E5EDFF] text-[#0090FF]" },
  VERIFIED: { label: "Verified", className: "bg-[#E8FFEC] text-[#0ECF00]" },
  RENEW_SOON: { label: "Renew Soon", className: "bg-[#FFF2DA] text-[#FF9E00]" },
  EXPIRED: { label: "Expired", className: "bg-[#FFE9EC] text-[#FF3F5C]" },
  REJECTED: { label: "Rejected", className: "bg-[#FFE9EC] text-[#FF3F5C]" },
};

const SMALL_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 font-sora text-[12px] font-semibold transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] disabled:opacity-50";

export default function RiderDocumentsReview({ staffId, canManage }: { staffId: string; canManage: boolean }) {
  const [documents, setDocuments] = useState<RiderDocumentView[] | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<RiderDocumentType | null>(null);
  const [rejecting, setRejecting] = useState<RiderDocumentType | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffId}/documents`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the documents.");
        if (!cancelled) {
          setDocuments(data.documents);
          setVehicle(data.vehicle ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the documents.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const decide = async (type: RiderDocumentType, action: "VERIFIED" | "REJECTED") => {
    setBusy(type);
    setError("");
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/documents/${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "REJECTED" ? note.trim() : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      setDocuments((prev) => prev?.map((d) => (d.type === type ? (data as RiderDocumentView) : d)) ?? null);
      setRejecting(null);
      setNote("");
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-[#D9D9D9] pt-6">
      <h3 className="font-frank-ruhl text-[20px] font-semibold leading-none text-black">Vehicle &amp; Documents</h3>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 min-[560px]:grid-cols-4">
        <ReadOnlyField label="Vehicle Type" value={vehicle?.vehicleType || "—"} />
        <ReadOnlyField label="Model" value={vehicle?.vehicleModel || "—"} />
        <ReadOnlyField label="License Plate" value={vehicle?.vehiclePlate || "—"} />
        <ReadOnlyField label="Driving License No." value={vehicle?.drivingLicenseNumber || "—"} />
      </div>

      {error && <ModalError message={error} />}

      {documents === null && !error ? (
        <p className="flex items-center gap-2 font-sora text-[12px] text-black/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading documents…
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {documents?.map((doc) => {
            const chip = STATE_CHIP[doc.state];
            const hasFile = doc.state !== "MISSING";
            return (
              <li key={doc.type} className="flex flex-col gap-3 rounded-[14px] bg-[#F9F6F3] p-3 min-[480px]:p-4">
                <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black">{doc.label}</span>
                    <span className="break-words font-sora text-[11px] leading-[1.5] text-black/65">{doc.detail}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`inline-flex h-8 items-center rounded-full px-3 font-sora text-[12px] ${chip.className}`}>{chip.label}</span>
                    {hasFile && (
                      <a
                        href={`/api/admin/staff/${staffId}/documents/${doc.type}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${SMALL_BUTTON} border border-black/15 bg-white text-black hover:border-black`}
                      >
                        View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {hasFile && canManage && doc.state !== "VERIFIED" && doc.state !== "RENEW_SOON" && doc.state !== "EXPIRED" && (
                      <button
                        type="button"
                        onClick={() => decide(doc.type, "VERIFIED")}
                        disabled={busy !== null}
                        className={`${SMALL_BUTTON} bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90`}
                      >
                        {busy === doc.type && rejecting !== doc.type && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        Verify
                      </button>
                    )}
                    {hasFile && canManage && doc.state !== "REJECTED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(rejecting === doc.type ? null : doc.type);
                          setNote("");
                        }}
                        disabled={busy !== null}
                        className={`${SMALL_BUTTON} border border-[#D72A37]/40 bg-white text-[#D72A37] hover:bg-[#D72A37] hover:text-white`}
                      >
                        Reject
                      </button>
                    )}
                  </span>
                </div>

                {rejecting === doc.type && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`reject-${doc.type}`} className="font-frank-ruhl text-[13px] font-medium text-black">
                      Reason (the rider sees this)
                    </label>
                    <textarea
                      id={`reject-${doc.type}`}
                      className={TEXTAREA}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      placeholder="e.g. The photo is blurry — please upload a clear one"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRejecting(null)}
                        className={`${SMALL_BUTTON} border border-black/15 bg-white text-black hover:border-black`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(doc.type, "REJECTED")}
                        disabled={busy !== null || note.trim() === ""}
                        className={`${SMALL_BUTTON} bg-[#D72A37] text-white hover:opacity-90`}
                      >
                        {busy === doc.type && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        Reject document
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
